import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AuditoriaOutput,
  AuditoriaUsuario,
  ListAuditoriaQuery,
} from '@app/contracts';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

export interface AuditoriaEntry {
  accion: string;
  entidadTipo: string;
  entidadId?: string | null;
  plazaId?: string | null;
  usuarioId?: string | null;
  antes?: unknown;
  despues?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * Registro de auditoría append-only de mutaciones (T-040/T-044).
 *
 * Versión MÍNIMA: inserta vía el admin client (bypassa RLS) de forma best-effort
 * — un fallo de auditoría no debe tumbar la operación de negocio. El trigger
 * no-update/delete, el interceptor automático y la retención son T-146/T-150.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prismaAdmin: PrismaAdminService) {}

  async record(entry: AuditoriaEntry): Promise<void> {
    try {
      await this.prismaAdmin.auditoria.create({
        data: {
          accion: entry.accion,
          entidad_tipo: entry.entidadTipo,
          entidad_id: entry.entidadId ?? null,
          plaza_id: entry.plazaId ?? null,
          usuario_id: entry.usuarioId ?? null,
          antes:
            entry.antes === undefined
              ? Prisma.JsonNull
              : (entry.antes as Prisma.InputJsonValue),
          despues:
            entry.despues === undefined
              ? Prisma.JsonNull
              : (entry.despues as Prisma.InputJsonValue),
          ip: entry.ip ?? null,
          user_agent: entry.userAgent ?? null,
          request_id: entry.requestId ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`No se pudo registrar auditoría (${entry.accion}): ${String(err)}`);
    }
  }

  /**
   * T-146 (decisión owner): consulta del log. `admin_plaza` ve SOLO su plaza
   * (filtro explícito sobre el admin client — la tabla guarda plaza_id NULL
   * para acciones de plataforma, que solo ve superadmin).
   */
  async findAll(
    query: ListAuditoriaQuery,
    actor: AuthenticatedUser,
  ): Promise<{
    items: AuditoriaOutput[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { page, pageSize } = query;
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.fechaDesde) createdAt.gte = new Date(`${query.fechaDesde}T00:00:00.000Z`);
    if (query.fechaHasta) createdAt.lt = new Date(`${query.fechaHasta}T24:00:00.000Z`);

    const where: Prisma.auditoriaWhereInput = {
      // Scope multi-tenant: admin_plaza solo su plaza; superadmin todas (sin
      // plaza elegida) o la plaza seleccionada (impersonación, actor.plazaId set).
      ...(actor.rol === 'superadmin' && !actor.plazaId
        ? {}
        : { plaza_id: this.requirePlaza(actor) }),
      ...(query.accion ? { accion: { contains: query.accion, mode: 'insensitive' } } : {}),
      ...(query.entidadTipo ? { entidad_tipo: query.entidadTipo } : {}),
      ...(query.entidadId ? { entidad_id: query.entidadId } : {}),
      ...(query.usuarioId ? { usuario_id: query.usuarioId } : {}),
      ...(query.fechaDesde || query.fechaHasta ? { created_at: createdAt } : {}),
    };

    const [items, total] = await Promise.all([
      this.prismaAdmin.auditoria.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prismaAdmin.auditoria.count({ where }),
    ]);

    // T-161: join batch con `usuario` para evitar N+1 en el frontend. Una sola
    // query por página (≤ 20 ids). Si no hay items, no se ejecuta.
    const usuarioIds = Array.from(
      new Set(items.map((a) => a.usuario_id).filter((id): id is string => Boolean(id))),
    );
    const usuariosById = new Map<string, AuditoriaUsuario>();
    if (usuarioIds.length > 0) {
      const usuarios = await this.prismaAdmin.usuario.findMany({
        where: { id: { in: usuarioIds } },
        select: { id: true, nombre: true, email: true },
      });
      for (const u of usuarios) {
        usuariosById.set(u.id, { id: u.id, nombre: u.nombre, email: u.email });
      }
    }

    return {
      items: items.map((a) => ({
        id: a.id,
        plazaId: a.plaza_id,
        usuarioId: a.usuario_id,
        usuario: a.usuario_id ? (usuariosById.get(a.usuario_id) ?? null) : null,
        accion: a.accion,
        entidadTipo: a.entidad_tipo,
        entidadId: a.entidad_id,
        antes: a.antes,
        despues: a.despues,
        ip: a.ip,
        userAgent: a.user_agent,
        requestId: a.request_id,
        createdAt: a.created_at.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private requirePlaza(actor: AuthenticatedUser): string {
    if (!actor.plazaId) {
      throw new ForbiddenException({
        code: 'PLAZA_SCOPE_VIOLATION',
        title: 'Acceso denegado',
        message: 'La consulta de auditoría requiere un usuario con plaza asignada.',
      });
    }
    return actor.plazaId;
  }
}
