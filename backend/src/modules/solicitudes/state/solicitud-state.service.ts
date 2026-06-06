import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type {
  Prisma,
  solicitud as SolicitudModel,
  solicitud_estado,
  solicitud_historial_evento,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/types/jwt-payload';

/** Estados terminales (S-FS-A): no admiten más transiciones. */
const ESTADOS_TERMINALES: solicitud_estado[] = ['aprobada', 'rechazada', 'cancelada'];

/**
 * Tabla de transiciones válidas del flujo (docs/05 revisado por T-V03):
 *
 *   borrador ──enviar──▶ enviada ──autoAsignar(cron 15 min)──▶ asignado
 *   asignado ──tomar(solo asignado)──▶ en_revision
 *   en_revision ──aprobar/rechazar──▶ terminal
 *   en_revision ──pedirSubsanacion──▶ requerida_subsanacion
 *   requerida_subsanacion ──reenviar(inquilino)──▶ enviada
 *   asignado|en_revision ──liberar/reasignar──▶ enviada | (mismo estado)
 *   cualquier no-terminal ──cancelar──▶ cancelada
 *
 * ⚠️ T-V03: NO existe lock de 30 min ni `lock_expira_at`.
 */
const TRANSICIONES: Record<string, { desde: solicitud_estado[]; hacia: solicitud_estado }> = {
  enviar: { desde: ['borrador'], hacia: 'enviada' },
  autoAsignar: { desde: ['enviada'], hacia: 'asignado' },
  tomar: { desde: ['asignado', 'enviada'], hacia: 'en_revision' },
  aprobar: { desde: ['en_revision'], hacia: 'aprobada' },
  rechazar: { desde: ['en_revision'], hacia: 'rechazada' },
  pedirSubsanacion: { desde: ['en_revision'], hacia: 'requerida_subsanacion' },
  reenviar: { desde: ['requerida_subsanacion'], hacia: 'enviada' },
  reasignar: { desde: ['asignado', 'en_revision'], hacia: 'asignado' },
  liberar: { desde: ['asignado', 'en_revision'], hacia: 'enviada' },
  cancelar: {
    desde: ['borrador', 'enviada', 'asignado', 'en_revision', 'requerida_subsanacion'],
    hacia: 'cancelada',
  },
};

export interface HistorialParams {
  solicitudId: string;
  plazaId: string;
  usuarioId: string | null;
  evento: solicitud_historial_evento;
  estadoAnterior?: solicitud_estado | null;
  estadoNuevo?: solicitud_estado | null;
  comentario?: string | null;
}

export interface EmailParams {
  plazaId: string;
  destinatario: string;
  plantilla: string;
  variables?: Record<string, unknown>;
}

/**
 * State machine de solicitudes (T-091) — versión RAMA 2 (módulo 06): solo las
 * transiciones que dispara el inquilino (`enviar`, `cancelar`, `reenviar`).
 * Las de admin (tomar/aprobar/rechazar/pedirSubsanacion/reasignar/liberar) y
 * el cron de auto-asignación llegan con el módulo 07.
 *
 * Contrato del servicio:
 *  - Es el ÚNICO punto que escribe `solicitud.estado` (los controllers nunca).
 *  - Todos los métodos reciben el `tx` de la transacción del caller
 *    (`prisma.withTenant`) para que estado + historial + emails sean atómicos.
 *  - `insertarHistorial` (T-105) SOLO inserta — la tabla es append-only y el
 *    trigger/REVOKE de BD lo refuerzan.
 *  - `enqueueEmail` (T-118 mínimo) inserta en `email_log` con estado
 *    `pendiente`; el envío real es del worker del módulo 09.
 */
@Injectable()
export class SolicitudStateService {
  // ── Transiciones del inquilino (rama 2) ───────────────────────────────────────

  /** T-081 (ajustada T-V03): borrador → enviada. NO asigna, NO email. */
  async enviar(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
    actor: AuthenticatedUser,
  ): Promise<SolicitudModel> {
    this.assertTransicion(solicitud, 'enviar');
    const updated = await tx.solicitud.update({
      where: { id: solicitud.id },
      data: { estado: 'enviada', enviada_at: new Date() },
    });
    await this.insertarHistorial(tx, {
      solicitudId: solicitud.id,
      plazaId: solicitud.plaza_id,
      usuarioId: actor.sub,
      evento: 'enviada',
      estadoAnterior: solicitud.estado,
      estadoNuevo: 'enviada',
    });
    return updated;
  }

  /** T-082: cualquier estado no terminal → cancelada. Sin email (silenciosa). */
  async cancelar(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
    actor: AuthenticatedUser,
    motivo?: string,
  ): Promise<SolicitudModel> {
    this.assertTransicion(solicitud, 'cancelar');
    const updated = await tx.solicitud.update({
      where: { id: solicitud.id },
      data: { estado: 'cancelada', admin_asignado_id: null },
    });
    await this.insertarHistorial(tx, {
      solicitudId: solicitud.id,
      plazaId: solicitud.plaza_id,
      usuarioId: actor.sub,
      evento: 'cancelada',
      estadoAnterior: solicitud.estado,
      estadoNuevo: 'cancelada',
      comentario: motivo ?? null,
    });
    return updated;
  }

  /**
   * T-083 (ajustada T-V03): requerida_subsanacion → enviada. El reenvío
   * vuelve a la COLA; el cron de 15 min (T-091b) re-asigna al responsable
   * ACTUAL de la subcategoría. Sin email inmediato.
   */
  async reenviar(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
    actor: AuthenticatedUser,
  ): Promise<SolicitudModel> {
    this.assertTransicion(solicitud, 'reenviar');
    const updated = await tx.solicitud.update({
      where: { id: solicitud.id },
      data: { estado: 'enviada', enviada_at: new Date(), admin_asignado_id: null },
    });
    await this.insertarHistorial(tx, {
      solicitudId: solicitud.id,
      plazaId: solicitud.plaza_id,
      usuarioId: actor.sub,
      evento: 'enviada',
      estadoAnterior: solicitud.estado,
      estadoNuevo: 'enviada',
      comentario: 'Reenviada tras subsanación',
    });
    return updated;
  }

  // ── Helpers compartidos (T-105, T-118 mínimo) ─────────────────────────────────

  /** Único punto de escritura en `solicitud_historial` (append-only, RI-1). */
  async insertarHistorial(tx: Prisma.TransactionClient, params: HistorialParams): Promise<void> {
    await tx.solicitud_historial.create({
      data: {
        plaza_id: params.plazaId,
        solicitud_id: params.solicitudId,
        usuario_id: params.usuarioId,
        evento: params.evento,
        estado_anterior: params.estadoAnterior ?? null,
        estado_nuevo: params.estadoNuevo ?? null,
        comentario: params.comentario ?? null,
      },
    });
  }

  /** Encola un email (INSERT en email_log, estado `pendiente`; envía módulo 09). */
  async enqueueEmail(tx: Prisma.TransactionClient, params: EmailParams): Promise<void> {
    await tx.email_log.create({
      data: {
        plaza_id: params.plazaId,
        destinatario: params.destinatario,
        plantilla: params.plantilla,
        variables: (params.variables ?? {}) as Prisma.InputJsonValue,
        estado: 'pendiente',
      },
    });
  }

  /** Valida la transición contra la tabla; 400 INVALID_STATE_TRANSITION si no. */
  assertTransicion(solicitud: SolicitudModel, evento: keyof typeof TRANSICIONES): void {
    const regla = TRANSICIONES[evento];
    if (!regla || !regla.desde.includes(solicitud.estado)) {
      throw new BadRequestException({
        code: 'INVALID_STATE_TRANSITION',
        title: 'Solicitud inválida',
        message: `No se puede "${String(evento)}" una solicitud en estado "${solicitud.estado}".`,
      });
    }
  }

  /** Estados terminales: aprobada, rechazada, cancelada (S-FS-A). */
  esTerminal(estado: solicitud_estado): boolean {
    return ESTADOS_TERMINALES.includes(estado);
  }

  /** Defensa SC-4 (reutilizada por aprobar/rechazar en módulo 07). */
  assertNoEsCreador(solicitud: SolicitudModel, actor: AuthenticatedUser, code: string): void {
    if (solicitud.usuario_creador_id === actor.sub) {
      throw new ForbiddenException({
        code,
        title: 'Acceso denegado',
        message: 'Un administrador no puede decidir sobre su propia solicitud (SC-4).',
      });
    }
  }
}
