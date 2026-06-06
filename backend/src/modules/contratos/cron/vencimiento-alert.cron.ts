import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaAdminService } from '../../../prisma/prisma-admin.service';
import { MailerService } from '../../auth/services/mailer.service';
import { toIsoDate } from '../contrato.mapper';

const PLANTILLA = 'contrato_vencimiento_alert';
const VENTANAS = [
  { ventana: 'T-30' as const, dias: 30 },
  { ventana: 'T-7' as const, dias: 7 },
];

/**
 * Alertas de vencimiento de contratos T-30 y T-7 (T-056, S-AlertaVencimiento).
 *
 * Corre todos los días a las 09:00 hora de la plaza. ⚠️ Desviación documentada:
 * timezone `America/El_Salvador` (T-V08, fija para todas las plazas), NO
 * `America/Costa_Rica` como decía el plan original de la tarea.
 *
 * Usa `PrismaAdminService` (bypassa RLS): el cron corre SIN contexto de tenant
 * y recorre todas las plazas; el aislamiento se garantiza agrupando
 * explícitamente por `plaza_id` antes de enviar.
 *
 * Deduplicación: una fila en `email_log` (plantilla + plaza + ventana + día
 * de El Salvador) por destinatario; si ya existe alguna hoy, no se reenvía.
 */
@Injectable()
export class VencimientoAlertCron {
  private readonly logger = new Logger(VencimientoAlertCron.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly mailer: MailerService,
  ) {}

  @Cron('0 9 * * *', { name: 'contrato-vencimiento-alert', timeZone: 'America/El_Salvador' })
  async handleCron(): Promise<void> {
    await this.ejecutarAlertas();
  }

  /** Lógica del cron, invocable también desde el endpoint dev de prueba. */
  async ejecutarAlertas(): Promise<{ enviadas: number; omitidasPorDedup: number }> {
    const hoy = this.hoyEnElSalvador();
    let enviadas = 0;
    let omitidasPorDedup = 0;

    for (const { ventana, dias } of VENTANAS) {
      const objetivo = new Date(hoy.getTime() + dias * 86_400_000);

      const contratos = await this.prismaAdmin.contrato.findMany({
        where: { estado: 'vigente', fecha_fin: objetivo },
        include: {
          local: { select: { codigo: true } },
          inquilino: { select: { razon_social: true } },
          plaza: { select: { nombre_comercial: true, deleted_at: true } },
        },
      });

      // Agrupar por plaza (aislamiento explícito al usar el admin client).
      const porPlaza = new Map<string, typeof contratos>();
      for (const c of contratos) {
        if (c.plaza.deleted_at) continue;
        const grupo = porPlaza.get(c.plaza_id) ?? [];
        grupo.push(c);
        porPlaza.set(c.plaza_id, grupo);
      }

      for (const [plazaId, grupo] of porPlaza) {
        const primero = grupo[0];
        if (!primero) continue;
        // Dedup: ¿ya se envió esta ventana hoy (día de El Salvador) a esta plaza?
        const yaEnviada = await this.prismaAdmin.email_log.findFirst({
          where: {
            plaza_id: plazaId,
            plantilla: PLANTILLA,
            created_at: { gte: this.inicioDelDiaSvEnUtc() },
            variables: { path: ['ventana'], equals: ventana },
          },
        });
        if (yaEnviada) {
          omitidasPorDedup++;
          continue;
        }

        const admins = await this.prismaAdmin.usuario.findMany({
          where: {
            plaza_id: plazaId,
            deleted_at: null,
            email_invalido: false,
            rol: { codigo: 'admin_plaza' },
          },
          select: { email: true },
        });
        if (admins.length === 0) {
          this.logger.warn(`Plaza ${plazaId} sin admin_plaza activo; alerta ${ventana} omitida.`);
          continue;
        }

        const resumen = grupo.map((c) => ({
          localCodigo: c.local.codigo,
          inquilinoRazonSocial: c.inquilino.razon_social,
          fechaFin: c.fecha_fin ? toIsoDate(c.fecha_fin) : '',
        }));
        const variables = {
          ventana,
          contratoIds: grupo.map((c) => c.id),
        } satisfies Prisma.InputJsonValue;

        for (const admin of admins) {
          try {
            await this.mailer.sendContratoPorVencer(
              admin.email,
              primero.plaza.nombre_comercial,
              ventana,
              resumen,
            );
            await this.prismaAdmin.email_log.create({
              data: {
                plaza_id: plazaId,
                destinatario: admin.email,
                plantilla: PLANTILLA,
                variables,
                estado: 'enviado',
                sent_at: new Date(),
              },
            });
            enviadas++;
          } catch (err) {
            this.logger.error(
              `Alerta ${ventana} a ${admin.email} (plaza ${plazaId}) falló: ${String(err)}`,
            );
            await this.prismaAdmin.email_log
              .create({
                data: {
                  plaza_id: plazaId,
                  destinatario: admin.email,
                  plantilla: PLANTILLA,
                  variables,
                  estado: 'fallido',
                  last_error: String(err),
                },
              })
              .catch(() => undefined);
          }
        }
      }
    }

    this.logger.log(
      `Alertas de vencimiento: ${enviadas} enviadas, ${omitidasPorDedup} omitidas por dedup.`,
    );
    return { enviadas, omitidasPorDedup };
  }

  /** Fecha civil de El Salvador (UTC-6, sin DST) como Date a medianoche UTC. */
  private hoyEnElSalvador(): Date {
    const ahoraSv = new Date(Date.now() - 6 * 3_600_000);
    return new Date(
      Date.UTC(ahoraSv.getUTCFullYear(), ahoraSv.getUTCMonth(), ahoraSv.getUTCDate()),
    );
  }

  /** Instante UTC en que empieza el día actual de El Salvador (00:00 SV = 06:00 UTC). */
  private inicioDelDiaSvEnUtc(): Date {
    return new Date(this.hoyEnElSalvador().getTime() + 6 * 3_600_000);
  }
}
