import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma, solicitud as SolicitudModel } from '@prisma/client';
import type {
  CreateSolicitudInput,
  UpdateSolicitudInput,
  ListSolicitudesQuery,
  DuplicadosQuery,
  CreateComentarioInput,
  UpdatePrioridadInput,
  SolicitudOutput,
  SolicitudListItem,
  SolicitudDetailOutput,
  ComentarioOutput,
  SolicitudHistorialOutput,
  SolicitudTipo,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { sanitizeHtml, sanitizePlainText } from '../../common/sanitizers/html-sanitizer';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { SolicitudStateService } from './state/solicitud-state.service';
import { StaffForSubcategoriaValidator } from '../categorias/validators/staff-for-subcategoria.validator';
import { validateCamposExtra } from './validators/campos-extra.validator';
import {
  SOLICITUD_INCLUDE,
  solicitudToOutput,
  solicitudToListItem,
  comentarioToOutput,
  historialToOutput,
  type SolicitudConRelaciones,
} from './solicitud.mapper';
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
 * CRUD y acciones de inquilino sobre solicitudes (T-080..T-086, T-090).
 *
 * Reglas clave (docs/03 RN-SO-*, docs/05 revisado T-V03):
 *  - POST solo inquilino; siempre nace en `borrador` con prioridad heredada
 *    de la subcategoría y `codigo` autogenerado por trigger.
 *  - El local debe pertenecer al inquilino vía contrato VIGENTE y no estar
 *    `fuera_de_servicio` (RN-SO-1).
 *  - PATCH solo en `borrador`/`requerida_subsanacion`; el cambio de local solo
 *    en esos estados (S-FS-F).
 *  - Las transiciones de estado pasan SIEMPRE por SolicitudStateService.
 *  - inquilino solo ve/toca sus solicitudes; admin_plaza las de su plaza.
 */
@Injectable()
export class SolicitudesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly state: SolicitudStateService,
    private readonly staffValidator: StaffForSubcategoriaValidator,
  ) {}

  // ── Crear (T-080) ─────────────────────────────────────────────────────────────

  async create(
    dto: CreateSolicitudInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);
    const inquilinoId = this.requireInquilino(actor);

    const solicitud = await this.prisma.withTenant(plazaId, async (tx) => {
      await this.assertLocalDelInquilino(tx, dto.localId, inquilinoId);
      // T-V22: límite de 3 permisos de emergencia por mes por inquilino.
      await this.assertLimiteEmergencia(tx, dto, inquilinoId);
      const { prioridad } = await this.resolverSubcategoria(
        tx,
        dto.tipo,
        dto.categoriaId,
        dto.subcategoriaId,
      );
      const camposExtra = await this.aplicarReglasCamposExtra(tx, plazaId, dto.tipo, {
        ...dto.camposExtra,
      });

      const creada = await tx.solicitud.create({
        data: {
          plaza_id: plazaId,
          local_id: dto.localId,
          inquilino_id: inquilinoId,
          usuario_creador_id: actor.sub,
          categoria_id: dto.categoriaId ?? null,
          subcategoria_id: dto.subcategoriaId ?? null,
          tipo: dto.tipo,
          prioridad,
          // T-151 (SEC-6): sanitización server-side contra XSS.
          titulo: sanitizePlainText(dto.titulo),
          descripcion: sanitizeHtml(dto.descripcion),
          campos_extra: camposExtra as Prisma.InputJsonValue,
          fecha_evento_inicio: new Date(dto.fechaEventoInicio),
          fecha_evento_fin: new Date(dto.fechaEventoFin),
          hora_inicio: dto.horaInicio,
          hora_fin: dto.horaFin,
          // T-V22: bloque transversal empresa ejecutante + modo emergencia.
          empresa_nombre: sanitizePlainText(dto.empresaNombre),
          empresa_responsable: sanitizePlainText(dto.empresaResponsable),
          empresa_telefono: sanitizePlainText(dto.empresaTelefono),
          empresa_email: sanitizePlainText(dto.empresaEmail),
          emergencia_contacto: sanitizePlainText(dto.emergenciaContacto),
          emergencia_telefono: sanitizePlainText(dto.emergenciaTelefono),
          es_emergencia: dto.esEmergencia,
        },
      });
      await this.state.insertarHistorial(tx, {
        solicitudId: creada.id,
        plazaId,
        usuarioId: actor.sub,
        evento: 'creada',
        estadoNuevo: 'borrador',
      });
      return creada;
    });

    await this.auditoria.record({
      accion: 'solicitud.create',
      entidadTipo: 'solicitud',
      entidadId: solicitud.id,
      plazaId,
      usuarioId: actor.sub,
      despues: solicitudToOutput(solicitud),
      ...meta,
    });
    return solicitudToOutput(solicitud);
  }

  // ── Listar (T-080) ────────────────────────────────────────────────────────────

  async findAll(
    query: ListSolicitudesQuery,
    actor: AuthenticatedUser,
  ): Promise<Paginated<SolicitudListItem>> {
    const plazaId = this.requirePlaza(actor);
    const { page, pageSize, estado, tipo, localId, categoriaId, subcategoriaId, prioridad } =
      query;

    const where: Prisma.solicitudWhereInput = {
      ...(estado ? { estado } : {}),
      ...(tipo ? { tipo } : {}),
      ...(localId ? { local_id: localId } : {}),
      ...(categoriaId ? { categoria_id: categoriaId } : {}),
      ...(subcategoriaId ? { subcategoria_id: subcategoriaId } : {}),
      ...(prioridad ? { prioridad } : {}),
      ...(query.fechaDesde || query.fechaHasta
        ? {
            created_at: {
              ...(query.fechaDesde ? { gte: new Date(query.fechaDesde) } : {}),
              ...(query.fechaHasta ? { lte: new Date(`${query.fechaHasta}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      // Inquilino: SIEMPRE solo las suyas (RN-SO-2).
      ...(actor.rol === 'inquilino' ? { inquilino_id: this.requireInquilino(actor) } : {}),
    };

    const { items, total } = await this.prisma.withTenant(plazaId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.solicitud.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { created_at: 'desc' },
          include: SOLICITUD_INCLUDE,
        }),
        tx.solicitud.count({ where }),
      ]);
      return { items, total };
    });

    return {
      items: items.map((s) => solicitudToListItem(s as SolicitudConRelaciones)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ── Detalle (T-080): + adjuntos + comentarios + historial ─────────────────────

  async findOne(id: string, actor: AuthenticatedUser): Promise<SolicitudDetailOutput> {
    const plazaId = this.requirePlaza(actor);

    const result = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await tx.solicitud.findFirst({
        where: { id },
        include: SOLICITUD_INCLUDE,
      });
      if (!solicitud) return null;
      const [adjuntos, comentarios, historial] = await Promise.all([
        tx.adjunto.findMany({
          where: { entidad_tipo: 'solicitud', entidad_id: id, deleted_at: null },
          orderBy: { created_at: 'desc' },
        }),
        tx.comentario.findMany({
          where: { solicitud_id: id },
          orderBy: { created_at: 'asc' },
          include: { usuario: { select: { id: true, nombre: true, email: true } } },
        }),
        tx.solicitud_historial.findMany({
          where: { solicitud_id: id },
          orderBy: { created_at: 'asc' },
          include: { usuario: { select: { id: true, nombre: true, email: true } } },
        }),
      ]);
      return { solicitud, adjuntos, comentarios, historial };
    });
    if (!result) this.throwNotFound();
    this.assertInquilinoScope(result.solicitud, actor);

    const s = result.solicitud as SolicitudConRelaciones;
    return {
      ...solicitudToListItem(s),
      inquilinoRazonSocial: s.inquilino?.razon_social ?? null,
      usuarioCreador: s.usuario_creador
        ? {
            id: s.usuario_creador.id,
            nombre: s.usuario_creador.nombre,
            email: s.usuario_creador.email,
          }
        : null,
      adjuntos: result.adjuntos.map((a) => ({
        id: a.id,
        plazaId: a.plaza_id,
        entidadTipo: a.entidad_tipo,
        entidadId: a.entidad_id,
        nombreOriginal: a.nombre_original,
        mimeType: a.mime_type,
        tamanoBytes: a.tamano_bytes,
        usuarioSubioId: a.usuario_subio_id,
        createdAt: a.created_at.toISOString(),
      })),
      comentarios: result.comentarios.map(comentarioToOutput),
      historial: result.historial.map(historialToOutput),
    };
  }

  // ── Editar (T-080): solo borrador / requerida_subsanacion ─────────────────────

  async update(
    id: string,
    dto: UpdateSolicitudInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated } = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = await tx.solicitud.findFirst({ where: { id } });
      if (!before) this.throwNotFound();
      this.assertInquilinoScope(before, actor);
      if (before.estado !== 'borrador' && before.estado !== 'requerida_subsanacion') {
        throw new BadRequestException({
          code: 'INVALID_STATE_FOR_EDIT',
          title: 'Solicitud inválida',
          message: `Solo se puede editar en borrador o requerida_subsanacion (actual: ${before.estado}).`,
        });
      }

      // Cambio de local (S-FS-F): permitido solo en estos estados; re-validar.
      if (dto.localId && dto.localId !== before.local_id) {
        await this.assertLocalDelInquilino(tx, dto.localId, before.inquilino_id);
      }

      // T-V22: si el dto activa el modo emergencia (y la solicitud aún no lo
      // tenía), re-validar el límite mensual excluyendo esta misma fila.
      const quiereEmergencia = dto.esEmergencia === true;
      if (quiereEmergencia && !before.es_emergencia) {
        await this.assertLimiteEmergencia(tx, { esEmergencia: true }, before.inquilino_id, id);
      }

      // tipo/camposExtra: validar contra el tipo final.
      const tipoFinal = (dto.tipo ?? before.tipo) as SolicitudTipo;
      let camposExtra: Record<string, unknown> | undefined;
      if (dto.camposExtra !== undefined || dto.tipo !== undefined) {
        camposExtra = await this.aplicarReglasCamposExtra(
          tx,
          plazaId,
          tipoFinal,
          validateCamposExtra(
            tipoFinal,
            dto.camposExtra ?? (before.campos_extra as Record<string, unknown>),
          ),
        );
      }

      // Si cambia subcategoría, re-resolver coherencia y prioridad heredada.
      let prioridad = before.prioridad;
      if (dto.subcategoriaId && dto.subcategoriaId !== before.subcategoria_id) {
        const r = await this.resolverSubcategoria(
          tx,
          tipoFinal,
          dto.categoriaId ?? before.categoria_id ?? undefined,
          dto.subcategoriaId,
        );
        prioridad = r.prioridad;
      }

      const updated = await tx.solicitud.update({
        where: { id },
        data: {
          ...(dto.localId !== undefined ? { local_id: dto.localId } : {}),
          ...(dto.tipo !== undefined ? { tipo: dto.tipo } : {}),
          // T-151 (SEC-6): sanitización server-side contra XSS.
          ...(dto.titulo !== undefined ? { titulo: sanitizePlainText(dto.titulo) } : {}),
          ...(dto.descripcion !== undefined ? { descripcion: sanitizeHtml(dto.descripcion) } : {}),
          ...(dto.categoriaId !== undefined ? { categoria_id: dto.categoriaId } : {}),
          ...(dto.subcategoriaId !== undefined
            ? { subcategoria_id: dto.subcategoriaId, prioridad }
            : {}),
          ...(camposExtra !== undefined
            ? { campos_extra: camposExtra as Prisma.InputJsonValue }
            : {}),
          ...(dto.fechaEventoInicio !== undefined
            ? { fecha_evento_inicio: new Date(dto.fechaEventoInicio) }
            : {}),
          ...(dto.fechaEventoFin !== undefined
            ? { fecha_evento_fin: new Date(dto.fechaEventoFin) }
            : {}),
          ...(dto.horaInicio !== undefined ? { hora_inicio: dto.horaInicio } : {}),
          ...(dto.horaFin !== undefined ? { hora_fin: dto.horaFin } : {}),
          // T-V22: bloque transversal empresa ejecutante + modo emergencia.
          ...(dto.empresaNombre !== undefined
            ? { empresa_nombre: sanitizePlainText(dto.empresaNombre) }
            : {}),
          ...(dto.empresaResponsable !== undefined
            ? { empresa_responsable: sanitizePlainText(dto.empresaResponsable) }
            : {}),
          ...(dto.empresaTelefono !== undefined
            ? { empresa_telefono: sanitizePlainText(dto.empresaTelefono) }
            : {}),
          ...(dto.empresaEmail !== undefined
            ? { empresa_email: sanitizePlainText(dto.empresaEmail) }
            : {}),
          ...(dto.emergenciaContacto !== undefined
            ? { emergencia_contacto: sanitizePlainText(dto.emergenciaContacto) }
            : {}),
          ...(dto.emergenciaTelefono !== undefined
            ? { emergencia_telefono: sanitizePlainText(dto.emergenciaTelefono) }
            : {}),
          ...(dto.esEmergencia !== undefined ? { es_emergencia: dto.esEmergencia } : {}),
        },
      });
      return { before, updated };
    });

    await this.auditoria.record({
      accion: 'solicitud.update',
      entidadTipo: 'solicitud',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: solicitudToOutput(before),
      despues: solicitudToOutput(updated),
      ...meta,
    });
    return solicitudToOutput(updated);
  }

  // ── Transiciones del inquilino (T-081, T-082, T-083 vía state service) ────────

  /** T-081 ajustada T-V03: borrador → enviada (la asignación la hace el cron). */
  async enviar(id: string, actor: AuthenticatedUser, meta: RequestMeta): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);

    const updated = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await tx.solicitud.findFirst({ where: { id } });
      if (!solicitud) this.throwNotFound();
      this.assertInquilinoScope(solicitud, actor);

      // RN-SO-1: el local no debe estar fuera_de_servicio al enviar.
      const local = await tx.local.findFirst({ where: { id: solicitud.local_id } });
      if (!local || local.estado === 'fuera_de_servicio') {
        throw new BadRequestException({
          code: 'LOCAL_NO_DISPONIBLE',
          title: 'Solicitud inválida',
          message: 'El local está fuera de servicio; no se puede enviar la solicitud.',
        });
      }
      // SC-6: si hay subcategoría, debe estar activa y con responsable válido
      // (garantiza que el cron de auto-asignación tendrá a quién asignar).
      if (solicitud.subcategoria_id) {
        const sub = await tx.subcategoria.findFirst({
          where: { id: solicitud.subcategoria_id, activo: true },
        });
        if (!sub) {
          throw new BadRequestException({
            code: 'SUBCATEGORIA_INACTIVA',
            title: 'Solicitud inválida',
            message: 'La subcategoría ya no está activa; selecciona otra antes de enviar.',
          });
        }
        await this.staffValidator.validate(tx, sub.responsable_id, plazaId, 'responsable');
      }

      return this.state.enviar(tx, solicitud, actor);
    });

    await this.auditoria.record({
      accion: 'solicitud.enviar',
      entidadTipo: 'solicitud',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      despues: { estado: updated.estado, enviadaAt: updated.enviada_at },
      ...meta,
    });
    return solicitudToOutput(updated);
  }

  /** T-082: inquilino (dueño) o admin_plaza cancelan cualquier estado no terminal. */
  async cancelar(
    id: string,
    motivo: string | undefined,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);

    const updated = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await tx.solicitud.findFirst({ where: { id } });
      if (!solicitud) this.throwNotFound();
      this.assertInquilinoScope(solicitud, actor);
      return this.state.cancelar(tx, solicitud, actor, motivo);
    });

    await this.auditoria.record({
      accion: 'solicitud.cancelar',
      entidadTipo: 'solicitud',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      despues: { estado: updated.estado, motivo: motivo ?? null },
      ...meta,
    });
    return solicitudToOutput(updated);
  }

  /** T-083 ajustada T-V03: requerida_subsanacion → enviada (vuelve a la cola). */
  async reenviar(
    id: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);

    const updated = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await tx.solicitud.findFirst({ where: { id } });
      if (!solicitud) this.throwNotFound();
      this.assertInquilinoScope(solicitud, actor);
      return this.state.reenviar(tx, solicitud, actor);
    });

    await this.auditoria.record({
      accion: 'solicitud.reenviar',
      entidadTipo: 'solicitud',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      despues: { estado: updated.estado },
      ...meta,
    });
    return solicitudToOutput(updated);
  }

  // ── Duplicar (T-084) ──────────────────────────────────────────────────────────

  async duplicar(
    id: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);
    const inquilinoId = this.requireInquilino(actor);

    const nueva = await this.prisma.withTenant(plazaId, async (tx) => {
      const original = await tx.solicitud.findFirst({ where: { id } });
      if (!original) this.throwNotFound();
      if (original.inquilino_id !== inquilinoId) this.throwNotFound();

      // Prioridad heredada de la subcategoría ACTUAL (puede haber cambiado).
      let prioridad = original.prioridad;
      if (original.subcategoria_id) {
        const sub = await tx.subcategoria.findFirst({
          where: { id: original.subcategoria_id },
        });
        if (sub) prioridad = sub.prioridad;
      }

      const titulo = `Copia de ${original.titulo}`.slice(0, 120);
      const creada = await tx.solicitud.create({
        data: {
          plaza_id: plazaId,
          local_id: original.local_id,
          inquilino_id: inquilinoId,
          usuario_creador_id: actor.sub,
          categoria_id: original.categoria_id,
          subcategoria_id: original.subcategoria_id,
          tipo: original.tipo,
          prioridad,
          titulo,
          descripcion: original.descripcion,
          campos_extra: original.campos_extra as Prisma.InputJsonValue,
          // Fechas y modo emergencia reseteados (T-V22): el duplicado es un
          // nuevo permiso que debe pasar de nuevo por la cola y el límite
          // mensual de emergencias.
          fecha_evento_inicio: null,
          fecha_evento_fin: null,
          hora_inicio: null,
          hora_fin: null,
          es_emergencia: false,
          // El bloque empresa ejecutante SÍ se copia para ahorrar tipeo.
          empresa_nombre: original.empresa_nombre,
          empresa_responsable: original.empresa_responsable,
          empresa_telefono: original.empresa_telefono,
          empresa_email: original.empresa_email,
          emergencia_contacto: original.emergencia_contacto,
          emergencia_telefono: original.emergencia_telefono,
        },
      });
      // Adjuntos: NO se copian (decisión UX, evita fugas entre solicitudes).
      await this.state.insertarHistorial(tx, {
        solicitudId: creada.id,
        plazaId,
        usuarioId: actor.sub,
        evento: 'creada',
        estadoNuevo: 'borrador',
        comentario: `Duplicada de ${original.codigo}`,
      });
      return creada;
    });

    await this.auditoria.record({
      accion: 'solicitud.duplicar',
      entidadTipo: 'solicitud',
      entidadId: nueva.id,
      plazaId,
      usuarioId: actor.sub,
      despues: { duplicadaDe: id, codigo: nueva.codigo },
      ...meta,
    });
    return solicitudToOutput(nueva);
  }

  // ── Prioridad (T-085) ─────────────────────────────────────────────────────────

  /** Solo admin_plaza. No en borrador (prioridad heredada aún no "activada"). */
  async updatePrioridad(
    id: string,
    dto: UpdatePrioridadInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated } = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = await tx.solicitud.findFirst({ where: { id } });
      if (!before) this.throwNotFound();
      if (before.estado === 'borrador' || this.state.esTerminal(before.estado)) {
        throw new BadRequestException({
          code: 'INVALID_STATE_TRANSITION',
          title: 'Solicitud inválida',
          message: `No se puede cambiar la prioridad en estado "${before.estado}".`,
        });
      }
      const updated = await tx.solicitud.update({
        where: { id },
        data: { prioridad: dto.prioridad },
      });
      await this.state.insertarHistorial(tx, {
        solicitudId: id,
        plazaId,
        usuarioId: actor.sub,
        evento: 'prioridad_cambiada',
        comentario: `${before.prioridad} → ${dto.prioridad}`,
      });
      return { before, updated };
    });

    await this.auditoria.record({
      accion: 'solicitud.prioridad',
      entidadTipo: 'solicitud',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: { prioridad: before.prioridad },
      despues: { prioridad: updated.prioridad },
      ...meta,
    });
    return solicitudToOutput(updated);
  }

  // ── Comentarios e historial (T-086) ───────────────────────────────────────────

  async addComentario(
    id: string,
    dto: CreateComentarioInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<ComentarioOutput> {
    const plazaId = this.requirePlaza(actor);
    const esAdmin = actor.rol === 'admin_plaza' || actor.rol === 'superadmin';
    if ((dto.tipo === 'decision' || dto.tipo === 'subsanacion') && !esAdmin) {
      throw new ForbiddenException({
        code: 'COMENTARIO_TIPO_FORBIDDEN',
        title: 'Acceso denegado',
        message: 'Solo un administrador puede crear comentarios de decisión o subsanación.',
      });
    }

    const comentario = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await tx.solicitud.findFirst({ where: { id } });
      if (!solicitud) this.throwNotFound();
      this.assertInquilinoScope(solicitud, actor);
      const comentario = await tx.comentario.create({
        data: {
          plaza_id: plazaId,
          solicitud_id: id,
          usuario_id: actor.sub,
          tipo: dto.tipo,
          cuerpo: sanitizeHtml(dto.cuerpo), // T-151 (SEC-6)
        },
        include: { usuario: { select: { id: true, nombre: true, email: true } } },
      });
      // El historial registra el hecho (timeline); el cuerpo vive en comentario.
      await this.state.insertarHistorial(tx, {
        solicitudId: id,
        plazaId,
        usuarioId: actor.sub,
        evento: 'comentario',
        comentario: dto.cuerpo.slice(0, 500),
      });
      return comentario;
    });

    await this.auditoria.record({
      accion: 'solicitud.comentario',
      entidadTipo: 'comentario',
      entidadId: comentario.id,
      plazaId,
      usuarioId: actor.sub,
      despues: { solicitudId: id, tipo: dto.tipo },
      ...meta,
    });
    return comentarioToOutput(comentario);
  }

  async listComentarios(id: string, actor: AuthenticatedUser): Promise<ComentarioOutput[]> {
    const plazaId = this.requirePlaza(actor);
    const result = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await tx.solicitud.findFirst({ where: { id } });
      if (!solicitud) return null;
      const comentarios = await tx.comentario.findMany({
        where: { solicitud_id: id },
        orderBy: { created_at: 'asc' },
        include: { usuario: { select: { id: true, nombre: true, email: true } } },
      });
      return { solicitud, comentarios };
    });
    if (!result) this.throwNotFound();
    this.assertInquilinoScope(result.solicitud, actor);
    return result.comentarios.map(comentarioToOutput);
  }

  async listHistorial(id: string, actor: AuthenticatedUser): Promise<SolicitudHistorialOutput[]> {
    const plazaId = this.requirePlaza(actor);
    const result = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await tx.solicitud.findFirst({ where: { id } });
      if (!solicitud) return null;
      const historial = await tx.solicitud_historial.findMany({
        where: { solicitud_id: id },
        orderBy: { created_at: 'asc' },
        include: { usuario: { select: { id: true, nombre: true, email: true } } },
      });
      return { solicitud, historial };
    });
    if (!result) this.throwNotFound();
    this.assertInquilinoScope(result.solicitud, actor);
    return result.historial.map(historialToOutput);
  }

  // ── Heurística de duplicados (T-090, S-FS-H) ──────────────────────────────────

  /** Mismo local + tipo, últimos 30 días, estado no terminal. NO bloquea. */
  async findDuplicados(
    query: DuplicadosQuery,
    actor: AuthenticatedUser,
  ): Promise<SolicitudListItem[]> {
    const plazaId = this.requirePlaza(actor);
    const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const items = await this.prisma.withTenant(plazaId, (tx) =>
      tx.solicitud.findMany({
        where: {
          local_id: query.localId,
          tipo: query.tipo,
          created_at: { gte: hace30dias },
          estado: { notIn: ['aprobada', 'rechazada', 'cancelada'] },
          ...(actor.rol === 'inquilino'
            ? { inquilino_id: this.requireInquilino(actor) }
            : {}),
        },
        orderBy: { created_at: 'desc' },
        take: 5,
        include: SOLICITUD_INCLUDE,
      }),
    );
    return items.map((s) => solicitudToListItem(s as SolicitudConRelaciones));
  }

  // ── Validaciones compartidas ──────────────────────────────────────────────────

  /** RN-SO-1: local del inquilino (contrato vigente) y no fuera_de_servicio. */
  private async assertLocalDelInquilino(
    tx: Prisma.TransactionClient,
    localId: string,
    inquilinoId: string,
  ): Promise<void> {
    const local = await tx.local.findFirst({ where: { id: localId, deleted_at: null } });
    if (!local) {
      throw new NotFoundException({
        code: 'LOCAL_NOT_FOUND',
        title: 'Recurso no encontrado',
        message: 'El local no existe.',
      });
    }
    if (local.estado === 'fuera_de_servicio') {
      throw new BadRequestException({
        code: 'LOCAL_NO_DISPONIBLE',
        title: 'Solicitud inválida',
        message: 'El local está fuera de servicio.',
      });
    }
    const contrato = await tx.contrato.findFirst({
      where: { local_id: localId, inquilino_id: inquilinoId, estado: 'vigente' },
    });
    if (!contrato) {
      throw new ForbiddenException({
        code: 'LOCAL_NO_DEL_INQUILINO',
        title: 'Acceso denegado',
        message: 'El local no pertenece al inquilino (no hay contrato vigente).',
      });
    }
  }

  /**
   * Coherencia categoría/subcategoría (T-080, T-V21): obligatorias para TODO
   * tipo de solicitud (antes `otro` estaba exento). Subcategoría debe estar
   * activa y pertenecer a la categoría indicada. Retorna prioridad heredada.
   */
  private async resolverSubcategoria(
    tx: Prisma.TransactionClient,
    tipo: SolicitudTipo,
    categoriaId: string | undefined | null,
    subcategoriaId: string | undefined | null,
  ): Promise<{ prioridad: 'A' | 'B' | 'C' | 'D' | 'F' }> {
    if (!subcategoriaId) {
      throw new BadRequestException({
        code: 'SUBCATEGORIA_REQUERIDA',
        title: 'Solicitud inválida',
        message:
          'categoriaId y subcategoriaId son obligatorios para todo tipo de solicitud (T-V21).',
      });
    }
    const sub = await tx.subcategoria.findFirst({
      where: { id: subcategoriaId, ...(categoriaId ? { categoria_id: categoriaId } : {}) },
    });
    if (!sub) {
      throw new NotFoundException({
        code: 'SUBCATEGORIA_NOT_FOUND',
        title: 'Recurso no encontrado',
        message: 'La subcategoría no existe o no pertenece a la categoría indicada.',
      });
    }
    if (!sub.activo) {
      throw new BadRequestException({
        code: 'SUBCATEGORIA_INACTIVA',
        title: 'Solicitud inválida',
        message: 'La subcategoría está inactiva.',
      });
    }
    return { prioridad: sub.prioridad };
  }

  /**
   * Reglas derivadas de campos_extra (T-079/T-V05): para eventos, marca
   * `requiere_aprobacion_especial` si supera el umbral configurable por plaza.
   */
  private async aplicarReglasCamposExtra(
    tx: Prisma.TransactionClient,
    plazaId: string,
    tipo: SolicitudTipo,
    camposExtra: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (tipo !== 'evento') return camposExtra;
    const config = await tx.configuracion.findUnique({ where: { plaza_id: plazaId } });
    const umbral = config?.aprobacion_especial_asistentes_min ?? 200;
    const asistentes = Number(camposExtra.asistentes_estimados ?? 0);
    return { ...camposExtra, requiere_aprobacion_especial: asistentes > umbral };
  }

  /**
   * T-V22 (S-SO-Emergencia): si dto.esEmergencia está activo, contar cuántas
   * solicitudes de emergencia ha creado este inquilino en el mes actual.
   * Si ya hay 3 (excluyendo la actual si es update), rechaza con 422.
   * RLS de `solicitud` ya filtra por plaza; el conteo se hace además por
   * `inquilino_id` para que cada empresa tenga su propio contador.
   */
  private async assertLimiteEmergencia(
    tx: Prisma.TransactionClient,
    dto: { esEmergencia: boolean },
    inquilinoId: string,
    excludeId?: string,
  ): Promise<void> {
    if (!dto.esEmergencia) return;
    const inicioMes = new Date();
    inicioMes.setUTCDate(1);
    inicioMes.setUTCHours(0, 0, 0, 0);
    const count = await tx.solicitud.count({
      where: {
        inquilino_id: inquilinoId,
        es_emergencia: true,
        created_at: { gte: inicioMes },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (count >= 3) {
      throw new UnprocessableEntityException({
        code: 'PERMISO_EMERGENCIA_LIMITE',
        title: 'Límite de emergencias alcanzado',
        message: 'Solamente tiene un máximo de 3 permisos de emergencia al mes.',
      });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

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

  private requireInquilino(actor: AuthenticatedUser): string {
    if (!actor.inquilinoId) {
      throw new ForbiddenException({
        code: 'INQUILINO_SCOPE_VIOLATION',
        title: 'Acceso denegado',
        message: 'El usuario inquilino no tiene inquilino asociado.',
      });
    }
    return actor.inquilinoId;
  }

  /** Inquilino: solo sus solicitudes (defensa además del filtro y RLS). */
  private assertInquilinoScope(solicitud: SolicitudModel, actor: AuthenticatedUser): void {
    if (actor.rol === 'inquilino' && solicitud.inquilino_id !== this.requireInquilino(actor)) {
      this.throwNotFound();
    }
  }

  private throwNotFound(): never {
    throw new NotFoundException({
      code: 'SOLICITUD_NOT_FOUND',
      title: 'Recurso no encontrado',
      message: 'La solicitud no existe.',
    });
  }
}
