import { SetMetadata } from '@nestjs/common';

/**
 * Marca un endpoint como público (sin JwtAuthGuard).
 * Lo leen JwtAuthGuard, PlazaScopeGuard y RolesGuard para saltarse la verificación.
 * Detalles: PLANIFICACION/02-autenticacion-usuarios.md (T-023).
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
