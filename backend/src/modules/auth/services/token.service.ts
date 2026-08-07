import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type { RolGlobal } from '@app/contracts';
import { PrismaAdminService } from '../../../prisma/prisma-admin.service';
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
 *
 * T-RBAC-1 (fix login 502, 2026-08-07): el accessToken YA NO incluye los
 * permisos en su payload. Esto reduce ~1800 bytes del JWT firmado y, en
 * consecuencia, del JWE cifrado por Auth.js (el accessToken vive dentro
 * del JWT de NextAuth → del cookie cifrado → que se fragmentaba en varias
 * cookies cuando superaba 3936 bytes, causando 502 Bad Gateway).
 *
 * Los permisos se resuelven SIEMPRE frescos desde BD cuando un endpoint
 * protegido los necesita (ver `PermissionsGuard`). Si el admin_plaza perdió
 * un permiso entre la emisión del JWT y la siguiente request, el guard lo
 * rechaza en el momento — sin esperar al refresh del token. La seguridad
 * queda más estricta que antes (antes: claim podía ir stale hasta el refresh).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    // Admin client: refresh_token no tiene plaza_id y su RLS es restrictiva
    // (USING false); solo el admin client/superusuario puede tocarla. Ver T-038.
    private readonly prisma: PrismaAdminService,
    // RLS client: para leer el catálogo de permisos y el pivote
    // rol_staff_permiso dentro del scope del tenant.
    private readonly prismaRls: PrismaService,
    private readonly config: ConfigService,
  ) {}

  sha256(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Segundos de vida del access token (para el campo `expiresIn` de la respuesta). */
  accessTtlSeconds(): number {
    return durationToSeconds(this.config.get<string>('JWT_ACCESS_TTL', '3600s'));
  }

  /**
   * Resuelve los permisos efectivos del usuario (T-RBAC-1). Reglas:
   *  - superadmin  → wildcard `['*']` (PermissionsGuard los trata como bypass).
   *  - admin_plaza sin rol_staff_id → TODOS los del catálogo (compat).
   *  - admin_plaza con rol_staff_id → permisos asignados al rol_staff (vía pivote).
   *  - inquilino → `[]` (v1: RBAC solo Admin Plaza; el flujo de inquilino sigue
   *    gobernado por `@Roles('inquilino')`).
   *
   * Nota: este método resuelve SIEMPRE desde BD. La cache por request se
   * hace en `PermissionsGuard` (no aquí, porque este servicio no es
   * singleton de request).
   */
  async resolvePermisosEfectivos(user: TokenUser): Promise<string[]> {
    if (user.rol.codigo === 'superadmin') {
      return ['*'];
    }
    if (user.rol.codigo === 'inquilino') {
      return [];
    }
    if (user.rol.codigo !== 'admin_plaza') {
      return [];
    }

    // admin_plaza sin rol_staff → todos los permisos (compat pre-RBAC).
    if (!user.rol_staff_id) {
      const all = await this.prisma.permiso.findMany({ select: { codigo: true } });
      return all.map((p) => p.codigo);
    }

    // admin_plaza con rol_staff → permisos del rol. Usa el cliente RLS con
    // withTenant si hay plaza; si no (caso raro), cae al admin client.
    if (user.plaza_id) {
      return await this.prismaRls.withTenant(user.plaza_id, async (tx) => {
        const permisos = await tx.rol_staff_permiso.findMany({
          where: { rol_staff_id: user.rol_staff_id! },
          select: { permiso: { select: { codigo: true } } },
        });
        return permisos.map((r) => r.permiso.codigo);
      });
    }
    // Fallback (sin plaza): admin client para no fallar.
    const permisos = await this.prisma.rol_staff_permiso.findMany({
      where: { rol_staff_id: user.rol_staff_id },
      select: { permiso: { select: { codigo: true } } },
    });
    return permisos.map((r) => r.permiso.codigo);
  }

  /**
   * Emite el access token SIN el claim `permisos` (ver nota T-RBAC-1 arriba).
   * El método retorna también los permisos para que el controller los envíe
   * en la respuesta de login (compatibilidad con clientes externos / tests).
   */
  async issueAccessToken(user: TokenUser): Promise<{ token: string; permisos: string[] }> {
    const permisos = await this.resolvePermisosEfectivos(user);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      rol: user.rol.codigo as RolGlobal,
      plazaId: user.plaza_id,
      rolStaffId: user.rol_staff_id,
      inquilinoId: user.inquilino_id,
    };
    const token = await this.jwt.signAsync(payload);
    return { token, permisos };
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