import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  type SolicitudTipoCodigo,
  type SolicitudTipoConfigOutput,
  type UpdateSolicitudTipoConfigInput,
  type ListSolicitudTiposConfigQuery,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { tipoConfigToOutput } from './tipos-solicitud.mapper';
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

/** Estados no terminales de solicitud que cuentan como "activas" para
 *  bloquear la desactivación de un tipo. Incluye `borrador` porque es un
 *  trabajo en curso del inquilino; al cancelar, el conteo baja. */
const SOLICITUD_ESTADOS_NO_TERMINALES = [
  'borrador',
  'enviada',
  'asignado',
  'en_revision',
  'requerida_subsanacion',
] as const;

/**
 * CRUD de configuración por plaza de los tipos de solicitud (T-V20).
 *
 * Reglas de negocio:
 *   - Los 4 `codigo` (`mantenimiento | evento | remodelacion | otro`) son
 *     INMUTABLES: vienen del enum `solicitud_tipo` de PostgreSQL y la
 *     columna `solicitud.tipo` los guarda. La CHECK constraint lo enforce
 *     en BD; el service lo respeta.
 *   - `codigo='otro'` es SIEMPRE activo (regla de app). El service
 *     rechaza cualquier intento de desactivarlo con 409 TIPO_INMUTABLE.
 *   - Un tipo con solicitudes activas (no terminales) NO se puede desactivar:
 *     409 TIPO_CON_SOLICITUDES_ACTIVAS.
 *   - El admin puede editar `etiqueta`, `descripcion`, `orden` y `activo`
 *     libremente. Cambiar `activo` de false→true siempre se permite.
 *
 * Tenant: requiere actor con plaza (requirePlaza). RLS activado en BD.
 */
@Injectable()
export class TiposSolicitudService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ── Listado para wizards / selects (público para inquilino) ───────────────

  /**
   * Devuelve los tipos activos de la plaza actual, ordenados por `orden` ASC,
   * luego `codigo` ASC como desempate estable. Inquilino solo ve activos.
   * Usado por el wizard de nueva solicitud y los filtros de reportes.
   */
  async findAllActivos(actor: AuthenticatedUser): Promise<SolicitudTipoConfigOutput[]> {
    const plazaId = this.requirePlaza(actor);
    const rows = await this.prisma.withTenant(plazaId, (tx) =>
      tx.solicitud_tipo_config.findMany({
        where: { activo: true },
        orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
      }),
    );
    return rows.map(tipoConfigToOutput);
  }

  // ── Listado paginado admin (con filtro activo) ─────────────────────────────

  async findAll(
    query: ListSolicitudTiposConfigQuery,
    actor: AuthenticatedUser,
  ): Promise<Paginated<SolicitudTipoConfigOutput>> {
    const plazaId = this.requirePlaza(actor);
    const { page, pageSize, activo } = query;

    const where: Prisma.solicitud_tipo_configWhereInput = {
      ...(activo !== undefined ? { activo } : {}),
    };

    const { items, total } = await this.prisma.withTenant(plazaId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.solicitud_tipo_config.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
        }),
        tx.solicitud_tipo_config.count({ where }),
      ]);
      return { items, total };
    });

    return {
      items: items.map(tipoConfigToOutput),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ── Detalle ───────────────────────────────────────────────────────────────

  async findOne(id: string, actor: AuthenticatedUser): Promise<SolicitudTipoConfigOutput> {
    const plazaId = this.requirePlaza(actor);
    const row = await this.prisma.withTenant(plazaId, (tx) =>
      tx.solicitud_tipo_config.findFirst({ where: { id } }),
    );
    if (!row) this.throwNotFound();
    return tipoConfigToOutput(row);
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateSolicitudTipoConfigInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SolicitudTipoConfigOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated } = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = await tx.solicitud_tipo_config.findFirst({ where: { id } });
      if (!before) this.throwNotFound();

      if (dto.activo === false && before.activo === true) {
        // Bloquea desactivar `otro`: es el "safety valve" del flujo de
        // solicitud libre (sin categoría). Regla confirmada con el owner.
        if (before.codigo === 'otro') {
          throw new ConflictException({
            code: 'TIPO_INMUTABLE',
            title: 'Conflicto con el estado actual',
            message:
              'El tipo «otro» no se puede desactivar: es el fallback para solicitudes sin categoría.',
          });
        }
        // Bloquea desactivar si hay solicitudes activas del tipo.
        const activas = await tx.solicitud.count({
          where: {
            tipo: before.codigo as SolicitudTipoCodigo,
            estado: { in: [...SOLICITUD_ESTADOS_NO_TERMINALES] },
          },
        });
        if (activas > 0) {
          throw new ConflictException({
            code: 'TIPO_CON_SOLICITUDES_ACTIVAS',
            title: 'Conflicto con el estado actual',
            message: `El tipo «${before.etiqueta}» tiene ${activas} solicitud(es) activa(s). Resuélvelas o cancélalas antes de desactivarlo.`,
          });
        }
      }

      const updated = await tx.solicitud_tipo_config.update({
        where: { id },
        data: {
          ...(dto.etiqueta !== undefined ? { etiqueta: dto.etiqueta } : {}),
          ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion } : {}),
          ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
          ...(dto.orden !== undefined ? { orden: dto.orden } : {}),
        },
      });
      return { before, updated };
    });

    await this.auditoria.record({
      accion: 'tipo_solicitud.update',
      entidadTipo: 'solicitud_tipo_config',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: {
        etiqueta: before.etiqueta,
        descripcion: before.descripcion,
        activo: before.activo,
        orden: before.orden,
      },
      despues: {
        etiqueta: updated.etiqueta,
        descripcion: updated.descripcion,
        activo: updated.activo,
        orden: updated.orden,
      },
      ...meta,
    });
    return tipoConfigToOutput(updated);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

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

  private throwNotFound(): never {
    throw new NotFoundException({
      code: 'TIPO_NOT_FOUND',
      title: 'Recurso no encontrado',
      message: 'El tipo de solicitud no existe.',
    });
  }
}
