import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AsignarPermisosInput,
  ListarPermisosOutput,
  PermisoOutput,
  PermisosPorModulo,
  RolPermisosOutput,
} from '@app/contracts';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * T-RBAC-1: Servicio del módulo de permisos.
 *
 * Endpoints:
 *  - GET    /permisos                                → catálogo global agrupado por módulo.
 *  - GET    /permisos/roles/:rolStaffId              → permisos asignados a un rol.
 *  - PUT    /permisos/roles/:rolStaffId              → reemplaza el set de permisos del rol.
 *  - POST   /permisos/roles/:rolStaffId/permisos/:id → asigna un permiso individual.
 *  - DELETE /permisos/roles/:rolStaffId/permisos/:id → quita un permiso individual.
 *
 * Reglas:
 *  - El catálogo `permiso` es GLOBAL (sin plaza_id, sin RLS); se lee con el
 *    admin client. La visibilidad se aplica en `@Roles` decorator.
 *  - El pivote `rol_staff_permiso` lleva RLS por plaza (heredada de `rol_staff`);
 *    se lee/escribe con `withTenant`.
 *  - Roles `es_sistema=true` (rol "admin" del sistema) NO admiten edición de
 *    permisos: el backend rechaza con `ROL_SISTEMA_NO_MODIFICABLE` y la BD
 *    tiene un trigger `fn_rol_staff_sistema_inamovible` que blinda `codigo`,
 *    `nombre` y `plaza_id` (los permisos del pivote se pueden leer pero la
 *    asignación vía API está bloqueada).
 *  - Toda mutación registra en `auditoria` (entidad_tipo = 'rol_staff_permiso').
 */
@Injectable()
export class PermisosService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Catálogo global de permisos agrupado por módulo (para la matriz UI). */
  async listarCatalogo(): Promise<ListarPermisosOutput> {
    const permisos = await this.prismaAdmin.permiso.findMany({
      orderBy: [{ modulo: 'asc' }, { accion: 'asc' }],
    });
    const porModulo = new Map<string, PermisoOutput[]>();
    for (const p of permisos) {
      const arr = porModulo.get(p.modulo) ?? [];
      arr.push(this.toPermisoOutput(p));
      porModulo.set(p.modulo, arr);
    }
    const modulos: PermisosPorModulo[] = Array.from(porModulo.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([modulo, perms]) => ({ modulo, permisos: perms }));
    return { total: permisos.length, modulos };
  }

  /** Permisos efectivos de un rol concreto. */
  async listarDeRol(
    rolStaffId: string,
    actor: AuthenticatedUser,
  ): Promise<RolPermisosOutput> {
    const plazaId = this.requirePlaza(actor);
    const { rol, permisos } = await this.prisma.withTenant(plazaId, async (tx) => {
      const rol = await tx.rol_staff.findFirst({ where: { id: rolStaffId } });
      if (!rol) {
        throw new NotFoundException({
          code: 'ROL_STAFF_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'El rol de staff no existe en esta plaza.',
        });
      }
      const pivote = await tx.rol_staff_permiso.findMany({
        where: { rol_staff_id: rolStaffId },
        include: { permiso: true },
        orderBy: { permiso: { modulo: 'asc' } },
      });
      return {
        rol,
        permisos: pivote.map((r) => this.toPermisoOutput(r.permiso)),
      };
    });
    return {
      rolStaffId: rol.id,
      esSistema: rol.es_sistema,
      permisos,
    };
  }

  /**
   * Reemplaza el set completo de permisos del rol. PUT = idempotente.
   * Falla si el rol es `es_sistema` (inamovible). El seed siempre le asigna
   * TODOS los permisos del catálogo al rol "admin" y este endpoint no debe
   * usarse para revocarlos.
   */
  async asignarPermisos(
    rolStaffId: string,
    input: AsignarPermisosInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<RolPermisosOutput> {
    const plazaId = this.requirePlaza(actor);

    const { rol, antes, despues } = await this.prisma.withTenant(
      plazaId,
      async (tx) => {
        const rol = await tx.rol_staff.findFirst({ where: { id: rolStaffId } });
        if (!rol) {
          throw new NotFoundException({
            code: 'ROL_STAFF_NO_ENCONTRADO',
            title: 'Recurso no encontrado',
            message: 'El rol de staff no existe en esta plaza.',
          });
        }
        if (rol.es_sistema) {
          throw new ForbiddenException({
            code: 'ROL_SISTEMA_NO_MODIFICABLE',
            title: 'Acceso denegado',
            message:
              'El rol del sistema es inamovible. No se pueden modificar sus permisos desde la API.',
          });
        }

        // Snapshot antes para auditoría (solo códigos para no inflar el log).
        const pivoteAntes = await tx.rol_staff_permiso.findMany({
          where: { rol_staff_id: rolStaffId },
          include: { permiso: { select: { codigo: true } } },
        });
        const antesCodigos = pivoteAntes.map((p) => p.permiso.codigo).sort();

        // Validar que todos los permisoIds existen (FK ya lo hace, pero
        // queremos un error 404 limpio si alguno es inválido).
        if (input.permisoIds.length > 0) {
          const existentes = await tx.permiso.findMany({
            where: { id: { in: input.permisoIds } },
            select: { id: true },
          });
          const existentesSet = new Set(existentes.map((p) => p.id));
          const faltantes = input.permisoIds.filter((id: string) => !existentesSet.has(id));
          if (faltantes.length > 0) {
            throw new NotFoundException({
              code: 'PERMISO_NO_ENCONTRADO',
              title: 'Recurso no encontrado',
              message: `Algunos permisos no existen: ${faltantes.join(', ')}`,
            });
          }
        }

        // Reemplazo atómico: borrar y recrear en una transacción. Prisma no
        // soporta deleteMany + createMany en la misma operación sin pasar por
        // un `interactive transaction`, pero `withTenant` ya abre una.
        await tx.rol_staff_permiso.deleteMany({ where: { rol_staff_id: rolStaffId } });
        if (input.permisoIds.length > 0) {
          await tx.rol_staff_permiso.createMany({
            data: input.permisoIds.map((permisoId: string) => ({
              rol_staff_id: rolStaffId,
              permiso_id: permisoId,
              plaza_id: plazaId,
              otorgado_por: actor.sub,
            })),
            skipDuplicates: true,
          });
        }

        const pivoteDespues = await tx.rol_staff_permiso.findMany({
          where: { rol_staff_id: rolStaffId },
          include: { permiso: true },
          orderBy: { permiso: { modulo: 'asc' } },
        });
        const despuesCodigos = pivoteDespues.map((p) => p.permiso.codigo).sort();

        return {
          rol,
          antes: antesCodigos,
          despues: { codigos: despuesCodigos, items: pivoteDespues.map((p) => this.toPermisoOutput(p.permiso)) },
        };
      },
    );

    await this.auditoria.record({
      accion: 'rol_staff.permisos.replace',
      entidadTipo: 'rol_staff_permiso',
      entidadId: rol.id,
      plazaId,
      usuarioId: actor.sub,
      antes: { permisos: antes },
      despues: { permisos: despues.codigos },
      ...meta,
    });

    return {
      rolStaffId: rol.id,
      esSistema: rol.es_sistema,
      permisos: despues.items,
    };
  }

  /** Asigna un permiso individual al rol (helper deprecado por la matriz; mantenido para flexibilidad). */
  async agregarPermiso(
    rolStaffId: string,
    permisoId: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<RolPermisosOutput> {
    const plazaId = this.requirePlaza(actor);

    await this.prisma.withTenant(plazaId, async (tx) => {
      const rol = await tx.rol_staff.findFirst({ where: { id: rolStaffId } });
      if (!rol) {
        throw new NotFoundException({
          code: 'ROL_STAFF_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'El rol de staff no existe en esta plaza.',
        });
      }
      if (rol.es_sistema) {
        throw new ForbiddenException({
          code: 'ROL_SISTEMA_NO_MODIFICABLE',
          title: 'Acceso denegado',
          message: 'El rol del sistema es inamovible.',
        });
      }
      const permiso = await tx.permiso.findFirst({ where: { id: permisoId } });
      if (!permiso) {
        throw new NotFoundException({
          code: 'PERMISO_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'El permiso no existe en el catálogo.',
        });
      }
      await tx.rol_staff_permiso.upsert({
        where: { rol_staff_id_permiso_id: { rol_staff_id: rolStaffId, permiso_id: permisoId } },
        update: {},
        create: {
          rol_staff_id: rolStaffId,
          permiso_id: permisoId,
          plaza_id: plazaId,
          otorgado_por: actor.sub,
        },
      });
    });

    await this.auditoria.record({
      accion: 'rol_staff.permisos.add',
      entidadTipo: 'rol_staff_permiso',
      entidadId: `${rolStaffId}:${permisoId}`,
      plazaId,
      usuarioId: actor.sub,
      despues: { permisoId },
      ...meta,
    });

    return this.listarDeRol(rolStaffId, actor);
  }

  /** Quita un permiso individual al rol. Falla si el rol es `es_sistema`. */
  async quitarPermiso(
    rolStaffId: string,
    permisoId: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<RolPermisosOutput> {
    const plazaId = this.requirePlaza(actor);

    await this.prisma.withTenant(plazaId, async (tx) => {
      const rol = await tx.rol_staff.findFirst({ where: { id: rolStaffId } });
      if (!rol) {
        throw new NotFoundException({
          code: 'ROL_STAFF_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'El rol de staff no existe en esta plaza.',
        });
      }
      if (rol.es_sistema) {
        throw new ForbiddenException({
          code: 'ROL_SISTEMA_NO_MODIFICABLE',
          title: 'Acceso denegado',
          message: 'El rol del sistema es inamovible.',
        });
      }
      await tx.rol_staff_permiso.deleteMany({
        where: { rol_staff_id: rolStaffId, permiso_id: permisoId },
      });
    });

    await this.auditoria.record({
      accion: 'rol_staff.permisos.remove',
      entidadTipo: 'rol_staff_permiso',
      entidadId: `${rolStaffId}:${permisoId}`,
      plazaId,
      usuarioId: actor.sub,
      antes: { permisoId },
      ...meta,
    });

    return this.listarDeRol(rolStaffId, actor);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  private toPermisoOutput(p: {
    id: string;
    codigo: string;
    modulo: string;
    accion: string;
    descripcion: string | null;
    created_at: Date;
  }): PermisoOutput {
    return {
      id: p.id,
      codigo: p.codigo,
      modulo: p.modulo,
      accion: p.accion,
      descripcion: p.descripcion,
      createdAt: p.created_at.toISOString(),
    };
  }
}