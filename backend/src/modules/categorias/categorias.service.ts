import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CreateCategoriaInput,
  UpdateCategoriaInput,
  ListCategoriasQuery,
  CategoriaOutput,
  CategoriaDetailOutput,
  CreateSubcategoriaInput,
  UpdateSubcategoriaInput,
  ListSubcategoriasQuery,
  SubcategoriaDetailOutput,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { SolicitudStateService } from '../solicitudes/state/solicitud-state.service';
import { StaffForSubcategoriaValidator } from './validators/staff-for-subcategoria.validator';
import {
  categoriaToOutput,
  subcategoriaToDetail,
  type SubcategoriaConRelaciones,
} from './categoria.mapper';
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

/** Include estándar para mapear subcategorías con responsable y supervisores. */
const SUBCATEGORIA_INCLUDE = {
  responsable: { select: { id: true, nombre: true, email: true } },
  supervisores: {
    include: { usuario: { select: { id: true, nombre: true, email: true } } },
    orderBy: { created_at: 'asc' as const },
  },
} satisfies Prisma.subcategoriaInclude;

/**
 * CRUD de categorías (T-067) y subcategorías (T-068) + responsable (T-069)
 * + supervisores (T-070).
 *
 * Reglas:
 *  - admin_plaza/superadmin escriben; inquilino solo lee activos (RN-CA-1).
 *  - Soft delete vía `activo=false`. Desactivar categoría con subcategorías
 *    activas → 400 CATEGORIA_HAS_ACTIVE_SUBCATEGORIAS (RN-CA-2).
 *  - SC-6 (T-071): responsable y supervisores validados por el validator.
 *  - Máx 5 supervisores: trigger tg_subcategoria_max_5_supervisores (T-066)
 *    → se mapea a 409 SUBCATEGORIA_MAX_5_SUPERVISORES.
 *  - T-069 (⚠️ T-V04): el cambio de responsable reasigna TODAS las solicitudes
 *    activas; esa parte se implementa en el módulo 07 (las tablas de solicitud
 *    no existen aún). Aquí solo se actualiza `responsable_id`.
 */
@Injectable()
export class CategoriasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly staffValidator: StaffForSubcategoriaValidator,
    private readonly solicitudState: SolicitudStateService,
  ) {}

  // ── Categorías ────────────────────────────────────────────────────────────────

  async createCategoria(
    dto: CreateCategoriaInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<CategoriaOutput> {
    const plazaId = this.requirePlaza(actor);

    const categoria = await this.prisma
      .withTenant(plazaId, (tx) =>
        tx.categoria.create({
          data: { plaza_id: plazaId, nombre: dto.nombre, descripcion: dto.descripcion ?? null },
        }),
      )
      .catch((err: unknown) => {
        this.rethrowNombreDuplicado(err, 'CATEGORIA_NOMBRE_DUPLICADO');
        throw err;
      });

    await this.auditoria.record({
      accion: 'categoria.create',
      entidadTipo: 'categoria',
      entidadId: categoria.id,
      plazaId,
      usuarioId: actor.sub,
      despues: categoriaToOutput(categoria),
      ...meta,
    });
    return categoriaToOutput(categoria);
  }

  async findAllCategorias(
    query: ListCategoriasQuery,
    actor: AuthenticatedUser,
  ): Promise<Paginated<CategoriaOutput>> {
    const plazaId = this.requirePlaza(actor);
    const { page, pageSize, search } = query;
    // Inquilino: SIEMPRE solo activas (ignora el filtro del query).
    const activo = actor.rol === 'inquilino' ? true : query.activo;

    const where: Prisma.categoriaWhereInput = {
      ...(activo !== undefined ? { activo } : {}),
      ...(search ? { nombre: { contains: search, mode: 'insensitive' } } : {}),
    };

    const { items, total } = await this.prisma.withTenant(plazaId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.categoria.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { nombre: 'asc' },
        }),
        tx.categoria.count({ where }),
      ]);
      return { items, total };
    });

    return {
      items: items.map(categoriaToOutput),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOneCategoria(id: string, actor: AuthenticatedUser): Promise<CategoriaDetailOutput> {
    const plazaId = this.requirePlaza(actor);

    const categoria = await this.prisma.withTenant(plazaId, (tx) =>
      tx.categoria.findFirst({
        where: { id, ...(actor.rol === 'inquilino' ? { activo: true } : {}) },
        include: {
          subcategorias: {
            // Detalle muestra las subcategorías activas (T-067); el admin ve
            // todas desde el listado dedicado (T-068).
            where: { activo: true },
            include: SUBCATEGORIA_INCLUDE,
            orderBy: { nombre: 'asc' },
          },
        },
      }),
    );
    if (!categoria) this.throwNotFound('CATEGORIA_NOT_FOUND', 'La categoría no existe.');

    return {
      ...categoriaToOutput(categoria),
      subcategorias: categoria.subcategorias.map((s) =>
        subcategoriaToDetail(s as SubcategoriaConRelaciones),
      ),
    };
  }

  async updateCategoria(
    id: string,
    dto: UpdateCategoriaInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<CategoriaOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated } = await this.prisma
      .withTenant(plazaId, async (tx) => {
        const before = await tx.categoria.findFirst({ where: { id } });
        if (!before) this.throwNotFound('CATEGORIA_NOT_FOUND', 'La categoría no existe.');
        if (dto.activo === false) await this.assertSinSubcategoriasActivas(tx, id);
        const updated = await tx.categoria.update({
          where: { id },
          data: {
            ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
            ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion } : {}),
            ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
          },
        });
        return { before, updated };
      })
      .catch((err: unknown) => {
        this.rethrowNombreDuplicado(err, 'CATEGORIA_NOMBRE_DUPLICADO');
        throw err;
      });

    await this.auditoria.record({
      accion: 'categoria.update',
      entidadTipo: 'categoria',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: categoriaToOutput(before),
      despues: categoriaToOutput(updated),
      ...meta,
    });
    return categoriaToOutput(updated);
  }

  /** Soft delete: `activo=false`. Bloqueado si tiene subcategorías activas. */
  async deleteCategoria(
    id: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<CategoriaOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated } = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = await tx.categoria.findFirst({ where: { id } });
      if (!before) this.throwNotFound('CATEGORIA_NOT_FOUND', 'La categoría no existe.');
      await this.assertSinSubcategoriasActivas(tx, id);
      const updated = await tx.categoria.update({ where: { id }, data: { activo: false } });
      return { before, updated };
    });

    await this.auditoria.record({
      accion: 'categoria.delete',
      entidadTipo: 'categoria',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: categoriaToOutput(before),
      despues: categoriaToOutput(updated),
      ...meta,
    });
    return categoriaToOutput(updated);
  }

  // ── Subcategorías ─────────────────────────────────────────────────────────────

  async createSubcategoria(
    categoriaId: string,
    dto: CreateSubcategoriaInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SubcategoriaDetailOutput> {
    const plazaId = this.requirePlaza(actor);

    const subcategoria = await this.prisma
      .withTenant(plazaId, async (tx) => {
        const categoria = await tx.categoria.findFirst({
          where: { id: categoriaId, activo: true },
        });
        if (!categoria) this.throwNotFound('CATEGORIA_NOT_FOUND', 'La categoría no existe.');

        await this.staffValidator.validate(tx, dto.responsableId, plazaId, 'responsable');
        const supervisorIds = [...new Set(dto.supervisorIds)];
        for (const supervisorId of supervisorIds) {
          await this.staffValidator.validate(tx, supervisorId, plazaId, 'supervisor');
        }

        const sub = await tx.subcategoria.create({
          data: {
            plaza_id: plazaId,
            categoria_id: categoriaId,
            responsable_id: dto.responsableId,
            nombre: dto.nombre,
            descripcion: dto.descripcion ?? null,
            prioridad: dto.prioridad,
          },
        });
        // Insert secuencial: el trigger T-066 cuenta fila a fila.
        for (const usuarioId of supervisorIds) {
          await tx.subcategoria_supervisor.create({
            data: { subcategoria_id: sub.id, usuario_id: usuarioId },
          });
        }
        return tx.subcategoria.findUniqueOrThrow({
          where: { id: sub.id },
          include: SUBCATEGORIA_INCLUDE,
        });
      })
      .catch((err: unknown) => {
        this.rethrowMax5(err);
        this.rethrowNombreDuplicado(err, 'SUBCATEGORIA_NOMBRE_DUPLICADO');
        throw err;
      });

    const output = subcategoriaToDetail(subcategoria as SubcategoriaConRelaciones);
    await this.auditoria.record({
      accion: 'subcategoria.create',
      entidadTipo: 'subcategoria',
      entidadId: subcategoria.id,
      plazaId,
      usuarioId: actor.sub,
      despues: output,
      ...meta,
    });
    return output;
  }

  async findAllSubcategorias(
    categoriaId: string,
    query: ListSubcategoriasQuery,
    actor: AuthenticatedUser,
  ): Promise<Paginated<SubcategoriaDetailOutput>> {
    const plazaId = this.requirePlaza(actor);
    const { page, pageSize, search } = query;
    const activo = actor.rol === 'inquilino' ? true : query.activo;

    const where: Prisma.subcategoriaWhereInput = {
      categoria_id: categoriaId,
      ...(activo !== undefined ? { activo } : {}),
      ...(search ? { nombre: { contains: search, mode: 'insensitive' } } : {}),
    };

    const { items, total } = await this.prisma.withTenant(plazaId, async (tx) => {
      const categoria = await tx.categoria.findFirst({ where: { id: categoriaId } });
      if (!categoria) this.throwNotFound('CATEGORIA_NOT_FOUND', 'La categoría no existe.');
      const [items, total] = await Promise.all([
        tx.subcategoria.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { nombre: 'asc' },
          include: SUBCATEGORIA_INCLUDE,
        }),
        tx.subcategoria.count({ where }),
      ]);
      return { items, total };
    });

    return {
      items: items.map((s) => subcategoriaToDetail(s as SubcategoriaConRelaciones)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOneSubcategoria(
    categoriaId: string,
    subId: string,
    actor: AuthenticatedUser,
  ): Promise<SubcategoriaDetailOutput> {
    const plazaId = this.requirePlaza(actor);

    const sub = await this.prisma.withTenant(plazaId, (tx) =>
      tx.subcategoria.findFirst({
        where: {
          id: subId,
          categoria_id: categoriaId,
          ...(actor.rol === 'inquilino' ? { activo: true } : {}),
        },
        include: SUBCATEGORIA_INCLUDE,
      }),
    );
    if (!sub) this.throwNotFound('SUBCATEGORIA_NOT_FOUND', 'La subcategoría no existe.');
    return subcategoriaToDetail(sub as SubcategoriaConRelaciones);
  }

  async updateSubcategoria(
    categoriaId: string,
    subId: string,
    dto: UpdateSubcategoriaInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SubcategoriaDetailOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated } = await this.prisma
      .withTenant(plazaId, async (tx) => {
        const before = await this.assertSubcategoria(tx, categoriaId, subId);
        const updated = await tx.subcategoria.update({
          where: { id: subId },
          data: {
            ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
            ...(dto.descripcion !== undefined ? { descripcion: dto.descripcion } : {}),
            ...(dto.prioridad !== undefined ? { prioridad: dto.prioridad } : {}),
            ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
          },
          include: SUBCATEGORIA_INCLUDE,
        });
        return { before, updated };
      })
      .catch((err: unknown) => {
        this.rethrowNombreDuplicado(err, 'SUBCATEGORIA_NOMBRE_DUPLICADO');
        throw err;
      });

    const output = subcategoriaToDetail(updated as SubcategoriaConRelaciones);
    await this.auditoria.record({
      accion: 'subcategoria.update',
      entidadTipo: 'subcategoria',
      entidadId: subId,
      plazaId,
      usuarioId: actor.sub,
      antes: { responsableId: before.responsable_id, nombre: before.nombre, activo: before.activo },
      despues: output,
      ...meta,
    });
    return output;
  }

  /** Soft delete (`activo=false`): no se usa en nuevas solicitudes. */
  async deleteSubcategoria(
    categoriaId: string,
    subId: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SubcategoriaDetailOutput> {
    const plazaId = this.requirePlaza(actor);

    const updated = await this.prisma.withTenant(plazaId, async (tx) => {
      await this.assertSubcategoria(tx, categoriaId, subId);
      return tx.subcategoria.update({
        where: { id: subId },
        data: { activo: false },
        include: SUBCATEGORIA_INCLUDE,
      });
    });

    const output = subcategoriaToDetail(updated as SubcategoriaConRelaciones);
    await this.auditoria.record({
      accion: 'subcategoria.delete',
      entidadTipo: 'subcategoria',
      entidadId: subId,
      plazaId,
      usuarioId: actor.sub,
      despues: output,
      ...meta,
    });
    return output;
  }

  // ── Responsable (T-069) ───────────────────────────────────────────────────────

  /**
   * Cambia el responsable de la subcategoría.
   *
   * T-V04 (módulo 07): reasigna TODAS las solicitudes activas con asignado
   * (`asignado` y `en_revision` — sí, también las en revisión) al nuevo
   * responsable, con historial `reasignada` y email por cada una. Las
   * `enviada`/`requerida_subsanacion` no tienen asignado: el cron de
   * auto-asignación ya usará al nuevo responsable.
   */
  async setResponsable(
    categoriaId: string,
    subId: string,
    responsableId: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SubcategoriaDetailOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated, reasignadas } = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = await this.assertSubcategoria(tx, categoriaId, subId);
      await this.staffValidator.validate(tx, responsableId, plazaId, 'responsable');
      const updated = await tx.subcategoria.update({
        where: { id: subId },
        data: { responsable_id: responsableId },
        include: SUBCATEGORIA_INCLUDE,
      });

      // T-V04: reasignación masiva en la MISMA transacción.
      const activas = await tx.solicitud.findMany({
        where: {
          subcategoria_id: subId,
          estado: { in: ['asignado', 'en_revision'] },
          NOT: { admin_asignado_id: responsableId },
        },
      });
      const nuevo = await tx.usuario.findFirst({ where: { id: responsableId } });
      for (const solicitud of activas) {
        await this.solicitudState.reasignar(
          tx,
          solicitud,
          null,
          responsableId,
          'Cambio de responsable de subcategoría',
        );
        if (nuevo && !nuevo.email_invalido) {
          await this.solicitudState.enqueueEmail(tx, {
            plazaId,
            destinatario: nuevo.email,
            plantilla: 'solicitud-reasignada',
            solicitudId: solicitud.id,
            variables: {
              solicitudCodigo: solicitud.codigo,
              solicitudTitulo: solicitud.titulo,
              motivo: 'Cambio de responsable de subcategoría',
            },
          });
        }
      }
      return { before, updated, reasignadas: activas.length };
    });

    const output = subcategoriaToDetail(updated as SubcategoriaConRelaciones);
    await this.auditoria.record({
      accion: 'subcategoria.set_responsable',
      entidadTipo: 'subcategoria',
      entidadId: subId,
      plazaId,
      usuarioId: actor.sub,
      antes: { responsableId: before.responsable_id },
      despues: { responsableId, solicitudesReasignadas: reasignadas },
      ...meta,
    });
    return output;
  }

  // ── Supervisores (T-070) ──────────────────────────────────────────────────────

  /** Agrega un supervisor. Idempotente: si ya existe, retorna el estado actual. */
  async addSupervisor(
    categoriaId: string,
    subId: string,
    usuarioId: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SubcategoriaDetailOutput> {
    const plazaId = this.requirePlaza(actor);

    const { updated, created } = await this.prisma
      .withTenant(plazaId, async (tx) => {
        await this.assertSubcategoria(tx, categoriaId, subId);
        const existente = await tx.subcategoria_supervisor.findUnique({
          where: { subcategoria_id_usuario_id: { subcategoria_id: subId, usuario_id: usuarioId } },
        });
        let created = false;
        if (!existente) {
          await this.staffValidator.validate(tx, usuarioId, plazaId, 'supervisor');
          await tx.subcategoria_supervisor.create({
            data: { subcategoria_id: subId, usuario_id: usuarioId },
          });
          created = true;
        }
        const updated = await tx.subcategoria.findUniqueOrThrow({
          where: { id: subId },
          include: SUBCATEGORIA_INCLUDE,
        });
        return { updated, created };
      })
      .catch((err: unknown) => {
        this.rethrowMax5(err);
        throw err;
      });

    if (created) {
      await this.auditoria.record({
        accion: 'subcategoria.add_supervisor',
        entidadTipo: 'subcategoria',
        entidadId: subId,
        plazaId,
        usuarioId: actor.sub,
        despues: { supervisorId: usuarioId },
        ...meta,
      });
    }
    return subcategoriaToDetail(updated as SubcategoriaConRelaciones);
  }

  async removeSupervisor(
    categoriaId: string,
    subId: string,
    usuarioId: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<SubcategoriaDetailOutput> {
    const plazaId = this.requirePlaza(actor);

    const updated = await this.prisma.withTenant(plazaId, async (tx) => {
      await this.assertSubcategoria(tx, categoriaId, subId);
      const existente = await tx.subcategoria_supervisor.findUnique({
        where: { subcategoria_id_usuario_id: { subcategoria_id: subId, usuario_id: usuarioId } },
      });
      if (!existente) {
        this.throwNotFound('SUPERVISOR_NOT_FOUND', 'El supervisor no está asignado.');
      }
      await tx.subcategoria_supervisor.delete({
        where: { subcategoria_id_usuario_id: { subcategoria_id: subId, usuario_id: usuarioId } },
      });
      return tx.subcategoria.findUniqueOrThrow({
        where: { id: subId },
        include: SUBCATEGORIA_INCLUDE,
      });
    });

    await this.auditoria.record({
      accion: 'subcategoria.remove_supervisor',
      entidadTipo: 'subcategoria',
      entidadId: subId,
      plazaId,
      usuarioId: actor.sub,
      antes: { supervisorId: usuarioId },
      ...meta,
    });
    return subcategoriaToDetail(updated as SubcategoriaConRelaciones);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async assertSubcategoria(
    tx: Prisma.TransactionClient,
    categoriaId: string,
    subId: string,
  ) {
    const sub = await tx.subcategoria.findFirst({
      where: { id: subId, categoria_id: categoriaId },
    });
    if (!sub) this.throwNotFound('SUBCATEGORIA_NOT_FOUND', 'La subcategoría no existe.');
    return sub;
  }

  private async assertSinSubcategoriasActivas(
    tx: Prisma.TransactionClient,
    categoriaId: string,
  ): Promise<void> {
    const activas = await tx.subcategoria.count({
      where: { categoria_id: categoriaId, activo: true },
    });
    if (activas > 0) {
      throw new BadRequestException({
        code: 'CATEGORIA_HAS_ACTIVE_SUBCATEGORIAS',
        title: 'Solicitud inválida',
        message: `La categoría tiene ${activas} subcategoría(s) activa(s). Desactívalas primero.`,
      });
    }
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

  private throwNotFound(code: string, message: string): never {
    throw new NotFoundException({ code, title: 'Recurso no encontrado', message });
  }

  /** RAISE del trigger T-066 → 409 de dominio (mismo patrón que CONTRATO_OVERLAP). */
  private rethrowMax5(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('SUBCATEGORIA_MAX_5_SUPERVISORES')) {
      throw new ConflictException({
        code: 'SUBCATEGORIA_MAX_5_SUPERVISORES',
        title: 'Conflicto con el estado actual',
        message: 'La subcategoría ya tiene el máximo de 5 supervisores.',
      });
    }
  }

  /** Violación de UNIQUE (plaza_id|categoria_id, nombre) → 409 de dominio. */
  private rethrowNombreDuplicado(err: unknown, code: string): void {
    const isUnique =
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002';
    if (isUnique) {
      throw new ConflictException({
        code,
        title: 'Conflicto con el estado actual',
        message: 'Ya existe un registro con ese nombre.',
      });
    }
  }
}
