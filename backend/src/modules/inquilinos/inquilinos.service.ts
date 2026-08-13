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
 * `razon_social` e `identificacion` son inmutables tras la creación (UX) —
 * no se exponen en `UpdateInquilinoInput` (regla trazabilidad legal/contable).
 *
 * Campos alineados al formato Excel "INFORMACION PARA CREACION DE INQUILINOS"
 * (Hoja 2, columnas B-T + AL). Excluye los 16 campos del primer contrato
 * (U-AK) — esos viven en `contrato`.
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
            // Identidad
            razon_social: dto.razonSocial,
            identificacion: dto.identificacion ?? null,
            nombre_comercial: dto.nombreComercial ?? null,
            representante_legal: dto.representanteLegal ?? null,
            numero_nrc: dto.numeroNrc ?? null,
            // Canales
            correo_recepcion_dte: dto.correoRecepcionDte ?? null,
            numero_telefono: dto.numeroTelefono ?? null,
            direccion: dto.direccion ?? null,
            // Contacto 1
            contacto1_nombre: dto.contacto1Nombre ?? null,
            contacto1_cargo: dto.contacto1Cargo ?? null,
            contacto1_email: dto.contacto1Email ?? null,
            contacto1_telefono: dto.contacto1Telefono ?? null,
            // Contacto 2
            contacto2_nombre: dto.contacto2Nombre ?? null,
            contacto2_cargo: dto.contacto2Cargo ?? null,
            contacto2_email: dto.contacto2Email ?? null,
            contacto2_telefono: dto.contacto2Telefono ?? null,
            // Clasificación
            tipo_cliente: dto.tipoCliente ?? null,
            giro_autorizado: dto.giroAutorizado ?? null,
            categoria: dto.categoria ?? null,
            subcategoria: dto.subcategoria ?? null,
            // Otros
            comentarios: dto.comentarios ?? null,
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

  // ── Actualizar (todo menos los inmutables `razon_social` y `identificacion`) ─
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
          // Identidad (sin razon_social ni identificacion)
          ...(dto.nombreComercial !== undefined
            ? { nombre_comercial: dto.nombreComercial }
            : {}),
          ...(dto.representanteLegal !== undefined
            ? { representante_legal: dto.representanteLegal }
            : {}),
          ...(dto.numeroNrc !== undefined ? { numero_nrc: dto.numeroNrc } : {}),
          // Canales
          ...(dto.correoRecepcionDte !== undefined
            ? { correo_recepcion_dte: dto.correoRecepcionDte }
            : {}),
          ...(dto.numeroTelefono !== undefined
            ? { numero_telefono: dto.numeroTelefono }
            : {}),
          ...(dto.direccion !== undefined ? { direccion: dto.direccion } : {}),
          // Contacto 1
          ...(dto.contacto1Nombre !== undefined
            ? { contacto1_nombre: dto.contacto1Nombre }
            : {}),
          ...(dto.contacto1Cargo !== undefined
            ? { contacto1_cargo: dto.contacto1Cargo }
            : {}),
          ...(dto.contacto1Email !== undefined
            ? { contacto1_email: dto.contacto1Email }
            : {}),
          ...(dto.contacto1Telefono !== undefined
            ? { contacto1_telefono: dto.contacto1Telefono }
            : {}),
          // Contacto 2
          ...(dto.contacto2Nombre !== undefined
            ? { contacto2_nombre: dto.contacto2Nombre }
            : {}),
          ...(dto.contacto2Cargo !== undefined
            ? { contacto2_cargo: dto.contacto2Cargo }
            : {}),
          ...(dto.contacto2Email !== undefined
            ? { contacto2_email: dto.contacto2Email }
            : {}),
          ...(dto.contacto2Telefono !== undefined
            ? { contacto2_telefono: dto.contacto2Telefono }
            : {}),
          // Clasificación
          ...(dto.tipoCliente !== undefined ? { tipo_cliente: dto.tipoCliente } : {}),
          ...(dto.giroAutorizado !== undefined
            ? { giro_autorizado: dto.giroAutorizado }
            : {}),
          ...(dto.categoria !== undefined ? { categoria: dto.categoria } : {}),
          ...(dto.subcategoria !== undefined ? { subcategoria: dto.subcategoria } : {}),
          // Otros
          ...(dto.comentarios !== undefined ? { comentarios: dto.comentarios } : {}),
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
      // Identidad
      razonSocial: i.razon_social,
      identificacion: i.identificacion,
      nombreComercial: i.nombre_comercial,
      representanteLegal: i.representante_legal,
      numeroNrc: i.numero_nrc,
      // Canales
      correoRecepcionDte: i.correo_recepcion_dte,
      numeroTelefono: i.numero_telefono,
      direccion: i.direccion,
      // Contacto 1
      contacto1Nombre: i.contacto1_nombre,
      contacto1Cargo: i.contacto1_cargo,
      contacto1Email: i.contacto1_email,
      contacto1Telefono: i.contacto1_telefono,
      // Contacto 2
      contacto2Nombre: i.contacto2_nombre,
      contacto2Cargo: i.contacto2_cargo,
      contacto2Email: i.contacto2_email,
      contacto2Telefono: i.contacto2_telefono,
      // Clasificación
      tipoCliente: i.tipo_cliente,
      giroAutorizado: i.giro_autorizado,
      categoria: i.categoria,
      subcategoria: i.subcategoria,
      // Otros
      comentarios: i.comentarios,
      // Auditoría
      createdAt: i.created_at.toISOString(),
      updatedAt: i.updated_at.toISOString(),
      deletedAt: i.deleted_at?.toISOString() ?? null,
    };
  }
}
