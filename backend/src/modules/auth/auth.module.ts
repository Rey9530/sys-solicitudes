import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PasswordService } from './services/password.service';
import { TokenService } from './services/token.service';
import { MailerService } from './services/mailer.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { durationToSeconds } from '../../common/utils/duration';

/**
 * Módulo de autenticación (T-023..T-031).
 * Registra la estrategia JWT (HS256 con JWT_SECRET) y los servicios de auth.
 * Los guards (JwtAuthGuard, PlazaScopeGuard, RolesGuard) se registran como
 * APP_GUARD global en AppModule.
 */
@Module({
  imports: [
    PassportModule,
    // T-126: el MailerService legado delega en renderer + cola del módulo 09.
    NotificacionesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: durationToSeconds(config.get<string>('JWT_ACCESS_TTL', '3600s')),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PasswordService, TokenService, MailerService],
  // PasswordService y MailerService se reutilizan en plazas (T-040: crear
  // admin_plaza inicial con hash + email de bienvenida).
  // T-RBAC-1 (fix login 502, 2026-08-07): TokenService se exporta porque
  // `PermissionsGuard` (registrado como APP_GUARD global en AppModule) lo
  // necesita para resolver permisos efectivos desde BD por request. APP_GUARD
  // vive en el injector raíz, así que el provider tiene que ser accesible
  // globalmente (vía exports).
  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    PasswordService,
    MailerService,
    TokenService,
  ],
})
export class AuthModule {}
