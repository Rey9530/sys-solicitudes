import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import { getTemplateDef } from './email-templates.registry';

/** Ventana de deduplicación (T-123, RN-NE-6). */
const DEDUP_VENTANA_HORAS = 24;

export interface SendEmailOpts {
  /** Tenant del email (obligatorio: email_log tiene plaza_id NOT NULL). */
  plazaId: string;
  /** Habilita la deduplicación por (solicitudId, destinatario, plantilla). */
  solicitudId?: string;
  /** Default: el flag `critico` del registro de plantillas (T-120). */
  esCritico?: boolean;
  /** Default true. Con false (e.g. reset de contraseña) siempre inserta. */
  deduplicable?: boolean;
  /**
   * Transacción del caller (prisma.withTenant): estado + historial + email
   * quedan atómicos (regla del módulo 06/07). Sin tx usa el admin client
   * (flujos sin contexto de tenant: auth pre-sesión, crons).
   */
  tx?: Prisma.TransactionClient;
}

/**
 * Cola de emails (T-121). `sendEmail` ENCOLA en `email_log` con estado
 * `pendiente` — NUNCA envía directo; el envío es del worker (T-122).
 *
 * Reglas aplicadas antes de insertar:
 *  - T-123: dedup 24h por (solicitud_id, destinatario, plantilla) en estados
 *    pendiente/enviado → retorna el ID existente sin insertar.
 *  - T-121/T-124: si el destinatario tiene `email_invalido = true` y el email
 *    NO es crítico, no encola. Críticos (reset, aprobada, rechazada,
 *    subsanacion) encolan siempre.
 *  - T-125: si el destinatario se desuscribió de la plantilla (no crítica),
 *    no encola.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly prismaAdmin: PrismaAdminService) {}

  /** Encola un email. Retorna el ID del email_log, o null si fue bloqueado. */
  async sendEmail(
    plantilla: string,
    destinatario: string,
    variables: Record<string, unknown> = {},
    opts: SendEmailOpts,
  ): Promise<string | null> {
    const def = getTemplateDef(plantilla);
    if (!def) {
      throw new InternalServerErrorException({
        code: 'PLANTILLA_DESCONOCIDA',
        title: 'Error interno',
        message: `La plantilla de email "${plantilla}" no existe en el registro.`,
      });
    }
    const db = opts.tx ?? this.prismaAdmin;
    const esCritico = opts.esCritico ?? def.critico;

    if (!esCritico) {
      // RN-NE-2: no encolar no-críticos a direcciones con hard bounce previo.
      const usuario = await db.usuario.findFirst({
        where: { plaza_id: opts.plazaId, email: destinatario, deleted_at: null },
        select: { email_invalido: true },
      });
      if (usuario?.email_invalido) {
        this.logger.log(`bloqueado por email_invalido: ${plantilla} -> ${destinatario}`);
        return null;
      }
      // RN-NE-4: respetar desuscripciones (T-125).
      const desuscrito = await db.unsubscribe.findFirst({
        where: { plaza_id: opts.plazaId, email: destinatario, plantilla },
        select: { id: true },
      });
      if (desuscrito) {
        this.logger.log(`bloqueado por unsubscribe: ${plantilla} -> ${destinatario}`);
        return null;
      }
    }

    // T-123: deduplicación por transición/destinatario/evento en 24h.
    if (opts.solicitudId && opts.deduplicable !== false) {
      const existente = await db.email_log.findFirst({
        where: {
          solicitud_id: opts.solicitudId,
          destinatario,
          plantilla,
          estado: { in: ['pendiente', 'enviado'] },
          created_at: { gt: new Date(Date.now() - DEDUP_VENTANA_HORAS * 3_600_000) },
        },
        select: { id: true },
      });
      if (existente) {
        this.logger.log(
          `deduplicated: ${plantilla} -> ${destinatario} (solicitud ${opts.solicitudId}, email_log ${existente.id})`,
        );
        return existente.id;
      }
    }

    const creado = await db.email_log.create({
      data: {
        plaza_id: opts.plazaId,
        solicitud_id: opts.solicitudId ?? null,
        destinatario,
        plantilla,
        variables: variables as Prisma.InputJsonValue,
        estado: 'pendiente',
        reintentos: 0,
      },
      select: { id: true },
    });
    return creado.id;
  }
}
