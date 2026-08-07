import type { RolGlobal } from '@app/contracts';

/**
 * Claims del JWT de acceso (HS256). Materializa RN-AU-6.
 *
 * Nota T-V01: la resolución de tenant es ÚNICAMENTE por `plazaId` aquí; no hay
 * subdominio ni header `x-plaza-slug`. `plazaId` es null solo para superadmin.
 *
 * T-RBAC-1 (fix login 502, 2026-08-07): el claim `permisos` se ELIMINÓ del
 * JWT firmado. Motivo: el accessToken se almacena dentro del JWT de NextAuth
 * (cookie cifrado como JWE). Auth.js fragmenta el cookie en chunks de 3936
 * bytes cuando el payload JWE supera ese tamaño. Un `admin_plaza` con ~64
 * permisos generaba un accessToken ≈2300 bytes que, sumado al resto del JWT
 * de NextAuth, hacía que el JWE se fragmentara en `.0/.1/.2` y provocara
 * 502 Bad Gateway en `POST /login` al no poder escribir la respuesta.
 * Los permisos ahora se resuelven SIEMPRE frescos desde BD por
 * `PermissionsGuard` (cacheados por request en `user.permisos` después de
 * la primera consulta). La defensa en profundidad del backend no se debilita:
 * el guard consulta el catálogo real cada vez (no un claim que pudo rotar).
 */
export interface JwtPayload {
  /** usuario.id */
  sub: string;
  email: string;
  rol: RolGlobal;
  plazaId: string | null;
  rolStaffId: string | null;
  inquilinoId: string | null;
  /** issued at / expiration (los agrega @nestjs/jwt) */
  iat?: number;
  exp?: number;
}

/**
 * Lo que queda en `request.user` tras JwtAuthGuard. `permisos` es
 * RUNTIME-ONLY: NO es un claim del JWT (lo rellena `PermissionsGuard` la
 * primera vez que lo consulta en el ciclo de vida del request). Cualquier
 * consumidor que lea `user.permisos` debe asumir `undefined` y llamar a
 * `resolvePermisosEfectivos` (o esperar a que el guard lo haya hidratado).
 */
export type AuthenticatedUser = JwtPayload & {
  /**
   * Hidratado en runtime por `PermissionsGuard` (cache de un solo SELECT
   * por request). `undefined` antes de que algún endpoint protegido se
   * evalúe.
   */
  permisos?: string[];
  /**
   * Runtime-only (NO es un claim del JWT): true cuando un `superadmin` actúa
   * sobre una plaza concreta vía header `x-plaza-id` (impersonación). Lo setea
   * `PlazaScopeGuard`; en ese caso `plazaId` deja de ser null y pasa a ser la
   * plaza elegida. Sirve para auditoría de la impersonación.
   */
  actingAsPlaza?: boolean;
};
