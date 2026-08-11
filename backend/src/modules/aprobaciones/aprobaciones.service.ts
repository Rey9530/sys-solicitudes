import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import type { Prisma, solicitud as SolicitudModel } from '@prisma/client';
import type {
  AprobarSolicitudInput,
  CerrarSolicitudInput,
  RechazarSolicitudInput,
  SubsanarSolicitudAdminInput,
  ReasignarSolicitudInput,
  LiberarSolicitudInput,
  PausarSolicitudInput,
  BandejaQuery,
  SolicitudOutput,
  SolicitudListItem,
  SlaStatus,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  SolicitudStateService,
  RESULTADO_CIERRE_LABEL,
} from '../solicitudes/state/solicitud-state.service';
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
  private readonly logger = new Logger(AprobacionesService.name);
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

  // ── Pausar / Reanudar (T-091d-pausar) ────────────────────────────────────────

  async pausar(
    id: string,
    dto: PausarSolicitudInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);
    const updated = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await this.assertSolicitud(tx, id);
      return this.state.pausar(tx, solicitud, actor, dto.motivo);
    });
    await this.audit('solicitud.pausar', id, plazaId, actor, meta, { estado: updated.estado });
    return solicitudToOutput(updated);
  }

  async reanudar(
    id: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);
    const updated = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await this.assertSolicitud(tx, id);
      return this.state.reanudar(tx, solicitud, actor);
    });
    await this.audit('solicitud.reanudar', id, plazaId, actor, meta, { estado: updated.estado });
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

  // ── Cerrar (T-091e-cerrar) ────────────────────────────────────────────────────

  /**
   * `aprobada → cerrada`: da por finalizada la actividad autorizada y registra
   * el resultado. Solo el admin asignado (guard en `state.cerrar`).
   * NO toca `evento_calendario` ni el estado del local: la salida de
   * `en_mantenimiento` la sigue gestionando el cron `mantenimiento-fin`.
   */
  async cerrar(
    id: string,
    dto: CerrarSolicitudInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);
    const updated = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await this.assertSolicitud(tx, id);
      const cerrada = await this.state.cerrar(tx, solicitud, actor, dto.resultado, dto.comentario);
      await this.emailAlCreador(tx, solicitud, 'solicitud-cerrada', dto.comentario, {
        resultado: dto.resultado,
        resultadoLabel: RESULTADO_CIERRE_LABEL[dto.resultado],
        exitoso: dto.resultado === 'exitoso',
      });
      return cerrada;
    });
    await this.audit('solicitud.cerrar', id, plazaId, actor, meta, {
      estado: updated.estado,
      resultado: dto.resultado,
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
   * Bandeja de solicitudes del admin (T-V03 + T-099). Acepta cualquier
   * estado del workflow (borrador, enviada, asignado, en_revision,
   * requerida_subsanacion, aprobada, rechazada, cancelada) — decisión owner
   * 2026-06-23, antes se restringía a las 3 colas activas (enviada/asignado/
   * en_revision). Por defecto `asignadasAMi=true` → solo las asignadas al
   * admin actual; pasar `?asignadasAMi=false` para ver todas las de la plaza.
   * Orden: prioridad ASC (A primero) + enviada_at DESC (más reciente arriba;
   * decisión owner 2026-06-23 — antes era ASC).
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
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.tipo ? { tipo: query.tipo } : {}),
      ...(query.categoriaId ? { categoria_id: query.categoriaId } : {}),
      ...(query.subcategoriaId ? { subcategoria_id: query.subcategoriaId } : {}),
      ...(query.localId ? { local_id: query.localId } : {}),
      ...(query.prioridad ? { prioridad: query.prioridad } : {}),
    };

    const { items, total, slaPorId, config } = await this.prisma.withTenant(
      plazaId,
      async (tx) => {
        // El rol "Administrador del sistema" (rol_staff con `es_sistema=true`)
        // tiene visibilidad completa de su plaza por defecto: omitimos el filtro
        // `asignadasAMi` aunque el cliente lo mande como `true`, para que vea
        // también solicitudes en `enviada` (sin asignar) que nunca llegarían a
        // su bandeja si solo se filtrara por `admin_asignado_id = self`.
        //
        // El lookup se hace DENTRO de withTenant (no antes) porque la RLS de
        // `rol_staff` evalúa `current_setting('app.plaza_id')::uuid`; si la
        // query corre antes de fijar el `set_config`, el cast lanza
        // `invalid input syntax for type uuid: ""` y rompe el endpoint con 500.
        const filtrarPorAsignadasAMi =
          query.asignadasAMi && !(await this.actorEsAdminDelSistema(tx, actor));
        const whereConAsignacion: Prisma.solicitudWhereInput = {
          ...where,
          ...(filtrarPorAsignadasAMi ? { admin_asignado_id: actor.sub } : {}),
        };

        const [items, total, config] = await Promise.all([
          tx.solicitud.findMany({
            where: whereConAsignacion,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: [{ prioridad: 'asc' }, { enviada_at: 'desc' }],
            include: SOLICITUD_INCLUDE,
          }),
          tx.solicitud.count({ where: whereConAsignacion }),
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
    extraVars?: Record<string, unknown>,
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
        ...extraVars,
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

  /**
   * Devuelve `true` cuando el actor es un admin_plaza cuyo rol_staff es el rol
   * maestro del sistema (`rol_staff.es_sistema = true`, código `admin`).
   * Estos admins tienen visibilidad operativa completa de su plaza, así que en
   * `bandeja` el filtro `asignadasAMi` se ignora aunque el cliente lo mande.
   *
   * Validamos `rolStaffId` con regex UUID antes de la query: Prisma no
   * rechaza strings vacíos/no-UUID (los pasa a Postgres) y Postgres responde
   * con `invalid input syntax for type uuid: ""` (HTTP 500). Con este guard
   * `false` para los actores sin rol_staff válido (inquilinos, superadmin, o
   * JWTs viejos con el campo degenerado).
   *
   * La consulta se hace con el `tx` de `withTenant`: si se hiciera con
   * `this.prisma` antes de fijar `app.plaza_id`, la RLS evalúa
   * `current_setting('app.plaza_id')::uuid` con el GUC aún vacío y revienta.
   *
   * Consulta puntual (no cacheada): un SELECT por request sobre `rol_staff` por
   * PK es <1 ms. Si se vuelve caliente, cachear en `AuthenticatedUser` igual
   * que `permisos`.
   */
  private static readonly UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  private async actorEsAdminDelSistema(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
  ): Promise<boolean> {
    if (!actor.rolStaffId || !AprobacionesService.UUID_RE.test(actor.rolStaffId)) return false;
    const rol = await tx.rol_staff.findUnique({
      where: { id: actor.rolStaffId },
      select: { es_sistema: true },
    });
    return rol?.es_sistema === true;
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
