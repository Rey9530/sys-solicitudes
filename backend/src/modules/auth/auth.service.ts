import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type {
  LoginInput,
  TokenResponse,
  ChangePasswordInput,
  ResetPasswordConfirm,
  RolGlobal,
} from '@app/contracts';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import { durationToMs } from '../../common/utils/duration';
import { PasswordService } from './services/password.service';
import { TokenService, type RequestMeta, type TokenUser } from './services/token.service';
import { MailerService } from './services/mailer.service';
import type { AuthenticatedUser } from './types/jwt-payload';

@Injectable()
export class AuthService {
  constructor(
    // Admin client (bypassa RLS): las operaciones de auth son pre-sesión y
    // globales (por email/token), sin contexto de plaza. Ver T-038.
    private readonly prisma: PrismaAdminService,
    private readonly config: ConfigService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly mailer: MailerService,
  ) {}

  // ── Login con lockout (T-026, RN-AU-4, T-V13: 10 fallos / 15 min) ───────────
  async login(input: LoginInput, meta: RequestMeta): Promise<TokenResponse> {
    const email = input.email.trim().toLowerCase();
    const threshold = Number(this.config.get<string>('LOGIN_LOCKOUT_THRESHOLD', '10'));
    const windowMs = durationToMs(this.config.get<string>('LOGIN_LOCKOUT_WINDOW', '900s'));
    const since = new Date(Date.now() - windowMs);

    // Conteo de intentos fallidos recientes por email O por IP.
    const failFilter = {
      exitoso: false,
      created_at: { gte: since },
      OR: [{ email }, ...(meta.ip ? [{ ip: meta.ip }] : [])],
    };
    const recentFails = await this.prisma.auditoria_login.count({ where: failFilter });

    if (recentFails >= threshold) {
      const oldest = await this.prisma.auditoria_login.findFirst({
        where: failFilter,
        orderBy: { created_at: 'asc' },
      });
      const retryAfter = oldest
        ? Math.max(1, Math.ceil((oldest.created_at.getTime() + windowMs - Date.now()) / 1000))
        : Math.ceil(windowMs / 1000);
      await this.recordLogin({ email, exitoso: false, motivo: 'cuenta_bloqueada', meta });
      throw new HttpException(
        {
          code: 'ACCOUNT_LOCKED',
          title: 'Demasiadas solicitudes',
          message: `Cuenta bloqueada temporalmente. Intente de nuevo en ${retryAfter} segundos.`,
          meta: { retryAfter },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: { email, deleted_at: null },
      include: { rol: true },
    });

    if (!usuario) {
      await this.recordLogin({ email, exitoso: false, motivo: 'usuario_no_existe', meta });
      throw this.invalidCredentials();
    }

    const ok = await this.passwords.compare(input.password, usuario.password_hash);
    if (!ok) {
      await this.recordLogin({
        email,
        exitoso: false,
        motivo: 'password_invalido',
        meta,
        plazaId: usuario.plaza_id,
        usuarioId: usuario.id,
      });
      throw this.invalidCredentials();
    }

    // Éxito.
    await this.recordLogin({
      email,
      exitoso: true,
      meta,
      plazaId: usuario.plaza_id,
      usuarioId: usuario.id,
    });
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { last_login_at: new Date() },
    });

    return this.buildTokenResponse(usuario, meta);
  }

  // ── Refresh con rotación y detección de reuso (T-027) ───────────────────────
  async refresh(refreshToken: string, meta: RequestMeta): Promise<TokenResponse> {
    const tokenHash = this.tokens.sha256(refreshToken);
    const row = await this.prisma.refresh_token.findFirst({ where: { token_hash: tokenHash } });

    if (!row || row.revoked_at) {
      // Reuso de un token ya revocado → revocar todos los del usuario.
      if (row?.usuario_id) {
        await this.tokens.revokeAllForUser(row.usuario_id);
      }
      throw new UnauthorizedException({
        code: 'REFRESH_INVALID',
        title: 'No autenticado',
        message: 'El refresh token es inválido o ya fue usado.',
      });
    }

    if (row.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException({
        code: 'REFRESH_EXPIRED',
        title: 'No autenticado',
        message: 'El refresh token expiró. Inicie sesión de nuevo.',
      });
    }

    // Rotación: revoca el actual y emite uno nuevo.
    await this.prisma.refresh_token.update({
      where: { id: row.id },
      data: { revoked_at: new Date() },
    });

    const usuario = await this.prisma.usuario.findFirst({
      where: { id: row.usuario_id, deleted_at: null },
      include: { rol: true },
    });
    if (!usuario) {
      throw new UnauthorizedException({
        code: 'REFRESH_INVALID',
        title: 'No autenticado',
        message: 'El usuario ya no está disponible.',
      });
    }

    return this.buildTokenResponse(usuario, meta);
  }

  // ── Logout (T-028) ──────────────────────────────────────────────────────────
  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeRefreshToken(this.tokens.sha256(refreshToken));
  }

  // ── Reset: solicitud (T-029) ────────────────────────────────────────────────
  async requestPasswordReset(emailRaw: string): Promise<void> {
    const email = emailRaw.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findFirst({
      where: { email, deleted_at: null },
    });
    // Respuesta siempre 200: no revelamos si el email existe.
    if (!usuario) {
      return;
    }

    const token = randomUUID();
    const ttlMs = durationToMs(this.config.get<string>('PASSWORD_RESET_TTL', '1800s'));
    await this.prisma.password_reset_token.create({
      data: {
        usuario_id: usuario.id,
        token_hash: this.tokens.sha256(token),
        expires_at: new Date(Date.now() + ttlMs),
      },
    });

    const base = this.config
      .get<string>('FRONTEND_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
    const resetUrl = `${base}/reset-password/${token}`;
    await this.mailer.sendPasswordReset(usuario.email, usuario.nombre, resetUrl);
  }

  // ── Reset: confirmación (T-029) ──────────────────────────────────────────────
  async confirmPasswordReset(input: ResetPasswordConfirm): Promise<void> {
    const tokenHash = this.tokens.sha256(input.token);
    const row = await this.prisma.password_reset_token.findFirst({
      where: { token_hash: tokenHash },
    });

    if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        title: 'Solicitud inválida',
        message: 'El enlace de restablecimiento es inválido o ha expirado.',
      });
    }

    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.prisma.$transaction([
      this.prisma.password_reset_token.update({
        where: { id: row.id },
        data: { used_at: new Date() },
      }),
      this.prisma.usuario.update({
        where: { id: row.usuario_id },
        data: { password_hash: passwordHash },
      }),
      this.prisma.refresh_token.updateMany({
        where: { usuario_id: row.usuario_id, revoked_at: null },
        data: { revoked_at: new Date() },
      }),
    ]);
  }

  // ── Cambio de contraseña con sesión activa (T-030) ───────────────────────────
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: userId, deleted_at: null },
    });
    if (!usuario) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        title: 'Recurso no encontrado',
        message: 'El usuario no existe.',
      });
    }

    const ok = await this.passwords.compare(input.currentPassword, usuario.password_hash);
    if (!ok) {
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PASSWORD',
        title: 'Solicitud inválida',
        message: 'La contraseña actual es incorrecta.',
      });
    }

    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { password_hash: passwordHash },
    });
    await this.tokens.revokeAllForUser(usuario.id);
  }

  // ── Perfil del usuario autenticado (T-031) ───────────────────────────────────
  async me(user: AuthenticatedUser): Promise<{
    id: string;
    email: string;
    nombre: string;
    telefono: string | null;
    rol: RolGlobal;
    rolStaffId: string | null;
    inquilinoId: string | null;
    plazaId: string | null;
    lastLoginAt: string | null;
    createdAt: string;
  }> {
    const usuario = await this.prisma.usuario.findFirst({
      // Coherencia defensiva: para no-superadmin exigimos que el plaza_id en BD
      // coincida con el del JWT (un JWT viejo con plaza_id desfasado → 404).
      where: {
        id: user.sub,
        deleted_at: null,
        ...(user.plazaId ? { plaza_id: user.plazaId } : {}),
      },
      include: { rol: true },
    });
    if (!usuario) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        title: 'Recurso no encontrado',
        message: 'El usuario no existe o fue eliminado.',
      });
    }
    return {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      telefono: usuario.telefono,
      rol: usuario.rol.codigo as RolGlobal,
      rolStaffId: usuario.rol_staff_id,
      inquilinoId: usuario.inquilino_id,
      plazaId: usuario.plaza_id,
      lastLoginAt: usuario.last_login_at?.toISOString() ?? null,
      createdAt: usuario.created_at.toISOString(),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  private async buildTokenResponse(
    usuario: TokenUser & { nombre: string },
    meta: RequestMeta,
  ): Promise<TokenResponse> {
    const accessToken = await this.tokens.issueAccessToken(usuario);
    const refreshToken = await this.tokens.issueRefreshToken(usuario.id, meta);
    return {
      accessToken,
      refreshToken,
      expiresIn: this.tokens.accessTtlSeconds(),
      user: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        rol: usuario.rol.codigo as RolGlobal,
        plazaId: usuario.plaza_id,
        rolStaffId: usuario.rol_staff_id,
        inquilinoId: usuario.inquilino_id,
      },
    };
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      title: 'No autenticado',
      message: 'Email o contraseña incorrectos.',
    });
  }

  private async recordLogin(params: {
    email: string;
    exitoso: boolean;
    meta: RequestMeta;
    motivo?: string;
    plazaId?: string | null;
    usuarioId?: string | null;
  }): Promise<void> {
    await this.prisma.auditoria_login.create({
      data: {
        email: params.email,
        exitoso: params.exitoso,
        motivo_fallo: params.motivo ?? null,
        plaza_id: params.plazaId ?? null,
        usuario_id: params.usuarioId ?? null,
        ip: params.meta.ip ?? null,
        user_agent: params.meta.userAgent ?? null,
      },
    });
  }
}
