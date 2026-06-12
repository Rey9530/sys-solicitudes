import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, usuario as UsuarioModel } from '@prisma/client';
import type {
  CreateUsuarioInput,
  ListUsuariosQuery,
  UpdateUsuarioInput,
  UsuarioOutput,
  RolGlobal,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import { PasswordService } from '../auth/services/password.service';
import { MailerService } from '../auth/services/mailer.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { durationToMs } from '../../common/utils/duration';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface ListUsuariosByInquilino {
  items: (UsuarioOutput & {
    rolStaffActivo: boolean | null;
    rolStaffNombre: string | null;
  })[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Usuarios de plaza — versión MÍNIMA (subconjunto de T-034, adelantado por
 * T-059): solo `POST /usuarios` para la "alta rápida de usuario asociado a un
 * inquilino" desde el panel admin. El CRUD completo de usuarios (listado,
 * edición, desactivación) sigue siendo T-034.
 *
 * T-059-bis: extendida con el flujo de gestión de usuarios desde la pestaña
 * "Usuarios" del detalle de inquilino:
 *   - listar usuarios por inquilino (`findByInquilino`)
 *   - editar nombre/teléfono (`update`)
 *   - deshabilitar (soft delete) (`disable`)
 *   - reactivar (`reactivate`)
 *   - disparar reset de contraseña vía email (`adminPasswordReset`)
 *
 * Reglas:
 *  - rol `inquilino` exige `inquilinoId` existente en la plaza.
 *  - rol `admin_plaza` exige `rolStaffId` activo de la plaza (S-ResponsabilidadStaff).
 *  - rol `superadmin` no se crea por API (solo seed).
 *  - Email de credenciales temporales vía MailerService (provisional, T-118).
 *  - Scope: toda operación de escritura exige que el usuario pertenezca a la
 *    plaza del token (`requirePlaza` + `withTenant`).
 */
@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly passwords: PasswordService,
    private readonly mailer: MailerService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
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
   * Lista los usuarios asociados a un inquilino (vista desde el detalle del
   * inquilino, T-059-bis). Filtra por `inquilinoId` y permite acotar por `rol`
   * (default: `inquilino` para esta vista, pero admisible para auditoría).
   * Valida que el inquilino exista y pertenezca a la plaza del actor.
   */
  async findByInquilino(
    inquilinoId: string,
    query: ListUsuariosQuery,
    actor: AuthenticatedUser,
  ): Promise<ListUsuariosByInquilino> {
    const plazaId = this.requirePlaza(actor);
    const { page, pageSize, rol, search, activo } = query;

    // El rol `inquilino` solo puede listar SUS propios usuarios.
    if (actor.rol === 'inquilino' && actor.inquilinoId !== inquilinoId) {
      throw new ForbiddenException({
        code: 'INQUILINO_SCOPE_VIOLATION',
        title: 'Acceso denegado',
        message: 'No tiene permiso para ver los usuarios de otro inquilino.',
      });
    }

    const { items, total } = await this.prisma.withTenant(plazaId, async (tx) => {
      const inquilino = await tx.inquilino.findFirst({
        where: { id: inquilinoId, deleted_at: null },
        select: { id: true },
      });
      if (!inquilino) {
        throw new NotFoundException({
          code: 'INQUILINO_NOT_FOUND',
          title: 'Recurso no encontrado',
          message: 'El inquilino no existe en la plaza.',
        });
      }

      const where: Prisma.usuarioWhereInput = {
        inquilino_id: inquilinoId,
        // Por defecto listamos activos; si se pide explícitamente `activo=false`,
        // mostramos los soft-deleted; sin filtro, mostramos todos.
        ...(activo === true ? { deleted_at: null } : {}),
        ...(activo === false ? { NOT: { deleted_at: null } } : {}),
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

      const [items, total] = await Promise.all([
        tx.usuario.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: [{ deleted_at: 'asc' }, { nombre: 'asc' }],
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
   * Detalle de un usuario (vista "Usuarios de plaza", T-059-ter). Devuelve el
   * `UsuarioOutput` enriquecido con `rolStaffActivo` y `rolStaffNombre` para
   * que el FE pinte badges coherentes con la tabla.
   */
  async findOne(id: string, actor: AuthenticatedUser) {
    const plazaId = this.requirePlaza(actor);
    const u = await this.prisma.withTenant(plazaId, async (tx) => {
      const user = await tx.usuario.findFirst({
        where: { id },
        include: { rol: { select: { codigo: true } } },
      });
      if (!user) {
        throw new NotFoundException({
          code: 'USUARIO_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'El usuario no existe en esta plaza.',
        });
      }
      return user;
    });
    let rolStaffActivo: boolean | null = null;
    let rolStaffNombre: string | null = null;
    if (u.rol_staff_id) {
      const rs = await this.prisma.withTenant(plazaId, async (tx) => {
        return tx.rol_staff.findUnique({
          where: { id: u.rol_staff_id! },
          select: { activo: true, nombre: true },
        });
      });
      if (rs) {
        rolStaffActivo = rs.activo;
        rolStaffNombre = rs.nombre;
      }
    }
    return {
      ...this.toOutput(u, u.rol.codigo as RolGlobal),
      rolStaffActivo,
      rolStaffNombre,
    };
  }

  /**
   * T-059-bis: edición de nombre y teléfono desde el panel admin (no se
   * expone `rolStaffId` ni `activo` aquí; esos cambios se hacen en el CRUD
   * completo T-034).
   */
  async update(
    id: string,
    dto: UpdateUsuarioInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<UsuarioOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated, rolCodigo } = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = await tx.usuario.findFirst({
        where: { id, deleted_at: null },
        include: { rol: { select: { codigo: true } } },
      });
      if (!before) {
        throw new NotFoundException({
          code: 'USUARIO_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'El usuario no existe en esta plaza.',
        });
      }
      const updated = await tx.usuario.update({
        where: { id },
        data: {
          ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
          ...(dto.telefono !== undefined ? { telefono: dto.telefono } : {}),
        },
        include: { rol: { select: { codigo: true } } },
      });
      return { before, updated, rolCodigo: before.rol.codigo as RolGlobal };
    });

    await this.auditoria.record({
      accion: 'usuario.update',
      entidadTipo: 'usuario',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: this.toOutput(before, rolCodigo),
      despues: this.toOutput(updated, rolCodigo),
      ...meta,
    });
    return this.toOutput(updated, rolCodigo);
  }

  /**
   * T-059-bis + módulo "Usuarios de plaza": deshabilita un usuario (soft delete).
   * Idempotente: si ya está inactivo, 409 `USUARIO_YA_INACTIVO`.
   *
   * Roles permitidos: `inquilino` (panel del inquilino, T-059-bis) y
   * `admin_plaza` (panel "Usuarios de plaza"). No se permite deshabilitar
   * `superadmin` desde la API.
   *
   * RN-AU-5: si el actor intenta deshabilitarse a sí mismo y es el ÚNICO
   * `admin_plaza` activo de la plaza, se rechaza con 409 `ULTIMO_ADMIN_ACTIVO`.
   *
   * El `motivo` (opcional) se persiste en `auditoria.despues.motivo` para
   * trazabilidad. Es obligatorio a nivel UI (dialog pide texto) para
   * `admin_plaza`, pero el backend lo acepta opcional para flexibilidad.
   */
  async disable(
    id: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
    motivo?: string,
  ): Promise<UsuarioOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated, rolCodigo, adminsActivos } = await this.prisma.withTenant(
      plazaId,
      async (tx) => {
        const before = await tx.usuario.findFirst({
          where: { id },
          include: { rol: { select: { codigo: true } } },
        });
        if (!before || before.deleted_at) {
          throw new NotFoundException({
            code: 'USUARIO_NO_ENCONTRADO',
            title: 'Recurso no encontrado',
            message: 'El usuario no existe en esta plaza.',
          });
        }
        if (before.rol.codigo !== 'inquilino' && before.rol.codigo !== 'admin_plaza') {
          throw new ForbiddenException({
            code: 'USUARIO_ROL_NO_PERMITIDO',
            title: 'Acceso denegado',
            message:
              'Solo se pueden deshabilitar usuarios con rol «inquilino» o «admin_plaza».',
          });
        }

        // RN-AU-5: si el actor se está deshabilitando a sí mismo y es admin_plaza,
        // verificar que no sea el único activo de la plaza.
        let adminsActivos = 0;
        if (before.rol.codigo === 'admin_plaza' && actor.sub === before.id) {
          adminsActivos = await tx.usuario.count({
            where: {
              plaza_id: plazaId,
              deleted_at: null,
              rol: { codigo: 'admin_plaza' },
            },
          });
          if (adminsActivos <= 1) {
            throw new ConflictException({
              code: 'ULTIMO_ADMIN_ACTIVO',
              title: 'Conflicto con el estado actual',
              message:
                'No puedes deshabilitarte: eres el único administrador activo de la plaza. Crea o reactiva a otro admin primero.',
            });
          }
        }

        const updated = await tx.usuario.update({
          where: { id },
          data: { deleted_at: new Date() },
          include: { rol: { select: { codigo: true } } },
        });
        return {
          before,
          updated,
          rolCodigo: before.rol.codigo as RolGlobal,
          adminsActivos,
        };
      },
    );

    // Invalidar refresh tokens activos para forzar re-login.
    await this.prismaAdmin.refresh_token
      .updateMany({
        where: { usuario_id: id, revoked_at: null },
        data: { revoked_at: new Date() },
      })
      .catch(() => undefined);

    await this.auditoria.record({
      accion: 'usuario.disable',
      entidadTipo: 'usuario',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: this.toOutput(before, rolCodigo),
      despues: {
        ...this.toOutput(updated, rolCodigo),
        ...(motivo ? { motivo } : {}),
        ...(adminsActivos > 0 ? { adminsActivosRestantesTras: adminsActivos - 1 } : {}),
      },
      ...meta,
    });
    return this.toOutput(updated, rolCodigo);
  }

  /**
   * T-059-bis + módulo "Usuarios de plaza": revierte el soft delete
   * (clear `deleted_at`). Idempotente: si ya está activo, 409
   * `USUARIO_NO_INACTIVO`. Acepta `inquilino` y `admin_plaza` (no
   * `superadmin`).
   */
  async reactivate(
    id: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<UsuarioOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated, rolCodigo } = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = await tx.usuario.findFirst({
        where: { id },
        include: { rol: { select: { codigo: true } } },
      });
      if (!before || !before.deleted_at) {
        throw new ConflictException({
          code: 'USUARIO_NO_INACTIVO',
          title: 'Conflicto con el estado actual',
          message: 'El usuario no está deshabilitado.',
        });
      }
      if (before.rol.codigo !== 'inquilino' && before.rol.codigo !== 'admin_plaza') {
        throw new ForbiddenException({
          code: 'USUARIO_ROL_NO_PERMITIDO',
          title: 'Acceso denegado',
          message:
            'Solo se pueden reactivar usuarios con rol «inquilino» o «admin_plaza».',
        });
      }
      // SC-3: un admin_plaza reactivado debe seguir teniendo su rol_staff_id
      // válido. Si el rol_staff fue desactivado, el FK queda apuntando a un
      // registro con activo=false — el UI lo señalará, pero permitimos la
      // reactivación para no dejar al usuario bloqueado.
      const updated = await tx.usuario.update({
        where: { id },
        data: { deleted_at: null },
        include: { rol: { select: { codigo: true } } },
      });
      return { before, updated, rolCodigo: before.rol.codigo as RolGlobal };
    });

    await this.auditoria.record({
      accion: 'usuario.reactivate',
      entidadTipo: 'usuario',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: this.toOutput(before, rolCodigo),
      despues: this.toOutput(updated, rolCodigo),
      ...meta,
    });
    return this.toOutput(updated, rolCodigo);
  }

  /**
   * T-059-bis: dispara un reset de contraseña para un usuario específico.
   * A diferencia del endpoint público `POST /auth/reset-password`, el admin
   * conoce la identidad del usuario (no se envía email si está soft-deleted
   * o si el email figura como inválido por hard bounce). El email contiene
   * un enlace de 1h (T-029) que el usuario usa para fijar su nueva clave.
   *
   * No devuelve la contraseña al admin (T-029: las claves nunca se filtran).
   */
  async adminPasswordReset(
    id: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<{ id: string; email: string }> {
    const plazaId = this.requirePlaza(actor);

    const usuario = await this.prisma.withTenant(plazaId, async (tx) => {
      const u = await tx.usuario.findFirst({
        where: { id, deleted_at: null },
        include: { rol: { select: { codigo: true } } },
      });
      if (!u) {
        throw new NotFoundException({
          code: 'USUARIO_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'El usuario no existe en esta plaza.',
        });
      }
      if (u.email_invalido) {
        throw new ConflictException({
          code: 'USUARIO_EMAIL_INVALIDO',
          title: 'Conflicto con el estado actual',
          message:
            'El email del usuario figura como inválido (hard bounce). Corrija la dirección antes de reenviar.',
        });
      }
      return u;
    });

    // Generar token de reset (mismo flujo que AuthService.requestPasswordReset).
    const token = randomUUID();
    const ttlMs = durationToMs(this.config.get<string>('PASSWORD_RESET_TTL', '1800s'));
    await this.prismaAdmin.password_reset_token.create({
      data: {
        usuario_id: usuario.id,
        token_hash: createHash('sha256').update(token).digest('hex'),
        expires_at: new Date(Date.now() + ttlMs),
      },
    });

    const base = this.config
      .get<string>('FRONTEND_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
    const resetUrl = `${base}/reset-password/${token}`;
    await this.mailer.sendPasswordReset(usuario.email, usuario.nombre, resetUrl, plazaId);

    await this.auditoria.record({
      accion: 'usuario.admin_password_reset',
      entidadTipo: 'usuario',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      despues: { triggeredBy: 'admin', email: usuario.email },
      ...meta,
    });
    return { id: usuario.id, email: usuario.email };
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
