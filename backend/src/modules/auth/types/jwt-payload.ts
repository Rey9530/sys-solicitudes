import type { RolGlobal } from '@app/contracts';

/**
 * Claims del JWT de acceso (HS256). Materializa RN-AU-6.
 *
 * Nota T-V01: la resolución de tenant es ÚNICAMENTE por `plazaId` aquí; no hay
 * subdominio ni header `x-plaza-slug`. `plazaId` es null solo para superadmin.
 *
 * T-RBAC-1: el claim `permisos` lista los códigos de permisos efectivos del
 * usuario en su plaza. Para superadmin es `['*']` (cualquier permiso pasa).
 * Para admin_plaza sin `rolStaffId` se resuelve como todos los del catálogo
 * (compatibilidad hacia atrás con datos pre-RBAC). Para admin_plaza con
 * `rolStaffId` se resuelve con los permisos de ese rol_staff. Para inquilino
 * queda `[]` por defecto en v1 (el RBAC granular aplica solo a admin_plaza).
 */
export interface JwtPayload {
  /** usuario.id */
  sub: string;
  email: string;
  rol: RolGlobal;
  plazaId: string | null;
  rolStaffId: string | null;
  inquilinoId: string | null;
  /**
   * Códigos de permisos efectivos. El PermissionsGuard los evalúa contra los
   * `@RequirePermission(...)` del endpoint (lógica OR por array, AND apilando
   * decoradores). Wildcard `['*']` solo para superadmin.
   */
  permisos: string[];
  /** issued at / expiration (los agrega @nestjs/jwt) */
  iat?: number;
  exp?: number;
}

/** Lo que queda en `request.user` tras JwtAuthGuard. */
export type AuthenticatedUser = JwtPayload & {
  /**
   * Runtime-only (NO es un claim del JWT): true cuando un `superadmin` actúa
   * sobre una plaza concreta vía header `x-plaza-id` (impersonación). Lo setea
   * `PlazaScopeGuard`; en ese caso `plazaId` deja de ser null y pasa a ser la
   * plaza elegida. Sirve para auditoría de la impersonación.
   */
  actingAsPlaza?: boolean;
};
