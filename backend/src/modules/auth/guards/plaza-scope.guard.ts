import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../types/jwt-payload';

/**
 * Segundo guard del triple guard. Verifica que el `plazaId` de un recurso
 * coincida con el `plazaId` del JWT. `superadmin` opera entre plazas sin scope.
 *
 * T-V01: la resolución de tenant es SOLO por el JWT; NO se usa header
 * `x-plaza-slug` ni subdominio. El `plaza_id` jamás se toma del body como
 * fuente de autoridad (invariante I2 del multi-tenant-auditor): aquí solo se
 * COMPARA un plazaId presente en la ruta/query/body contra el del token.
 * Detalles: PLANIFICACION/02 (T-024), SC-1.
 */
@Injectable()
export class PlazaScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<
      Request & { user?: AuthenticatedUser }
    >();
    const user = request.user;

    // Sin usuario: JwtAuthGuard ya habrá rechazado; defensivo.
    if (!user) {
      return true;
    }

    // superadmin no tiene scope de plaza.
    if (user.rol === 'superadmin') {
      return true;
    }

    // Defensa de segundo nivel: SOLO se compara un plazaId presente en la
    // RUTA o la QUERY (identificadores explícitos del recurso). NUNCA se lee
    // del body: el body jamás es fuente de autoridad del tenant (invariante I2).
    // En rutas sin :plazaId el guard pasa y la aislación recae en el service
    // (que filtra por el plaza_id del JWT) + RLS (T-038).
    const resourcePlazaId =
      (request.params?.plazaId as string | undefined) ??
      (request.query?.plazaId as string | undefined);

    if (resourcePlazaId && resourcePlazaId !== user.plazaId) {
      throw new ForbiddenException({
        code: 'PLAZA_SCOPE_VIOLATION',
        title: 'Acceso denegado',
        message: 'No tiene acceso a recursos de otra plaza.',
      });
    }

    return true;
  }
}
