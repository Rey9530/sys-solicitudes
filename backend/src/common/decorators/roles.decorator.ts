import { SetMetadata } from '@nestjs/common';
import type { RolGlobal } from '@app/contracts';

/**
 * Restringe un endpoint a una lista de roles globales.
 * Lo lee RolesGuard. Sin @Roles(), cualquier usuario autenticado pasa.
 * Detalles: PLANIFICACION/02-autenticacion-usuarios.md (T-025).
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: RolGlobal[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
