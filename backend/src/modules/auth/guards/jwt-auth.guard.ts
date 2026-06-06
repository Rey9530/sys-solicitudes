import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

/**
 * Primer guard del triple guard. Valida el JWT salvo en endpoints @Public().
 * Diferencia token expirado (TOKEN_EXPIRED) de inválido/ausente (TOKEN_INVALID).
 * Detalles: PLANIFICACION/02 (T-023).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  override handleRequest<TUser>(
    err: unknown,
    user: TUser,
    info: { name?: string; message?: string } | undefined,
  ): TUser {
    if (err || !user) {
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          code: 'TOKEN_EXPIRED',
          title: 'No autenticado',
          message: 'El token de acceso ha expirado.',
        });
      }
      if (info?.message?.toLowerCase().includes('signature')) {
        throw new UnauthorizedException({
          code: 'TOKEN_MISSING_SIGNATURE',
          title: 'No autenticado',
          message: 'El token no tiene una firma válida.',
        });
      }
      throw new UnauthorizedException({
        code: 'TOKEN_INVALID',
        title: 'No autenticado',
        message: 'Token inválido o ausente.',
      });
    }
    return user;
  }
}
