import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type { RolGlobal } from '@app/contracts';
import { PrismaService } from '../../../prisma/prisma.service';
import { durationToMs, durationToSeconds } from '../../../common/utils/duration';
import type { JwtPayload } from '../types/jwt-payload';

/** Datos mínimos del usuario necesarios para emitir tokens. */
export interface TokenUser {
  id: string;
  email: string;
  plaza_id: string | null;
  rol_staff_id: string | null;
  inquilino_id: string | null;
  rol: { codigo: string };
}

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Emisión y rotación de tokens (D3).
 *  - Access: JWT HS256, TTL JWT_ACCESS_TTL (1h por T-V13).
 *  - Refresh: UUID v4 opaco; en BD solo su SHA-256, TTL JWT_REFRESH_TTL (14d).
 * Detalles: PLANIFICACION/02 (T-020, T-026, T-027).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  sha256(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Segundos de vida del access token (para el campo `expiresIn` de la respuesta). */
  accessTtlSeconds(): number {
    return durationToSeconds(this.config.get<string>('JWT_ACCESS_TTL', '3600s'));
  }

  async issueAccessToken(user: TokenUser): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      rol: user.rol.codigo as RolGlobal,
      plazaId: user.plaza_id,
      rolStaffId: user.rol_staff_id,
      inquilinoId: user.inquilino_id,
    };
    return this.jwt.signAsync(payload);
  }

  /** Crea y persiste un refresh token; devuelve el token plano (solo se ve aquí). */
  async issueRefreshToken(usuarioId: string, meta: RequestMeta): Promise<string> {
    const token = randomUUID();
    const ttlMs = durationToMs(this.config.get<string>('JWT_REFRESH_TTL', '14d'));
    await this.prisma.refresh_token.create({
      data: {
        usuario_id: usuarioId,
        token_hash: this.sha256(token),
        expires_at: new Date(Date.now() + ttlMs),
        user_agent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
      },
    });
    return token;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.prisma.refresh_token.updateMany({
      where: { token_hash: tokenHash, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  /** Revoca todos los refresh activos de un usuario (logout global / cambio de pwd). */
  async revokeAllForUser(usuarioId: string): Promise<void> {
    await this.prisma.refresh_token.updateMany({
      where: { usuario_id: usuarioId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }
}
