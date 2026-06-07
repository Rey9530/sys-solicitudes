import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, usuario as UsuarioModel } from '@prisma/client';
import type {
  CreateUsuarioInput,
  ListUsuariosQuery,
  UsuarioOutput,
  RolGlobal,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../auth/services/password.service';
import { MailerService } from '../auth/services/mailer.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * Usuarios de plaza — versión MÍNIMA (subconjunto de T-034, adelantado por
 * T-059): solo `POST /usuarios` para la "alta rápida de usuario asociado a un
 * inquilino" desde el panel admin. El CRUD completo de usuarios (listado,
 * edición, desactivación) sigue siendo T-034.
 *
 * Reglas:
 *  - rol `inquilino` exige `inquilinoId` existente en la plaza.
 *  - rol `admin_plaza` exige `rolStaffId` activo de la plaza (S-ResponsabilidadStaff).
 *  - rol `superadmin` no se crea por API (solo seed).
 *  - Email de credenciales temporales vía MailerService (provisional, T-118).
 */
@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly mailer: MailerService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async create(
    dto: CreateUsuarioInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<UsuarioOutput> {
    const plazaId = this.requirePlaza(actor);
    if (dto.rol === 'superadmin') {
      throw new BadRequestException({
        code: 'ROL_NO_PERMITIDO',
        title: 'Solicitud inválida',
        message: 'No se pueden crear usuarios superadmin por API.',
      });
    }
    if (dto.rol === 'inquilino' && !dto.inquilinoId) {
      throw new BadRequestException({
        code: 'INQUILINO_REQUERIDO',
        title: 'Solicitud inválida',
        message: 'Un usuario inquilino requiere inquilinoId.',
      });
    }
    if (dto.rol === 'admin_plaza' && !dto.rolStaffId) {
      throw new BadRequestException({
        code: 'ROL_STAFF_REQUERIDO',
        title: 'Solicitud inválida',
        message: 'Un usuario admin_plaza requiere rolStaffId.',
      });
    }

    const passwordHash = await this.passwords.hash(dto.password);

    const { usuario, nombrePlaza } = await this.prisma
      .withTenant(plazaId, async (tx) => {
        const rol = await tx.rol.findUniqueOrThrow({ where: { codigo: dto.rol } });

        if (dto.rol === 'inquilino') {
          const inquilino = await tx.inquilino.findFirst({
            where: { id: dto.inquilinoId, deleted_at: null },
          });
          if (!inquilino) {
            throw new BadRequestException({
              code: 'INQUILINO_NOT_FOUND',
              title: 'Solicitud inválida',
              message: 'El inquilino indicado no existe en la plaza.',
            });
          }
        }
        if (dto.rol === 'admin_plaza') {
          const rolStaff = await tx.rol_staff.findFirst({
            where: { id: dto.rolStaffId, activo: true },
          });
          if (!rolStaff) {
            throw new BadRequestException({
              code: 'ROL_STAFF_NO_EXISTE',
              title: 'Solicitud inválida',
              message: 'El rol de staff indicado no existe o está inactivo.',
            });
          }
        }

        const usuario = await tx.usuario.create({
          data: {
            plaza_id: plazaId,
            inquilino_id: dto.rol === 'inquilino' ? dto.inquilinoId : null,
            rol_id: rol.id,
            rol_staff_id: dto.rol === 'admin_plaza' ? dto.rolStaffId : null,
            email: dto.email,
            password_hash: passwordHash,
            nombre: dto.nombre,
            telefono: dto.telefono ?? null,
          },
        });
        const plaza = await tx.plaza.findUnique({ where: { id: plazaId } });
        return { usuario, nombrePlaza: plaza?.nombre_comercial ?? 'Plazapp' };
      })
      .catch((err: unknown) => {
        const e = err as { code?: string };
        if (e?.code === 'P2002') {
          throw new ConflictException({
            code: 'USUARIO_EMAIL_DUPLICADO',
            title: 'Conflicto con el estado actual',
            message: `Ya existe un usuario con el email "${dto.email}" en la plaza.`,
          });
        }
        throw err;
      });

    // Email de bienvenida con instrucción de credenciales (encolado, T-126).
    await this.mailer.sendBienvenida(usuario.email, usuario.nombre, nombrePlaza, plazaId);

    await this.auditoria.record({
      accion: 'usuario.create',
      entidadTipo: 'usuario',
      entidadId: usuario.id,
      plazaId,
      usuarioId: actor.sub,
      despues: this.toOutput(usuario, dto.rol),
      ...meta,
    });
    return this.toOutput(usuario, dto.rol);
  }

  /**
   * Listado mínimo (subconjunto de T-034, adelantado por T-073): los selectores
   * de responsable/supervisores de subcategorías necesitan los admin_plaza de
   * la plaza. Solo usuarios activos (deleted_at IS NULL).
   */
  async findAll(query: ListUsuariosQuery, actor: AuthenticatedUser) {
    const plazaId = this.requirePlaza(actor);
    const { page, pageSize, rol, search } = query;

    const where: Prisma.usuarioWhereInput = {
      deleted_at: null,
      ...(rol ? { rol: { codigo: rol } } : {}),
      ...(search
        ? {
            OR: [
              { nombre: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const { items, total } = await this.prisma.withTenant(plazaId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.usuario.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { nombre: 'asc' },
          include: {
            rol: { select: { codigo: true } },
            rol_staff: { select: { activo: true, nombre: true } },
          },
        }),
        tx.usuario.count({ where }),
      ]);
      return { items, total };
    });

    return {
      items: items.map((u) => ({
        ...this.toOutput(u, u.rol.codigo as RolGlobal),
        rolStaffActivo: u.rol_staff?.activo ?? null,
        rolStaffNombre: u.rol_staff?.nombre ?? null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * T-124: resetea `email_invalido` cuando el admin corrige la dirección.
   * Idempotente. La columna se marca true solo desde el worker (hard bounce).
   */
  async resetEmailInvalido(
    id: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<UsuarioOutput> {
    const plazaId = this.requirePlaza(actor);
    const usuario = await this.prisma.withTenant(plazaId, async (tx) => {
      const existente = await tx.usuario.findFirst({
        where: { id, deleted_at: null },
        include: { rol: { select: { codigo: true } } },
      });
      if (!existente) {
        throw new NotFoundException({
          code: 'USUARIO_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'El usuario no existe en esta plaza.',
        });
      }
      if (!existente.email_invalido) return existente;
      return tx.usuario.update({
        where: { id },
        data: { email_invalido: false },
        include: { rol: { select: { codigo: true } } },
      });
    });
    await this.auditoria.record({
      accion: 'usuario.reset_email_invalido',
      entidadTipo: 'usuario',
      entidadId: usuario.id,
      plazaId,
      usuarioId: actor.sub,
      despues: { emailInvalido: usuario.email_invalido },
      ...meta,
    });
    return this.toOutput(usuario, usuario.rol.codigo as RolGlobal);
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

  private toOutput(u: UsuarioModel, rol: RolGlobal): UsuarioOutput {
    return {
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      telefono: u.telefono,
      rol,
      rolStaffId: u.rol_staff_id,
      inquilinoId: u.inquilino_id,
      plazaId: u.plaza_id,
      emailInvalido: u.email_invalido,
      lastLoginAt: u.last_login_at?.toISOString() ?? null,
      createdAt: u.created_at.toISOString(),
      deletedAt: u.deleted_at?.toISOString() ?? null,
    };
  }
}
