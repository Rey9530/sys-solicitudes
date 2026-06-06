import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { plaza as PlazaModel } from '@prisma/client';
import type {
  CreatePlazaInput,
  UpdatePlazaInput,
  ListPlazasQuery,
  PlazaOutput,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import { PasswordService } from '../auth/services/password.service';
import { MailerService } from '../auth/services/mailer.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/** Roles de staff por defecto que se crean junto a una plaza nueva (S-RolStaff). */
const DEFAULT_ROLES_STAFF = [
  { codigo: 'tecnico', nombre: 'Técnico' },
  { codigo: 'ingeniero', nombre: 'Ingeniero' },
  { codigo: 'supervisor', nombre: 'Supervisor' },
];

@Injectable()
export class PlazasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly passwords: PasswordService,
    private readonly mailer: MailerService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ── Crear plaza (+ configuración + roles staff + admin inicial) — superadmin ──
  async create(dto: CreatePlazaInput, actor: AuthenticatedUser, meta: RequestMeta): Promise<PlazaOutput> {
    const existing = await this.prismaAdmin.plaza.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException({
        code: 'PLAZA_SLUG_TAKEN',
        title: 'Conflicto con el estado actual',
        message: `El slug "${dto.slug}" ya está en uso.`,
      });
    }

    const { plaza, adminEmail } = await this.prismaAdmin.$transaction(async (tx) => {
      const plaza = await tx.plaza.create({
        data: {
          slug: dto.slug,
          nombre_comercial: dto.nombreComercial,
          email_contacto: dto.emailContacto ?? null,
          telefono_contacto: dto.telefonoContacto ?? null,
          color_primario: dto.colorPrimario,
        },
      });
      // configuración 1:1 con defaults del schema (T-037).
      await tx.configuracion.create({ data: { plaza_id: plaza.id } });
      // roles de staff por defecto (necesarios para asignar al admin inicial).
      await tx.rol_staff.createMany({
        data: DEFAULT_ROLES_STAFF.map((r) => ({ ...r, plaza_id: plaza.id })),
      });

      let adminEmail: string | null = null;
      if (dto.adminPlazaInicial) {
        const rolAdmin = await tx.rol.findUniqueOrThrow({ where: { codigo: 'admin_plaza' } });
        const rolStaff = await tx.rol_staff.findFirst({
          where: { plaza_id: plaza.id, codigo: dto.adminPlazaInicial.rolStaffCodigo },
        });
        if (!rolStaff) {
          throw new BadRequestException({
            code: 'ROL_STAFF_NO_EXISTE',
            title: 'Solicitud inválida',
            message: `El rol de staff "${dto.adminPlazaInicial.rolStaffCodigo}" no existe en la plaza. Opciones: ${DEFAULT_ROLES_STAFF.map((r) => r.codigo).join(', ')}.`,
          });
        }
        const passwordHash = await this.passwords.hash(dto.adminPlazaInicial.password);
        await tx.usuario.create({
          data: {
            plaza_id: plaza.id,
            rol_id: rolAdmin.id,
            rol_staff_id: rolStaff.id,
            email: dto.adminPlazaInicial.email,
            password_hash: passwordHash,
            nombre: dto.adminPlazaInicial.nombre,
          },
        });
        adminEmail = dto.adminPlazaInicial.email;
      }
      return { plaza, adminEmail };
    });

    // Efectos post-commit: email de bienvenida + auditoría.
    if (adminEmail && dto.adminPlazaInicial) {
      await this.mailer.sendBienvenida(adminEmail, dto.adminPlazaInicial.nombre, plaza.nombre_comercial);
    }
    await this.auditoria.record({
      accion: 'plaza.create',
      entidadTipo: 'plaza',
      entidadId: plaza.id,
      plazaId: plaza.id,
      usuarioId: actor.sub,
      despues: this.toOutput(plaza),
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.toOutput(plaza);
  }

  // ── Listar (superadmin, paginado) ────────────────────────────────────────────
  async findAll(query: ListPlazasQuery): Promise<{
    items: PlazaOutput[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { page, pageSize, search } = query;
    const where = {
      deleted_at: null,
      ...(search
        ? {
            OR: [
              { slug: { contains: search, mode: 'insensitive' as const } },
              { nombre_comercial: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prismaAdmin.plaza.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      this.prismaAdmin.plaza.count({ where }),
    ]);
    return {
      items: items.map((p) => this.toOutput(p)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ── Detalle (superadmin: cualquiera; admin_plaza: la suya) ────────────────────
  async findOne(id: string, actor: AuthenticatedUser): Promise<PlazaOutput> {
    if (actor.rol !== 'superadmin') {
      this.assertOwnPlaza(id, actor);
      const plaza = await this.prisma.withTenant(actor.plazaId as string, (tx) =>
        tx.plaza.findFirst({ where: { id, deleted_at: null } }),
      );
      return this.toOutput(this.assertFound(plaza));
    }
    const plaza = await this.prismaAdmin.plaza.findFirst({ where: { id, deleted_at: null } });
    return this.toOutput(this.assertFound(plaza));
  }

  // ── Actualizar (superadmin o admin_plaza propia; nunca slug/timezone) ─────────
  async update(
    id: string,
    dto: UpdatePlazaInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<PlazaOutput> {
    const isSuper = actor.rol === 'superadmin';
    if (!isSuper) this.assertOwnPlaza(id, actor);

    const data = {
      ...(dto.nombreComercial !== undefined ? { nombre_comercial: dto.nombreComercial } : {}),
      ...(dto.emailContacto !== undefined ? { email_contacto: dto.emailContacto } : {}),
      ...(dto.telefonoContacto !== undefined ? { telefono_contacto: dto.telefonoContacto } : {}),
      ...(dto.colorPrimario !== undefined ? { color_primario: dto.colorPrimario } : {}),
    };

    // Leer `before` y escribir con el MISMO cliente acotado: superadmin con el
    // admin client (cross-tenant legítimo); admin_plaza con `withTenant`, de modo
    // que RLS es el backstop incluso si `assertOwnPlaza` se omitiera a futuro.
    const { before, updated } = isSuper
      ? await this.prismaAdmin.$transaction(async (tx) => {
          const before = this.assertFound(
            await tx.plaza.findFirst({ where: { id, deleted_at: null } }),
          );
          return { before, updated: await tx.plaza.update({ where: { id }, data }) };
        })
      : await this.prisma.withTenant(actor.plazaId as string, async (tx) => {
          const before = this.assertFound(
            await tx.plaza.findFirst({ where: { id, deleted_at: null } }),
          );
          return { before, updated: await tx.plaza.update({ where: { id }, data }) };
        });

    await this.auditoria.record({
      accion: 'plaza.update',
      entidadTipo: 'plaza',
      entidadId: id,
      plazaId: id,
      usuarioId: actor.sub,
      antes: this.toOutput(before),
      despues: this.toOutput(updated),
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
    return this.toOutput(updated);
  }

  // ── Soft delete (superadmin) ──────────────────────────────────────────────────
  async remove(id: string, actor: AuthenticatedUser, meta: RequestMeta): Promise<void> {
    const before = this.assertFound(
      await this.prismaAdmin.plaza.findFirst({ where: { id, deleted_at: null } }),
    );
    await this.prismaAdmin.plaza.update({ where: { id }, data: { deleted_at: new Date() } });
    await this.auditoria.record({
      accion: 'plaza.delete',
      entidadTipo: 'plaza',
      entidadId: id,
      plazaId: id,
      usuarioId: actor.sub,
      antes: this.toOutput(before),
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  private assertOwnPlaza(id: string, actor: AuthenticatedUser): void {
    if (id !== actor.plazaId) {
      throw new ForbiddenException({
        code: 'PLAZA_SCOPE_VIOLATION',
        title: 'Acceso denegado',
        message: 'No tiene acceso a recursos de otra plaza.',
      });
    }
  }

  private assertFound(plaza: PlazaModel | null): PlazaModel {
    if (!plaza) {
      throw new NotFoundException({
        code: 'PLAZA_NOT_FOUND',
        title: 'Recurso no encontrado',
        message: 'La plaza no existe.',
      });
    }
    return plaza;
  }

  private toOutput(p: PlazaModel): PlazaOutput {
    return {
      id: p.id,
      slug: p.slug,
      nombreComercial: p.nombre_comercial,
      emailContacto: p.email_contacto,
      telefonoContacto: p.telefono_contacto,
      logoUrl: p.logo_url,
      colorPrimario: p.color_primario,
      timezone: p.timezone as 'America/El_Salvador',
      createdAt: p.created_at.toISOString(),
      updatedAt: p.updated_at.toISOString(),
      deletedAt: p.deleted_at?.toISOString() ?? null,
    };
  }
}
