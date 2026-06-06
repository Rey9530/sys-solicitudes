import type { RolGlobal } from '@app/contracts';

/**
 * Claims del JWT de acceso (HS256). Materializa RN-AU-6.
 *
 * Nota T-V01: la resolución de tenant es ÚNICAMENTE por `plazaId` aquí; no hay
 * subdominio ni header `x-plaza-slug`. `plazaId` es null solo para superadmin.
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

/** Lo que queda en `request.user` tras JwtAuthGuard. */
export type AuthenticatedUser = JwtPayload;
