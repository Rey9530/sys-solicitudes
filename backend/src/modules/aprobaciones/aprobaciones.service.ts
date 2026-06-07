import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma, solicitud as SolicitudModel } from '@prisma/client';
import type {
  AprobarSolicitudInput,
  RechazarSolicitudInput,
  SubsanarSolicitudAdminInput,
  ReasignarSolicitudInput,
  LiberarSolicitudInput,
  BandejaQuery,
  SolicitudOutput,
  SolicitudListItem,
  SlaStatus,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { SolicitudStateService } from '../solicitudes/state/solicitud-state.service';
import { StaffForSubcategoriaValidator } from '../categorias/validators/staff-for-subcategoria.validator';
import { calcularSlaStatus } from '../solicitudes/sla/sla.util';
import {
  SOLICITUD_INCLUDE,
  solicitudToOutput,
  solicitudToListItem,
  type SolicitudConRelaciones,
} from '../solicitudes/solicitud.mapper';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Acciones del flujo de aprobación (módulo 07, T-091c/T-093..T-097/T-099).
 * Toda transición pasa por SolicitudStateService dentro de withTenant; aquí
 * se añaden: validación SC-6 del nuevo asignado, encolado de emails al
 * inquilino/staff y los efectos de T6 (evento_calendario, local→mantenimiento).
 */
@Injectable()
export class AprobacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly state: SolicitudStateService,
    private readonly staffValidator: StaffForSubcategoriaValidator,
  ) {}

  // ── Tomar (T-091c) ────────────────────────────────────────────────────────────

  async tomar(id: string, actor: AuthenticatedUser, meta: RequestMeta): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);
    const updated = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await this.assertSolicitud(tx, id);
      const tomada = await this.state.tomar(tx, solicitud, actor);
      // T-126 (decisión owner 2026-06-07): confirma al INQUILINO creador que
      // su solicitud está en revisión (el plan decía "admin que tomó", pero
      // auto-notificar la propia acción no aporta).
      await this.emailAlCreador(tx, solicitud, 'solicitud-recibida');
      return tomada;
    });
    await this.audit('solicitud.tomar', id, plazaId, actor, meta, { estado: updated.estado });
    return solicitudToOutput(updated);
  }

  // ── Liberar (T-093) ───────────────────────────────────────────────────────────

  async liberar(
    id: string,
    dto: LiberarSolicitudInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);
    const updated = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await this.assertSolicitud(tx, id);
      return this.state.liberar(tx, solicitud, actor, dto.motivo);
    });
    await this.audit('solicitud.liberar', id, plazaId, actor, meta, { estado: updated.estado });
    return solicitudToOutput(updated);
  }

  // ── Aprobar (T-094 + efectos T-102/T-103) ─────────────────────────────────────

  async aprobar(
    id: string,
    dto: AprobarSolicitudInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);

    const updated = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await this.assertSolicitud(tx, id);
      const aprobada = await this.state.aprobar(tx, solicitud, actor, dto.comentario);

      // T-102: evento → evento_calendario (upsert 1:1).
      if (solicitud.tipo === 'evento' && solicitud.fecha_evento_inicio) {
        await this.upsertEventoCalendario(tx, solicitud);
      }
      // T-103: remodelación → local en mantenimiento durante el rango.
      if (solicitud.tipo === 'remodelacion') {
        await this.marcarLocalEnMantenimiento(tx, solicitud);
      }

      await this.emailAlCreador(tx, solicitud, 'solicitud-aprobada', dto.comentario);
      return aprobada;
    });

    await this.audit('solicitud.aprobar', id, plazaId, actor, meta, {
      estado: updated.estado,
      comentario: dto.comentario ?? null,
    });
    return solicitudToOutput(updated);
  }

  // ── Rechazar (T-095) ──────────────────────────────────────────────────────────

  async rechazar(
    id: string,
    dto: RechazarSolicitudInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);
    const updated = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await this.assertSolicitud(tx, id);
      const rechazada = await this.state.rechazar(tx, solicitud, actor, dto.comentario);
      await this.emailAlCreador(tx, solicitud, 'solicitud-rechazada', dto.comentario);
      return rechazada;
    });
    await this.audit('solicitud.rechazar', id, plazaId, actor, meta, {
      estado: updated.estado,
      comentario: dto.comentario,
    });
    return solicitudToOutput(updated);
  }

  // ── Pedir subsanación (T-096) ─────────────────────────────────────────────────

  async pedirSubsanacion(
    id: string,
    dto: SubsanarSolicitudAdminInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);
    const updated = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await this.assertSolicitud(tx, id);
      const result = await this.state.pedirSubsanacion(tx, solicitud, actor, dto.comentario);
      await this.emailAlCreador(tx, solicitud, 'solicitud-subsanacion', dto.comentario);
      return result;
    });
    await this.audit('solicitud.pedir_subsanacion', id, plazaId, actor, meta, {
      estado: updated.estado,
      comentario: dto.comentario,
    });
    return solicitudToOutput(updated);
  }

  // ── Reasignar (T-097) ─────────────────────────────────────────────────────────

  async reasignar(
    id: string,
    dto: ReasignarSolicitudInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);
    const updated = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await this.assertSolicitud(tx, id);
      // SC-6: el nuevo responsable es admin_plaza con rol_staff activo y misma plaza.
      await this.staffValidator.validate(tx, dto.nuevoResponsableId, plazaId, 'responsable');
      const result = await this.state.reasignar(
        tx,
        solicitud,
        actor,
        dto.nuevoResponsableId,
        dto.comentario,
      );
      const nuevo = await tx.usuario.findFirst({ where: { id: dto.nuevoResponsableId } });
      if (nuevo) {
        await this.state.enqueueEmail(tx, {
          plazaId,
          destinatario: nuevo.email,
          plantilla: 'solicitud-reasignada',
          solicitudId: solicitud.id,
          variables: {
            solicitudCodigo: solicitud.codigo,
            solicitudTitulo: solicitud.titulo,
            motivo: dto.comentario ?? null,
          },
        });
      }
      return result;
    });
    await this.audit('solicitud.reasignar', id, plazaId, actor, meta, {
      nuevoResponsableId: dto.nuevoResponsableId,
    });
    return solicitudToOutput(updated);
  }

  // ── Bandeja priorizada (T-099) ────────────────────────────────────────────────

  /**
   * Tres colas (T-V03): `enviada` (en espera del cron), `asignado` y
   * `en_revision`. Orden: prioridad ASC (A primero) + enviada_at ASC.
   * `slaStatus` viene de la matview (T-101) y, si la fila aún no existe
   * (solicitud nueva, refresh diario), se calcula al vuelo (T-100).
   */
  async bandeja(
    query: BandejaQuery,
    actor: AuthenticatedUser,
  ): Promise<Paginated<SolicitudListItem>> {
    const plazaId = this.requirePlaza(actor);
    const { page, pageSize } = query;

    const where: Prisma.solicitudWhereInput = {
      estado: query.estado ? query.estado : { in: ['enviada', 'asignado', 'en_revision'] },
      ...(query.tipo ? { tipo: query.tipo } : {}),
      ...(query.categoriaId ? { categoria_id: query.categoriaId } : {}),
      ...(query.subcategoriaId ? { subcategoria_id: query.subcategoriaId } : {}),
      ...(query.localId ? { local_id: query.localId } : {}),
      ...(query.prioridad ? { prioridad: query.prioridad } : {}),
      ...(query.asignadasAMi ? { admin_asignado_id: actor.sub } : {}),
    };

    const { items, total, slaPorId, config } = await this.prisma.withTenant(
      plazaId,
      async (tx) => {
        const [items, total, config] = await Promise.all([
          tx.solicitud.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: [{ prioridad: 'asc' }, { enviada_at: 'asc' }],
            include: SOLICITUD_INCLUDE,
          }),
          tx.solicitud.count({ where }),
          tx.configuracion.findUnique({ where: { plaza_id: plazaId } }),
        ]);
        // T-101: estado precalculado en la matview para los ids de la página.
        const ids = items.map((s) => s.id);
        const slaPorId = new Map<string, SlaStatus>();
        if (ids.length > 0) {
          const rows = await tx.$queryRaw<Array<{ id: string; status: string | null }>>`
            SELECT id, status FROM solicitud_sla_view WHERE id = ANY(${ids}::uuid[])`;
          for (const r of rows) slaPorId.set(r.id, (r.status as SlaStatus) ?? null);
        }
        return { items, total, slaPorId, config };
      },
    );

    return {
      items: items.map((s) =>
        solicitudToListItem(
          s as SolicitudConRelaciones,
          slaPorId.get(s.id) ?? calcularSlaStatus(s, config),
        ),
      ),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** T-102: crea/actualiza el evento_calendario 1:1 de la solicitud aprobada. */
  private async upsertEventoCalendario(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
  ): Promise<void> {
    const inicio = this.combinar(solicitud.fecha_evento_inicio, solicitud.hora_inicio, '00:00');
    const finBase = solicitud.fecha_evento_fin ?? solicitud.fecha_evento_inicio;
    let fin = this.combinar(finBase, solicitud.hora_fin, '23:59');
    if (!inicio || !fin) return;
    if (fin <= inicio) fin = new Date(inicio.getTime() + 60 * 60 * 1000); // CHECK fin > inicio
    await tx.evento_calendario.upsert({
      where: { solicitud_id: solicitud.id },
      update: { titulo: solicitud.titulo, inicio, fin, deleted_at: null },
      create: {
        plaza_id: solicitud.plaza_id,
        solicitud_id: solicitud.id,
        titulo: solicitud.titulo,
        inicio,
        fin,
      },
    });
  }

  /** T-103: local → en_mantenimiento con la ventana de la remodelación. */
  private async marcarLocalEnMantenimiento(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
  ): Promise<void> {
    const extra = (solicitud.campos_extra ?? {}) as Record<string, unknown>;
    const inicioStr = String(extra.fecha_inicio_estimada ?? '');
    const duracion = Number(extra.duracion_dias ?? 0);
    if (!inicioStr || !duracion) return;
    const inicio = new Date(inicioStr);
    const fin = new Date(inicio.getTime() + duracion * 86_400_000);
    await tx.local.update({
      where: { id: solicitud.local_id },
      data: {
        estado: 'en_mantenimiento',
        fecha_inicio_mantenimiento: inicio,
        fecha_fin_mantenimiento: fin,
      },
    });
  }

  /**
   * Encola el email de decisión al creador de la solicitud. El bloqueo por
   * email_invalido lo decide EmailService (T-121): las plantillas CRÍTICAS
   * (aprobada/rechazada/subsanacion) se encolan aunque el flag esté en true.
   */
  private async emailAlCreador(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudModel,
    plantilla: string,
    comentario?: string,
  ): Promise<void> {
    const creador = await tx.usuario.findFirst({
      where: { id: solicitud.usuario_creador_id },
      select: { email: true },
    });
    if (!creador) return;
    await this.state.enqueueEmail(tx, {
      plazaId: solicitud.plaza_id,
      destinatario: creador.email,
      plantilla,
      solicitudId: solicitud.id,
      variables: {
        solicitudCodigo: solicitud.codigo,
        solicitudTitulo: solicitud.titulo,
        comentario: comentario ?? null,
      },
    });
  }

  /** Fecha (DATE) + hora "HH:MM" en TZ El Salvador (UTC-6 fija, sin DST). */
  private combinar(fecha: Date | null, hora: string | null, fallback: string): Date | null {
    if (!fecha) return null;
    const hhmm = hora ?? fallback;
    return new Date(`${fecha.toISOString().slice(0, 10)}T${hhmm}:00-06:00`);
  }

  private async assertSolicitud(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<SolicitudModel> {
    const solicitud = await tx.solicitud.findFirst({ where: { id } });
    if (!solicitud) {
      throw new NotFoundException({
        code: 'SOLICITUD_NOT_FOUND',
        title: 'Recurso no encontrado',
        message: 'La solicitud no existe.',
      });
    }
    return solicitud;
  }

  private requirePlaza(actor: AuthenticatedUser): string {
    if (!actor.plazaId) {
      throw new ForbiddenException({
        code: 'PLAZA_SCOPE_VIOLATION',
        title: 'Acceso denegado',
        message: 'Esta operación requiere un usuario con plaza asignada.',
      });
    }
    return actor.plazaId;
  }

  private async audit(
    accion: string,
    entidadId: string,
    plazaId: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
    despues: unknown,
  ): Promise<void> {
    await this.auditoria.record({
      accion,
      entidadTipo: 'solicitud',
      entidadId,
      plazaId,
      usuarioId: actor.sub,
      despues,
      ...meta,
    });
  }
}
