import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../types/jwt-payload';

/** UUID v1-v5 (formato; la existencia real la garantiza RLS, fail-closed). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    // superadmin no tiene scope de plaza. Puede, opcionalmente, "actuar como"
    // una plaza concreta enviando el header `x-plaza-id` (impersonación). SOLO
    // se lee aquí, dentro del branch superadmin: ningún otro rol puede usarlo.
    // Al fijar `user.plazaId`, los services que usan `requirePlaza`/`withTenant`
    // scopean automáticamente a esa plaza (RLS como última línea de defensa).
    if (user.rol === 'superadmin') {
      const headerPlazaId = request.headers['x-plaza-id'];
      if (typeof headerPlazaId === 'string' && headerPlazaId.length > 0) {
        if (!UUID_RE.test(headerPlazaId)) {
          throw new BadRequestException({
            code: 'PLAZA_ID_INVALIDO',
            title: 'Plaza inválida',
            message: 'El identificador de plaza (x-plaza-id) no es un UUID válido.',
          });
        }
        user.plazaId = headerPlazaId;
        user.actingAsPlaza = true;
      }
      return true;
    }

    // Defensa: para roles no-superadmin, el header `x-plaza-id` se IGNORA por
    // completo (nunca se lee). Su tenant proviene solo del JWT (T-V01) y la
    // comparación de abajo lo sigue enforzando.

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
