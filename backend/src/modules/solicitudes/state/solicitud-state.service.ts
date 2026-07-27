import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type {
  Prisma,
  solicitud as SolicitudModel,
  solicitud_estado,
  solicitud_historial_evento,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/types/jwt-payload';
import { EmailService } from '../../notificaciones/email.service';

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
 *   asignado|en_revision ──pausar──▶ pausada ──reanudar(permiso)──▶ en_revision
 *   cualquier no-terminal ──cancelar──▶ cancelada
 *
 * ⚠️ T-V03: NO existe lock de 30 min ni `lock_expira_at`.
 * T-091d-pausar: `pausada` es reversible y congela el SLA.
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
  pausar: { desde: ['asignado', 'en_revision'], hacia: 'pausada' },
  reanudar: { desde: ['pausada'], hacia: 'en_revision' },
  cancelar: {
    desde: ['borrador', 'enviada', 'asignado', 'en_revision', 'requerida_subsanacion', 'pausada'],
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
  /** Habilita la deduplicación T-123 (pasar SIEMPRE en emails de transición). */
  solicitudId?: string;
  /** Override del flag `critico` del registro de plantillas (T-120). */
  esCritico?: boolean;
  /** Default true; false fuerza el insert aunque exista duplicado. */
  deduplicable?: boolean;
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
  constructor(private readonly emailService: EmailService) {}

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

  // ── Transiciones del sistema y del admin (rama 3 · módulo 07) ────────────────

  /**
   * T-091b (reemplaza T-098): auto-asignación del cron a los 15 min.
   * `enviada → asignado` con el responsable ACTUAL de la subcategoría.
   * Actor = sistema (usuario_id NULL en historial).
   */
  async autoAsignar(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
    responsableId: string,
  ): Promise<SolicitudModel> {
    this.assertTransicion(solicitud, 'autoAsignar');
    const updated = await tx.solicitud.update({
      where: { id: solicitud.id },
      data: { estado: 'asignado', admin_asignado_id: responsableId, asignada_at: new Date() },
    });
    await this.insertarHistorial(tx, {
      solicitudId: solicitud.id,
      plazaId: solicitud.plaza_id,
      usuarioId: null, // sistema
      evento: 'asignada',
      estadoAnterior: solicitud.estado,
      estadoNuevo: 'asignado',
      comentario: 'Auto-asignada al responsable de la subcategoría',
    });
    return updated;
  }

  /**
   * T-091c (reemplaza T-092): `asignado → en_revision`.
   * Decisión confirmada: en `asignado` SOLO el admin asignado puede tomar.
   * Desde `enviada` (cola sin asignar: tipo=otro o sin responsable válido)
   * cualquier admin_plaza puede tomarla (espíritu del T-092 legacy).
   */
  async tomar(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
    actor: AuthenticatedUser,
  ): Promise<SolicitudModel> {
    this.assertTransicion(solicitud, 'tomar');
    if (
      solicitud.estado === 'asignado' &&
      solicitud.admin_asignado_id !== actor.sub &&
      actor.rol !== 'superadmin'
    ) {
      throw new ForbiddenException({
        code: 'NOT_ASSIGNED_ADMIN',
        title: 'Acceso denegado',
        message: 'Solo el administrador asignado puede tomar esta solicitud (o reasignarla).',
      });
    }
    const updated = await tx.solicitud.update({
      where: { id: solicitud.id },
      data: { estado: 'en_revision', admin_asignado_id: actor.sub, asignada_at: new Date() },
    });
    await this.insertarHistorial(tx, {
      solicitudId: solicitud.id,
      plazaId: solicitud.plaza_id,
      usuarioId: actor.sub,
      evento: 'tomada',
      estadoAnterior: solicitud.estado,
      estadoNuevo: 'en_revision',
    });
    return updated;
  }

  /** T-094 (T6): `en_revision → aprobada`. SC-4: el creador no aprueba. */
  async aprobar(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
    actor: AuthenticatedUser,
    comentario?: string,
  ): Promise<SolicitudModel> {
    this.assertTransicion(solicitud, 'aprobar');
    this.assertNoEsCreador(solicitud, actor, 'CANNOT_APPROVE_OWN_REQUEST');
    this.assertEsAsignado(solicitud, actor);
    const updated = await tx.solicitud.update({
      where: { id: solicitud.id },
      data: { estado: 'aprobada', decision_at: new Date() },
    });
    await this.insertarHistorial(tx, {
      solicitudId: solicitud.id,
      plazaId: solicitud.plaza_id,
      usuarioId: actor.sub,
      evento: 'aprobada',
      estadoAnterior: solicitud.estado,
      estadoNuevo: 'aprobada',
      comentario: comentario ?? null,
    });
    return updated;
  }

  /** T-095 (T7): `en_revision → rechazada`. Comentario OBLIGATORIO (Zod). */
  async rechazar(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
    actor: AuthenticatedUser,
    comentario: string,
  ): Promise<SolicitudModel> {
    this.assertTransicion(solicitud, 'rechazar');
    this.assertNoEsCreador(solicitud, actor, 'CANNOT_REJECT_OWN_REQUEST');
    if (!comentario?.trim()) {
      throw new BadRequestException({
        code: 'COMENTARIO_REQUERIDO',
        title: 'Solicitud inválida',
        message: 'El rechazo requiere un comentario no vacío.',
      });
    }
    const updated = await tx.solicitud.update({
      where: { id: solicitud.id },
      data: { estado: 'rechazada', decision_at: new Date() },
    });
    await this.insertarHistorial(tx, {
      solicitudId: solicitud.id,
      plazaId: solicitud.plaza_id,
      usuarioId: actor.sub,
      evento: 'rechazada',
      estadoAnterior: solicitud.estado,
      estadoNuevo: 'rechazada',
      comentario,
    });
    return updated;
  }

  /**
   * T-096 (T8): `en_revision → requerida_subsanacion`. Comentario OBLIGATORIO.
   * `admin_asignado_id` queda NULL (sin asignar hasta el reenvío T9).
   */
  async pedirSubsanacion(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
    actor: AuthenticatedUser,
    comentario: string,
  ): Promise<SolicitudModel> {
    this.assertTransicion(solicitud, 'pedirSubsanacion');
    this.assertEsAsignado(solicitud, actor);
    if (!comentario?.trim()) {
      throw new BadRequestException({
        code: 'COMENTARIO_REQUERIDO',
        title: 'Solicitud inválida',
        message: 'Pedir subsanación requiere un comentario no vacío.',
      });
    }
    const updated = await tx.solicitud.update({
      where: { id: solicitud.id },
      data: { estado: 'requerida_subsanacion', admin_asignado_id: null },
    });
    await this.insertarHistorial(tx, {
      solicitudId: solicitud.id,
      plazaId: solicitud.plaza_id,
      usuarioId: actor.sub,
      evento: 'subsanada',
      estadoAnterior: solicitud.estado,
      estadoNuevo: 'requerida_subsanacion',
      comentario,
    });
    // El cuerpo también vive como comentario tipo `subsanacion` (T-096).
    await tx.comentario.create({
      data: {
        plaza_id: solicitud.plaza_id,
        solicitud_id: solicitud.id,
        usuario_id: actor.sub,
        tipo: 'subsanacion',
        cuerpo: comentario,
      },
    });
    return updated;
  }

  /**
   * T-097 (T12, ajustada T-V04): reasignación en `asignado` o `en_revision`
   * por CUALQUIER admin_plaza. Sin lock (T-V03): solo cambia el asignado.
   * El estado se conserva tal cual (en_revision sigue en_revision).
   */
  async reasignar(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
    actor: AuthenticatedUser | null,
    nuevoResponsableId: string,
    comentario?: string,
  ): Promise<SolicitudModel> {
    this.assertTransicion(solicitud, 'reasignar');
    if (solicitud.admin_asignado_id === nuevoResponsableId) {
      throw new BadRequestException({
        code: 'SAME_ASSIGNEE',
        title: 'Solicitud inválida',
        message: 'La solicitud ya está asignada a ese administrador.',
      });
    }
    const updated = await tx.solicitud.update({
      where: { id: solicitud.id },
      data: { admin_asignado_id: nuevoResponsableId, asignada_at: new Date() },
    });
    await this.insertarHistorial(tx, {
      solicitudId: solicitud.id,
      plazaId: solicitud.plaza_id,
      usuarioId: actor?.sub ?? null,
      evento: 'reasignada',
      estadoAnterior: solicitud.estado,
      estadoNuevo: solicitud.estado,
      comentario: comentario ?? null,
    });
    return updated;
  }

  /**
   * T-093 (ajustada T-V03): `asignado|en_revision → enviada`. Solo el admin
   * asignado libera; vuelve a la cola y el cron re-asigna a los 15 min.
   * `enviada_at` NO se resetea: el SLA cuenta desde el envío original.
   */
  async liberar(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
    actor: AuthenticatedUser,
    motivo?: string,
  ): Promise<SolicitudModel> {
    this.assertTransicion(solicitud, 'liberar');
    if (solicitud.admin_asignado_id !== actor.sub && actor.rol !== 'superadmin') {
      throw new ForbiddenException({
        code: 'NOT_ASSIGNED_ADMIN',
        title: 'Acceso denegado',
        message: 'Solo el administrador asignado puede liberar la solicitud.',
      });
    }
    const updated = await tx.solicitud.update({
      where: { id: solicitud.id },
      data: { estado: 'enviada', admin_asignado_id: null },
    });
    await this.insertarHistorial(tx, {
      solicitudId: solicitud.id,
      plazaId: solicitud.plaza_id,
      usuarioId: actor.sub,
      evento: 'comentario',
      estadoAnterior: solicitud.estado,
      estadoNuevo: 'enviada',
      comentario: motivo?.trim() ? `Liberada: ${motivo.trim()}` : 'Liberada por el asignado',
    });
    return updated;
  }

  /**
   * T-091d-pausar: `asignado|en_revision → pausada`. Cualquier admin de la
   * plaza con permiso `solicitudes.pausar` puede pausar (no se restringe
   * al admin_asignado: si este está de vacaciones, otro admin puede
   * cubrirlo sin reasignar). El SLA queda congelado (la matview
   * `solicitud_sla_view` no incluye `pausada` y `calcularSlaStatus`
   * retorna null). El admin_asignado_id se CONSERVA — al reanudar, sigue
   * siendo el responsable. Sin email (silencioso, como liberar).
   */
  async pausar(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
    actor: AuthenticatedUser,
    motivo?: string,
  ): Promise<SolicitudModel> {
    this.assertTransicion(solicitud, 'pausar');
    const updated = await tx.solicitud.update({
      where: { id: solicitud.id },
      data: { estado: 'pausada' },
    });
    await this.insertarHistorial(tx, {
      solicitudId: solicitud.id,
      plazaId: solicitud.plaza_id,
      usuarioId: actor.sub,
      evento: 'pausada',
      estadoAnterior: solicitud.estado,
      estadoNuevo: 'pausada',
      comentario: motivo?.trim() || null,
    });
    return updated;
  }

  /**
   * T-091d-pausar: `pausada → en_revision`. Cualquier admin de la plaza con
   * permiso `solicitudes.reanudar` puede reanudar. El admin_asignado_id y
   * asignada_at se conservan (sin reset) — el SLA retoma el conteo desde
   * el envío original. Sin email.
   */
  async reanudar(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
    actor: AuthenticatedUser,
  ): Promise<SolicitudModel> {
    this.assertTransicion(solicitud, 'reanudar');
    const updated = await tx.solicitud.update({
      where: { id: solicitud.id },
      data: { estado: 'en_revision' },
    });
    await this.insertarHistorial(tx, {
      solicitudId: solicitud.id,
      plazaId: solicitud.plaza_id,
      usuarioId: actor.sub,
      evento: 'reanudada',
      estadoAnterior: 'pausada',
      estadoNuevo: 'en_revision',
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

  /**
   * Encola un email (INSERT en email_log, estado `pendiente`; envía T-122).
   * Desde T-121 delega en `EmailService.sendEmail`, que aplica dedup (T-123),
   * bloqueo por email_invalido (T-124) y desuscripciones (T-125).
   */
  async enqueueEmail(tx: Prisma.TransactionClient, params: EmailParams): Promise<void> {
    await this.emailService.sendEmail(params.plantilla, params.destinatario, params.variables, {
      plazaId: params.plazaId,
      solicitudId: params.solicitudId,
      esCritico: params.esCritico,
      deduplicable: params.deduplicable,
      tx,
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

  /** Solo el admin asignado decide sobre una solicitud en revisión. */
  private assertEsAsignado(solicitud: SolicitudModel, actor: AuthenticatedUser): void {
    if (solicitud.admin_asignado_id !== actor.sub && actor.rol !== 'superadmin') {
      throw new ForbiddenException({
        code: 'NOT_ASSIGNED_ADMIN',
        title: 'Acceso denegado',
        message: 'Solo el administrador asignado puede decidir sobre esta solicitud.',
      });
    }
  }
}
