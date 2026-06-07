import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { email_log } from '@prisma/client';
import { PrismaAdminService } from '../../../prisma/prisma-admin.service';
import { MailerService } from '../../../common/mailer/mailer.service';
import { MailerSendError } from '../../../common/mailer/mailer.types';
import { TemplateRendererService } from '../template-renderer.service';
import { UnsubscribeService } from '../unsubscribe.service';

/** Batch por tick (plan T-122: LIMIT 50). */
const BATCH = 50;
/** Backoff exponencial por número de reintento: 1m, 5m, 30m (S-NE-B). */
const BACKOFF_MINUTOS: Record<number, number> = { 1: 1, 2: 5, 3: 30 };
/** Reintentos máximos antes de `fallido` permanente. */
const MAX_REINTENTOS = 3;

/**
 * Worker de la cola `email_log` (T-122). Cada 1 min procesa hasta 50
 * `pendiente` con `next_retry_at` vencida (o NULL): renderiza (T-120),
 * envía vía SMTP (T-119) y actualiza el estado.
 *
 * - Éxito → `enviado` + `sent_at` (CHECK RI-4).
 * - Error transitorio → `reintentos+1`, `last_error`, `next_retry_at`
 *   (+1m/+5m/+30m); al agotar 3 reintentos → `fallido` permanente.
 * - Hard bounce (550/551/553) → `fallido` inmediato (el buzón no existe,
 *   reintentar no tiene sentido) + `usuario.email_invalido = true` (T-124)
 *   en update separado.
 * - Plantilla desconocida en el registro → `fallido` permanente (error
 *   determinístico, e.g. filas legacy).
 *
 * Multi-instancia: `pg_try_advisory_lock` por tick — si otra instancia tiene
 * el lock, el tick se salta (los pendientes quedan para el siguiente).
 * Idempotente: las filas solo cambian de estado tras el resultado SMTP; si
 * el proceso muere a mitad, los `pendiente` se reprocesan (la dedup T-123 y
 * el estado `enviado` evitan dobles envíos de lo ya procesado).
 */
@Injectable()
export class EmailWorker {
  private readonly logger = new Logger(EmailWorker.name);
  private readonly appUrl: string;

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly mailer: MailerService,
    private readonly renderer: TemplateRendererService,
    private readonly unsubscribe: UnsubscribeService,
    config: ConfigService,
  ) {
    this.appUrl = config.get<string>('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, '');
  }

  @Cron('*/1 * * * *', { name: 'email-worker' })
  async handleCron(): Promise<void> {
    await this.procesar();
  }

  /** Lógica del worker, invocable desde verificación manual. */
  async procesar(): Promise<{ enviados: number; fallidos: number; reintentables: number }> {
    const resultado = { enviados: 0, fallidos: 0, reintentables: 0 };

    const [{ locked }] = await this.prismaAdmin.$queryRaw<[{ locked: boolean }]>`
      SELECT pg_try_advisory_lock(hashtext('plazapp.email-worker')) AS locked`;
    if (!locked) {
      this.logger.debug('email-worker: otra instancia tiene el lock; tick omitido.');
      return resultado;
    }

    try {
      const ahora = new Date();
      const pendientes = await this.prismaAdmin.email_log.findMany({
        where: {
          estado: 'pendiente',
          OR: [{ next_retry_at: null }, { next_retry_at: { lte: ahora } }],
        },
        orderBy: { created_at: 'asc' },
        take: BATCH,
      });

      const inicio = Date.now();
      for (const email of pendientes) {
        const r = await this.procesarUno(email);
        resultado[r]++;
      }
      if (pendientes.length > 0) {
        const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
        this.logger.log(
          `email-worker: ${resultado.enviados} enviados, ${resultado.fallidos} fallidos, ` +
            `${resultado.reintentables} reintentables (${pendientes.length} en ${segundos}s)`,
        );
      }
      return resultado;
    } finally {
      await this.prismaAdmin.$queryRaw`SELECT pg_advisory_unlock(hashtext('plazapp.email-worker'))`;
    }
  }

  private async procesarUno(
    email: email_log,
  ): Promise<'enviados' | 'fallidos' | 'reintentables'> {
    try {
      const plaza = await this.prismaAdmin.plaza.findUnique({
        where: { id: email.plaza_id },
        select: { nombre_comercial: true, logo_url: true, color_primario: true },
      });
      const variables = {
        ...((email.variables ?? {}) as Record<string, unknown>),
        plaza: {
          nombreComercial: plaza?.nombre_comercial ?? 'Plazapp',
          logoUrl: plaza?.logo_url ?? null,
          colorPrimario: plaza?.color_primario ?? '#2563eb',
        },
        appUrl: this.appUrl,
        unsubscribeUrl: this.unsubscribe.generarUrl(
          email.plaza_id,
          email.destinatario,
          email.plantilla,
        ),
      };
      const { subject, html } = this.renderer.render(email.plantilla, variables);
      await this.mailer.send(email.destinatario, subject, html);
      await this.prismaAdmin.email_log.update({
        where: { id: email.id },
        data: { estado: 'enviado', sent_at: new Date(), last_error: null },
      });
      return 'enviados';
    } catch (err) {
      return this.registrarFallo(email, err);
    }
  }

  /** Clasifica el error y decide reintento, fallo permanente o bounce (T-124). */
  private async registrarFallo(
    email: email_log,
    err: unknown,
  ): Promise<'fallidos' | 'reintentables'> {
    const mensaje = err instanceof Error ? err.message : String(err);

    // Hard bounce (550/551/553): buzón inexistente — sin reintentos (T-124).
    if (err instanceof MailerSendError && err.esHardBounce) {
      await this.marcarEmailInvalido(email, err.responseCode);
      await this.prismaAdmin.email_log.update({
        where: { id: email.id },
        data: { estado: 'fallido', last_error: `hard bounce ${err.responseCode}: ${mensaje}` },
      });
      return 'fallidos';
    }

    // Errores determinísticos (plantilla desconocida): no reintentar.
    const esDeterministico = !(err instanceof MailerSendError);
    const reintentos = email.reintentos + 1;
    if (esDeterministico || reintentos > MAX_REINTENTOS) {
      await this.prismaAdmin.email_log.update({
        where: { id: email.id },
        data: { estado: 'fallido', reintentos, last_error: mensaje },
      });
      return 'fallidos';
    }

    const minutos = BACKOFF_MINUTOS[reintentos] ?? 30;
    await this.prismaAdmin.email_log.update({
      where: { id: email.id },
      data: {
        reintentos,
        last_error: mensaje,
        next_retry_at: new Date(Date.now() + minutos * 60_000),
      },
    });
    return 'reintentables';
  }

  /**
   * T-124: marca `usuario.email_invalido = true` tras hard bounce, en una
   * operación separada del update del email_log. Scoped a la plaza del email
   * (aislamiento multi-tenant; el mismo email en otra plaza es otro usuario).
   */
  private async marcarEmailInvalido(email: email_log, codigo?: number): Promise<void> {
    try {
      const { count } = await this.prismaAdmin.usuario.updateMany({
        where: { plaza_id: email.plaza_id, email: email.destinatario, deleted_at: null },
        data: { email_invalido: true },
      });
      if (count > 0) {
        const usuarios = await this.prismaAdmin.usuario.findMany({
          where: { plaza_id: email.plaza_id, email: email.destinatario },
          select: { id: true },
        });
        this.logger.warn(
          `hard bounce SMTP ${codigo ?? '???'} para ${email.destinatario}: ` +
            `email_invalido=true (usuario ${usuarios.map((u) => u.id).join(', ')})`,
        );
      }
    } catch (e) {
      // No romper el procesamiento del batch por un fallo al marcar el flag.
      this.logger.error(`no se pudo marcar email_invalido de ${email.destinatario}: ${String(e)}`);
    }
  }
}
