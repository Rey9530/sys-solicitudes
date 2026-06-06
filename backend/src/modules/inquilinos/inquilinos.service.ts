import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, inquilino as InquilinoModel } from '@prisma/client';
import type {
  CreateInquilinoInput,
  UpdateInquilinoInput,
  ListInquilinosQuery,
  ListContratoHistorialQuery,
  InquilinoOutput,
  ContratoOutput,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
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

/** Detalle de inquilino: datos + contratos activos + histórico (T-053). */
export interface InquilinoDetail extends InquilinoOutput {
  contratosVigentes: ContratoOutput[];
  historicoContratos: ContratoOutput[];
}

/**
 * CRUD de inquilinos (T-053) + historial de contratos por inquilino (T-061).
 *
 * Escritura: admin_plaza/superadmin. El rol `inquilino` solo ve su propio
 * registro (id === actor.inquilinoId). Baja lógica solo sin contratos vigentes.
 * `razon_social` e `identificacion` son inmutables tras la creación (UX).
 */
@Injectable()
export class InquilinosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ── Crear ─────────────────────────────────────────────────────────────────────
  async create(
    dto: CreateInquilinoInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<InquilinoOutput> {
    const plazaId = this.requirePlaza(actor);
    const inquilino = await this.prisma
      .withTenant(plazaId, (tx) =>
        tx.inquilino.create({
          data: {
            plaza_id: plazaId,
            razon_social: dto.razonSocial,
            identificacion: dto.identificacion ?? null,
            direccion: dto.direccion ?? null,
            contacto_nombre: dto.contactoNombre ?? null,
            contacto_email: dto.contactoEmail ?? null,
            contacto_telefono: dto.contactoTelefono ?? null,
          },
        }),
      )
      .catch((err: unknown) => {
        this.rethrowIdentificacionDuplicada(err, dto.identificacion);
        throw err;
      });

    await this.auditoria.record({
      accion: 'inquilino.create',
      entidadTipo: 'inquilino',
      entidadId: inquilino.id,
      plazaId,
      usuarioId: actor.sub,
      despues: this.toOutput(inquilino),
      ...meta,
    });
    return this.toOutput(inquilino);
  }

  // ── Listar (inquilino: solo el suyo) ──────────────────────────────────────────
  async findAll(
    query: ListInquilinosQuery,
    actor: AuthenticatedUser,
  ): Promise<Paginated<InquilinoOutput>> {
    const plazaId = this.requirePlaza(actor);
    const { page, pageSize, razonSocial, identificacion } = query;

    const where: Prisma.inquilinoWhereInput = {
      deleted_at: null,
      ...(razonSocial
        ? { razon_social: { contains: razonSocial, mode: 'insensitive' as const } }
        : {}),
      ...(identificacion
        ? { identificacion: { contains: identificacion, mode: 'insensitive' as const } }
        : {}),
      ...(actor.rol === 'inquilino' ? { id: this.requireInquilino(actor) } : {}),
    };

    const { items, total } = await this.prisma.withTenant(plazaId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.inquilino.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { razon_social: 'asc' },
        }),
        tx.inquilino.count({ where }),
      ]);
      return { items, total };
    });

    return {
      items: items.map((i) => this.toOutput(i)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ── Detalle + contratos activos + histórico ───────────────────────────────────
  async findOne(id: string, actor: AuthenticatedUser): Promise<InquilinoDetail> {
    const plazaId = this.requirePlaza(actor);
    if (actor.rol === 'inquilino' && id !== this.requireInquilino(actor)) {
      this.assertFound(null);
    }

    const result = await this.prisma.withTenant(plazaId, async (tx) => {
      const inquilino = await tx.inquilino.findFirst({ where: { id, deleted_at: null } });
      if (!inquilino) return null;
      const contratos = await tx.contrato.findMany({
        where: { inquilino_id: id },
        orderBy: { fecha_inicio: 'desc' },
      });
      return { inquilino, contratos };
    });
    const found = this.assertFound(result?.inquilino ?? null);

    const historico = ordenarHistorial(result?.contratos ?? []);
    return {
      ...this.toOutput(found),
      contratosVigentes: historico.filter((c) => c.estado === 'vigente').map(contratoToOutput),
      historicoContratos: historico.map(contratoToOutput),
    };
  }

  // ── Historial de contratos del inquilino (T-061) ──────────────────────────────
  async findContratos(
    id: string,
    query: ListContratoHistorialQuery,
    actor: AuthenticatedUser,
  ): Promise<Paginated<ContratoOutput>> {
    const plazaId = this.requirePlaza(actor);
    if (actor.rol === 'inquilino' && id !== this.requireInquilino(actor)) {
      this.assertFound(null);
    }
    const { page, pageSize, estado } = query;

    const result = await this.prisma.withTenant(plazaId, async (tx) => {
      const inquilino = await tx.inquilino.findFirst({ where: { id, deleted_at: null } });
      if (!inquilino) return null;
      return tx.contrato.findMany({
        where: { inquilino_id: id, ...(estado ? { estado } : {}) },
        orderBy: { fecha_inicio: 'desc' },
      });
    });
    if (result === null) this.assertFound(null);

    const ordenados = ordenarHistorial(result ?? []);
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

  // ── Actualizar (solo contacto y dirección) ────────────────────────────────────
  async update(
    id: string,
    dto: UpdateInquilinoInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<InquilinoOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated } = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = this.assertFound(
        await tx.inquilino.findFirst({ where: { id, deleted_at: null } }),
      );
      const updated = await tx.inquilino.update({
        where: { id },
        data: {
          ...(dto.contactoNombre !== undefined ? { contacto_nombre: dto.contactoNombre } : {}),
          ...(dto.contactoEmail !== undefined ? { contacto_email: dto.contactoEmail } : {}),
          ...(dto.contactoTelefono !== undefined
            ? { contacto_telefono: dto.contactoTelefono }
            : {}),
          ...(dto.direccion !== undefined ? { direccion: dto.direccion } : {}),
        },
      });
      return { before, updated };
    });

    await this.auditoria.record({
      accion: 'inquilino.update',
      entidadTipo: 'inquilino',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: this.toOutput(before),
      despues: this.toOutput(updated),
      ...meta,
    });
    return this.toOutput(updated);
  }

  // ── Soft delete (sin contratos vigentes) ──────────────────────────────────────
  async remove(id: string, actor: AuthenticatedUser, meta: RequestMeta): Promise<void> {
    const plazaId = this.requirePlaza(actor);

    const before = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = this.assertFound(
        await tx.inquilino.findFirst({ where: { id, deleted_at: null } }),
      );
      const vigente = await tx.contrato.findFirst({
        where: { inquilino_id: id, estado: 'vigente' },
      });
      if (vigente) {
        throw new ConflictException({
          code: 'INQUILINO_HAS_ACTIVE_CONTRACT',
          title: 'Conflicto con el estado actual',
          message: 'No se puede desactivar un inquilino con contratos vigentes.',
        });
      }
      await tx.inquilino.update({ where: { id }, data: { deleted_at: new Date() } });
      return before;
    });

    await this.auditoria.record({
      accion: 'inquilino.delete',
      entidadTipo: 'inquilino',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: this.toOutput(before),
      ...meta,
    });
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

  private assertFound(inquilino: InquilinoModel | null): InquilinoModel {
    if (!inquilino) {
      throw new NotFoundException({
        code: 'INQUILINO_NOT_FOUND',
        title: 'Recurso no encontrado',
        message: 'El inquilino no existe.',
      });
    }
    return inquilino;
  }

  /** Mapea la violación del UNIQUE parcial (plaza_id, identificacion) a 409. */
  private rethrowIdentificacionDuplicada(err: unknown, identificacion?: string): void {
    const e = err as { code?: string; message?: string };
    const esUniqueParcial =
      e?.code === 'P2002' ||
      (typeof e?.message === 'string' &&
        e.message.includes('inquilino_plaza_identificacion_uniq'));
    if (esUniqueParcial) {
      throw new ConflictException({
        code: 'INQUILINO_IDENTIFICACION_DUPLICADA',
        title: 'Conflicto con el estado actual',
        message: `Ya existe un inquilino con la identificación "${identificacion ?? ''}" en la plaza.`,
      });
    }
  }

  private toOutput(i: InquilinoModel): InquilinoOutput {
    return {
      id: i.id,
      plazaId: i.plaza_id,
      razonSocial: i.razon_social,
      identificacion: i.identificacion,
      direccion: i.direccion,
      contactoNombre: i.contacto_nombre,
      contactoEmail: i.contacto_email,
      contactoTelefono: i.contacto_telefono,
      createdAt: i.created_at.toISOString(),
      updatedAt: i.updated_at.toISOString(),
      deletedAt: i.deleted_at?.toISOString() ?? null,
    };
  }
}
