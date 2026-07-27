import { SetMetadata } from '@nestjs/common';

/**
 * T-RBAC-1: decorator de permiso granular. Lo lee `PermissionsGuard`.
 *
 * - `@RequirePermission('solicitud.aprobar')` requiere ese permiso.
 * - `@RequirePermission(['solicitud.aprobar', 'solicitud.rechazar'])`
 *   requiere AL MENOS UNO (OR semántica).
 * - Para AND usar varios decoradores `@RequirePermission(...)` apilados: el
 *   guard evalúa cada uno por separado y exige TODOS.
 * - Sin `@RequirePermission(...)`, el endpoint pasa el guard (compatibilidad
 *   con endpoints que aún no han sido refactorizados).
 * - `@SkipPermissionCheck()` desactiva el guard explícitamente (para casos
 *   puntuales, análogo a `@Public()`/`@SkipAuditoria()`).
 *
 * Detalles: PERMISOS_README.md y docs/07-arquitectura.md §7.4.
 */
export const PERMISSION_KEY = 'permission';

/**
 * Marca el endpoint con uno o varios permisos requeridos. El guard los evalúa
 * con OR; para AND apilar varios `@RequirePermission(...)`.
 */
export const RequirePermission = (
  permiso: string | string[],
): MethodDecorator & ClassDecorator => {
  const list = Array.isArray(permiso) ? permiso : [permiso];
  return SetMetadata(PERMISSION_KEY, list);
};

/**
 * Equivalente a `@Public()` pero a nivel del guard de permisos (no del JWT).
 * Útil cuando un endpoint está abierto a autenticados pero queremos ignorar
 * el chequeo de permisos (e.g., `/auth/me`).
 */
export const SkipPermissionCheck = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSION_KEY, null);