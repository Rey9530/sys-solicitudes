import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { rol_staff as RolStaffModel, Prisma } from '@prisma/client';
import type {
  CreateRolStaffInput,
  UpdateRolStaffInput,
  ListRolesStaffQuery,
  RolStaffOutput,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * CRUD de roles de staff (módulo 1A en docs/03-modulos-del-sistema.md, T-035
 * implementado). Catálogo configurable por plaza que el `admin_plaza` usa para
 * asignar capacidades operativas a sus usuarios `admin_plaza`.
 *
 * Reglas:
 *  - `codigo` único por plaza (constraint `@@unique([plaza_id, codigo])`).
 *  - RN-RS-3: desactivar un `rol_staff` con usuarios asignados NO bloquea, pero
 *    se devuelve `usuariosAsignados > 0` en la respuesta para que el FE advierta.
 *  - Listado: todos los roles autenticados pueden listar; los inactivos solo los
 *    ven `admin_plaza` y `superadmin` (el `inquilino` los consume vía endpoint
 *    filtrado por `activo=true`).
 *  - Scope: toda operación de escritura exige que el rol pertenezca a la plaza
 *    del token (`withTenant`).
 */
@Injectable()
export class RolesStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async create(
    dto: CreateRolStaffInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<RolStaffOutput> {
    const plazaId = this.requirePlaza(actor);

    const rol = await this.prisma
      .withTenant(plazaId, async (tx) => {
        const existente = await tx.rol_staff.findUnique({
          where: { plaza_id_codigo: { plaza_id: plazaId, codigo: dto.codigo } },
        });
        if (existente) {
          throw new ConflictException({
            code: 'ROL_STAFF_CODIGO_DUPLICADO',
            title: 'Conflicto con el estado actual',
            message: `Ya existe un rol de staff con el código "${dto.codigo}" en la plaza.`,
          });
        }
        return tx.rol_staff.create({
          data: {
            plaza_id: plazaId,
            codigo: dto.codigo,
            nombre: dto.nombre,
            descripcion: dto.descripcion ?? null,
          },
        });
      })
      .catch((err: unknown) => {
        const e = err as { code?: string };
        if (e?.code === 'P2002') {
          throw new ConflictException({
            code: 'ROL_STAFF_CODIGO_DUPLICADO',
            title: 'Conflicto con el estado actual',
            message: `Ya existe un rol de staff con el código "${dto.codigo}" en la plaza.`,
          });
        }
        throw err;
      });

    await this.auditoria.record({
      accion: 'rol_staff.create',
      entidadTipo: 'rol_staff',
      entidadId: rol.id,
      plazaId,
      usuarioId: actor.sub,
      despues: this.toOutput(rol),
      ...meta,
    });
    return this.toOutput(rol);
  }

  async findAll(
    query: ListRolesStaffQuery,
    actor: AuthenticatedUser,
  ): Promise<{
    items: RolStaffOutput[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const plazaId = this.requirePlaza(actor);
    const { page, pageSize, activo, search } = query;

    // RN-RP-D: el rol `inquilino` solo ve activos (se filtran los inactivos
    // para que no se filtren en selects de formularios).
    const activoForQuery =
      actor.rol === 'inquilino' ? true : activo;

    const where: Prisma.rol_staffWhereInput = {
      ...(activoForQuery === true ? { activo: true } : {}),
      ...(activoForQuery === false ? { activo: false } : {}),
      ...(search
        ? {
            OR: [
              { codigo: { contains: search, mode: 'insensitive' } },
              { nombre: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const { items, total } = await this.prisma.withTenant(plazaId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.rol_staff.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
        }),
        tx.rol_staff.count({ where }),
      ]);
      return { items, total };
    });

    return {
      items: items.map((r) => this.toOutput(r)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(id: string, actor: AuthenticatedUser): Promise<RolStaffOutput> {
    const plazaId = this.requirePlaza(actor);
    const rol = await this.prisma.withTenant(plazaId, async (tx) => {
      const r = await tx.rol_staff.findFirst({ where: { id } });
      if (!r) {
        throw new NotFoundException({
          code: 'ROL_STAFF_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'El rol de staff no existe en esta plaza.',
        });
      }
      return r;
    });
    return this.toOutput(rol);
  }

  async update(
    id: string,
    dto: UpdateRolStaffInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<RolStaffOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated } = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = await tx.rol_staff.findFirst({ where: { id } });
      if (!before) {
        throw new NotFoundException({
          code: 'ROL_STAFF_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'El rol de staff no existe en esta plaza.',
        });
      }
      const updated = await tx.rol_staff.update({
        where: { id },
        data: {
          ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
          ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion } : {}),
          ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
        },
      });
      return { before, updated };
    });

    await this.auditoria.record({
      accion: 'rol_staff.update',
      entidadTipo: 'rol_staff',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: this.toOutput(before),
      despues: this.toOutput(updated),
      ...meta,
    });
    return this.toOutput(updated);
  }

  /**
   * Soft delete de `rol_staff` (RN-RS-3): si hay usuarios con este rol asignado
   * y activo, el endpoint igual procede (es un "soft" hide) pero devuelve
   * `usuariosAsignados > 0` para que el FE muestre el warning. Los usuarios
   * quedan con un FK inactivo visible en la UI.
   */
  async softDelete(
    id: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<{ rol: RolStaffOutput; usuariosAsignados: number }> {
    const plazaId = this.requirePlaza(actor);

    const result = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = await tx.rol_staff.findFirst({ where: { id } });
      if (!before) {
        throw new NotFoundException({
          code: 'ROL_STAFF_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'El rol de staff no existe en esta plaza.',
        });
      }
      const usuariosAsignados = await tx.usuario.count({
        where: { rol_staff_id: id, deleted_at: null },
      });
      const updated = await tx.rol_staff.update({
        where: { id },
        data: { activo: false },
      });
      return { before, updated, usuariosAsignados };
    });

    await this.auditoria.record({
      accion: 'rol_staff.soft_delete',
      entidadTipo: 'rol_staff',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: this.toOutput(result.before),
      despues: { ...this.toOutput(result.updated), usuariosAsignados: result.usuariosAsignados },
      ...meta,
    });
    return { rol: this.toOutput(result.updated), usuariosAsignados: result.usuariosAsignados };
  }

  /**
   * Devuelve el `rol_staff` activo más un mapa de cuántos usuarios activos lo
   * tienen asignado. Usado por el FE para mostrar advertencias al desactivar.
   */
  async listConAsignaciones(
    actor: AuthenticatedUser,
  ): Promise<Array<RolStaffOutput & { usuariosAsignados: number }>> {
    const plazaId = this.requirePlaza(actor);
    const { items } = await this.prisma.withTenant(plazaId, async (tx) => {
      const roles = await tx.rol_staff.findMany({
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      });
      const counts = await Promise.all(
        roles.map((r) =>
          tx.usuario.count({ where: { rol_staff_id: r.id, deleted_at: null } }),
        ),
      );
      return { items: roles.map((r, i) => ({ r, n: counts[i] ?? 0 })) };
    });
    return items.map(({ r, n }) => ({ ...this.toOutput(r), usuariosAsignados: n }));
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

  private toOutput(r: RolStaffModel): RolStaffOutput {
    return {
      id: r.id,
      plazaId: r.plaza_id,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      activo: r.activo,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    };
  }
}
