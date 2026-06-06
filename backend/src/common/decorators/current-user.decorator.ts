import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../modules/auth/types/jwt-payload';

/**
 * Extrae `request.user` (los claims del JWT) en los handlers.
 * Uso: `@CurrentUser() user: AuthenticatedUser`.
 * Detalles: PLANIFICACION/02-autenticacion-usuarios.md (T-023).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    return request.user;
  },
);
