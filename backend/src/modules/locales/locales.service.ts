import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, local as LocalModel, contrato as ContratoModel } from '@prisma/client';
import type {
  CreateLocalInput,
  UpdateLocalInput,
  ListLocalesQuery,
  ListContratoHistorialQuery,
  LocalOutput,
  LocalDetailOutput,
  ContratoOutput,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { SolicitudStateService } from '../solicitudes/state/solicitud-state.service';
import { contratoToOutput, ordenarHistorial } from '../contratos/contrato.mapper';
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
 * CRUD de locales (T-051) + historial de contratos por local (T-061).
 *
 * Multi-tenancy: TODAS las queries van por `withTenant(actor.plazaId)` (RLS).
 * El `plaza_id` sale SIEMPRE del JWT, nunca del body. El rol `inquilino` solo
 * ve los locales cubiertos por un contrato vigente suyo (S-LO-B).
 *
 * Reglas de estado (RI-2): `alquilado` solo lo setea el flujo de contratos
 * (T-054); `disponible` no se permite si hay contrato vigente.
 */
@Injectable()
export class LocalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly solicitudState: SolicitudStateService,
  ) {}

  // ── T-108: fuera de servicio + rechazo masivo de solicitudes en curso ─────────
  /**
   * Caso especial docs/05 §5.10.3: si el local baja a `fuera_de_servicio` con
   * solicitudes en curso, el admin puede rechazarlas masivamente con el motivo.
   * Cada rechazo es una transición individual (historial + email).
   * Las solicitudes en `borrador` NO se tocan (el dueño decide); las que están
   * en `enviada`/`asignado` se cancelan con motivo (no hay revisor que rechace)
   * y las `en_revision`/`requerida_subsanacion` se rechazan.
   */
  async fueraDeServicio(
    id: string,
    motivo: string,
    rechazarSolicitudesPendientes: boolean,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<{ local: LocalOutput; solicitudesRechazadas: string[] }> {
    const plazaId = this.requirePlaza(actor);

    const { local, rechazadas } = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = this.assertFound(
        await tx.local.findFirst({ where: { id, deleted_at: null } }),
      );
      const local = await tx.local.update({
        where: { id },
        data: { estado: 'fuera_de_servicio' },
      });

      const rechazadas: string[] = [];
      if (rechazarSolicitudesPendientes) {
        const pendientes = await tx.solicitud.findMany({
          where: {
            local_id: id,
            estado: { in: ['enviada', 'asignado', 'en_revision', 'requerida_subsanacion'] },
          },
          include: { usuario_creador: { select: { email: true, email_invalido: true } } },
        });
        for (const solicitud of pendientes) {
          const comentario = `Local fuera de servicio: ${motivo}`;
          if (solicitud.estado === 'en_revision') {
            // Transición de rechazo formal. SC-4 no aplica (motivo operativo),
            // pero el state service la exige: si el actor creó la solicitud,
            // cae al camino de cancelación.
            if (solicitud.usuario_creador_id !== actor.sub) {
              await this.solicitudState.rechazar(tx, solicitud, actor, comentario);
            } else {
              await this.solicitudState.cancelar(tx, solicitud, actor, comentario);
            }
          } else {
            // enviada/asignado/requerida_subsanacion: no están "en revisión";
            // se cancelan con el motivo (estado terminal igualmente).
            await this.solicitudState.cancelar(tx, solicitud, actor, comentario);
          }
          rechazadas.push(solicitud.codigo);
          if (solicitud.usuario_creador && !solicitud.usuario_creador.email_invalido) {
            await this.solicitudState.enqueueEmail(tx, {
              plazaId,
              destinatario: solicitud.usuario_creador.email,
              plantilla: 'solicitud-rechazada',
              variables: { solicitudCodigo: solicitud.codigo, comentario },
            });
          }
        }
      }

      await this.auditoria.record({
        accion: 'local.fuera_de_servicio',
        entidadTipo: 'local',
        entidadId: id,
        plazaId,
        usuarioId: actor.sub,
        antes: this.toOutput(before),
        despues: { estado: 'fuera_de_servicio', motivo, solicitudesRechazadas: rechazadas },
        ...meta,
      });
      return { local, rechazadas };
    });

    return { local: this.toOutput(local), solicitudesRechazadas: rechazadas };
  }

  // ── Crear (admin_plaza / superadmin con plaza) ────────────────────────────────
  async create(dto: CreateLocalInput, actor: AuthenticatedUser, meta: RequestMeta): Promise<LocalOutput> {
    const plazaId = this.requirePlaza(actor);
    const local = await this.prisma
      .withTenant(plazaId, (tx) =>
        tx.local.create({
          data: {
            plaza_id: plazaId,
            codigo: dto.codigo,
            nombre: dto.nombre ?? null,
            metraje_m2: dto.metrajeM2 ?? null,
            piso: dto.piso ?? null,
            sector: dto.sector ?? null,
            descripcion: dto.descripcion ?? null,
          },
        }),
      )
      .catch((err: unknown) => {
        this.rethrowCodigoDuplicado(err, dto.codigo);
        throw err;
      });

    await this.auditoria.record({
      accion: 'local.create',
      entidadTipo: 'local',
      entidadId: local.id,
      plazaId,
      usuarioId: actor.sub,
      despues: this.toOutput(local),
      ...meta,
    });
    return this.toOutput(local);
  }

  // ── Listar (admin: todos; inquilino: solo con contrato vigente suyo) ──────────
  async findAll(query: ListLocalesQuery, actor: AuthenticatedUser): Promise<Paginated<LocalOutput>> {
    const plazaId = this.requirePlaza(actor);
    const { page, pageSize, estado, piso, sector, search } = query;

    const where: Prisma.localWhereInput = {
      deleted_at: null,
      ...(estado ? { estado } : {}),
      ...(piso ? { piso } : {}),
      ...(sector ? { sector } : {}),
      ...(search
        ? {
            OR: [
              { codigo: { contains: search, mode: 'insensitive' as const } },
              { nombre: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(actor.rol === 'inquilino'
        ? {
            contratos: {
              some: { inquilino_id: this.requireInquilino(actor), estado: 'vigente' as const },
            },
          }
        : {}),
    };

    const { items, total } = await this.prisma.withTenant(plazaId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.local.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { codigo: 'asc' },
        }),
        tx.local.count({ where }),
      ]);
      return { items, total };
    });

    return {
      items: items.map((l) => this.toOutput(l)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ── Detalle + contrato vigente + histórico (T-051) ────────────────────────────
  async findOne(id: string, actor: AuthenticatedUser): Promise<LocalDetailOutput> {
    const plazaId = this.requirePlaza(actor);
    const result = await this.prisma.withTenant(plazaId, async (tx) => {
      const local = await tx.local.findFirst({ where: { id, deleted_at: null } });
      if (!local) return null;
      const contratos = await tx.contrato.findMany({
        where: { local_id: id },
        orderBy: { fecha_inicio: 'desc' },
      });
      return { local, contratos };
    });
    const found = this.assertFound(result?.local ?? null);

    // Inquilino: solo puede ver locales cubiertos por un contrato vigente suyo.
    if (actor.rol === 'inquilino') {
      const inquilinoId = this.requireInquilino(actor);
      const esSuyo = (result?.contratos ?? []).some(
        (c) => c.estado === 'vigente' && c.inquilino_id === inquilinoId,
      );
      if (!esSuyo) this.assertFound(null);
    }

    const historico = ordenarHistorial(result?.contratos ?? []);
    const vigente = historico.find((c) => c.estado === 'vigente') ?? null;
    return {
      ...this.toOutput(found),
      contratoVigente: vigente ? contratoToOutput(vigente) : null,
      historicoContratos: historico.map(contratoToOutput),
    };
  }

  // ── Historial de contratos del local (T-061) ──────────────────────────────────
  async findContratos(
    id: string,
    query: ListContratoHistorialQuery,
    actor: AuthenticatedUser,
  ): Promise<Paginated<ContratoOutput>> {
    const plazaId = this.requirePlaza(actor);
    const { page, pageSize, estado } = query;

    const result = await this.prisma.withTenant(plazaId, async (tx) => {
      const local = await tx.local.findFirst({ where: { id, deleted_at: null } });
      if (!local) return null;
      const contratos = await tx.contrato.findMany({
        where: { local_id: id, ...(estado ? { estado } : {}) },
        orderBy: { fecha_inicio: 'desc' },
      });
      return contratos;
    });
    const contratos = result ?? this.assertFound(null);

    // Orden vigente → finalizado → cancelado (orden enum ≠ orden de negocio).
    const ordenados = ordenarHistorial(contratos as ContratoModel[]);
    const total = ordenados.length;
    const pageItems = ordenados.slice((page - 1) * pageSize, page * pageSize);
    return {
      items: pageItems.map(contratoToOutput),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ── Actualizar (reglas de estado RI-2) ────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateLocalInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<LocalOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated } = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = this.assertFound(
        await tx.local.findFirst({ where: { id, deleted_at: null } }),
      );

      if (dto.estado !== undefined && dto.estado !== before.estado) {
        const vigente = await tx.contrato.findFirst({
          where: { local_id: id, estado: 'vigente' },
        });
        // `alquilado` solo lo setea el flujo de contratos (T-054).
        if (dto.estado === 'alquilado' && !vigente) {
          throw this.invalidStateTransition(
            'No se puede marcar como alquilado manualmente: se setea al crear un contrato vigente.',
          );
        }
        // `disponible` no se permite mientras exista contrato vigente.
        if (dto.estado === 'disponible' && vigente) {
          throw this.invalidStateTransition(
            'No se puede marcar como disponible: el local tiene un contrato vigente.',
          );
        }
      }

      const updated = await tx.local.update({
        where: { id },
        data: {
          ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
          ...(dto.metrajeM2 !== undefined ? { metraje_m2: dto.metrajeM2 } : {}),
          ...(dto.piso !== undefined ? { piso: dto.piso } : {}),
          ...(dto.sector !== undefined ? { sector: dto.sector } : {}),
          ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion } : {}),
          ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
        },
      });
      return { before, updated };
    });

    await this.auditoria.record({
      accion: 'local.update',
      entidadTipo: 'local',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: this.toOutput(before),
      despues: this.toOutput(updated),
      ...meta,
    });
    return this.toOutput(updated);
  }

  // ── Soft delete (sin contrato vigente) ────────────────────────────────────────
  async remove(id: string, actor: AuthenticatedUser, meta: RequestMeta): Promise<void> {
    const plazaId = this.requirePlaza(actor);

    const before = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = this.assertFound(
        await tx.local.findFirst({ where: { id, deleted_at: null } }),
      );
      const vigente = await tx.contrato.findFirst({ where: { local_id: id, estado: 'vigente' } });
      if (vigente) {
        throw new ConflictException({
          code: 'LOCAL_HAS_ACTIVE_CONTRACT',
          title: 'Conflicto con el estado actual',
          message: 'No se puede desactivar un local con contrato vigente.',
        });
      }
      await tx.local.update({ where: { id }, data: { deleted_at: new Date() } });
      return before;
    });

    await this.auditoria.record({
      accion: 'local.delete',
      entidadTipo: 'local',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: this.toOutput(before),
      ...meta,
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  /**
   * Las rutas de negocio de plaza exigen `plazaId` en el JWT. Un superadmin
   * sin plaza no opera locales (la operativa es de admin_plaza) → 403.
   */
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

  private assertFound(local: LocalModel | null): LocalModel {
    if (!local) {
      throw new NotFoundException({
        code: 'LOCAL_NOT_FOUND',
        title: 'Recurso no encontrado',
        message: 'El local no existe.',
      });
    }
    return local;
  }

  private invalidStateTransition(message: string): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_STATE_TRANSITION',
      title: 'Solicitud inválida',
      message,
    });
  }

  /** Mapea P2002 del UNIQUE(plaza_id, codigo) a un 409 de dominio. */
  private rethrowCodigoDuplicado(err: unknown, codigo: string): void {
    const e = err as { code?: string };
    if (e?.code === 'P2002') {
      throw new ConflictException({
        code: 'LOCAL_CODIGO_DUPLICADO',
        title: 'Conflicto con el estado actual',
        message: `Ya existe un local con el código "${codigo}" en la plaza.`,
      });
    }
  }

  private toOutput(l: LocalModel): LocalOutput {
    return {
      id: l.id,
      plazaId: l.plaza_id,
      codigo: l.codigo,
      nombre: l.nombre,
      metrajeM2: l.metraje_m2 === null ? null : Number(l.metraje_m2),
      piso: l.piso,
      sector: l.sector,
      descripcion: l.descripcion,
      estado: l.estado,
      createdAt: l.created_at.toISOString(),
      updatedAt: l.updated_at.toISOString(),
      deletedAt: l.deleted_at?.toISOString() ?? null,
    };
  }
}
