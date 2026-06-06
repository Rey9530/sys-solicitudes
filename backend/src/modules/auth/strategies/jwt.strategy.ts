import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload, AuthenticatedUser } from '../types/jwt-payload';

/**
 * Estrategia passport-jwt. Valida la firma HS256 con JWT_SECRET y la expiración.
 * El token SOLO se acepta en el header `Authorization: Bearer <token>` (SEC-4):
 * nunca en query string. Detalles: PLANIFICACION/02 (T-023).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
    });
  }

  /** Lo retornado aquí queda en `request.user`. */
  validate(payload: JwtPayload): AuthenticatedUser {
    return payload;
  }
}
