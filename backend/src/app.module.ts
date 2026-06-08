import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './modules/auth/auth.module';
import { PlazasModule } from './modules/plazas/plazas.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { RolesStaffModule } from './modules/roles-staff/roles-staff.module';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module';
import { LocalesModule } from './modules/locales/locales.module';
import { InquilinosModule } from './modules/inquilinos/inquilinos.module';
import { ContratosModule } from './modules/contratos/contratos.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { SolicitudesModule } from './modules/solicitudes/solicitudes.module';
import { AprobacionesModule } from './modules/aprobaciones/aprobaciones.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { CalendarioModule } from './modules/calendario/calendario.module';
import { AdjuntosModule } from './modules/adjuntos/adjuntos.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { HealthModule } from './modules/health/health.module';

import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { MailerModule } from './common/mailer/mailer.module';
import { buildPinoOptions } from './common/logger/pino.config';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PlazaScopeGuard } from './modules/auth/guards/plaza-scope.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    // Configuración global (.env)
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
    }),

    // Logger pino con requestId context (T-013)
    LoggerModule.forRootAsync({ useFactory: () => buildPinoOptions() }),

    // Scheduler de crons — ÚNICA registración de toda la app (fix módulo 11:
    // estaba duplicado en AdjuntosModule y NotificacionesModule y cada @Cron
    // disparaba dos veces).
    ScheduleModule.forRoot(),

    // Rate limit global: 100 req/min por IP
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60_000,
        limit: 100,
      },
    ]),

    // BD
    PrismaModule,

    // Storage S3-compatible (MinIO)
    StorageModule,

    // Transporter SMTP (T-119): MailHog en dev, SMTP real con TLS en prod
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        host: config.get<string>('SMTP_HOST', 'localhost'),
        port: Number(config.get<string>('SMTP_PORT', '1025')),
        secure: config.get<string>('SMTP_SECURE', 'false') === 'true',
        auth: config.get<string>('SMTP_USER')
          ? {
              user: config.get<string>('SMTP_USER', ''),
              pass: config.get<string>('SMTP_PASSWORD', ''),
            }
          : undefined,
        from: config.get<string>('SMTP_FROM', 'Plazapp <noreply@plazapp.com>'),
      }),
    }),

    // Módulos funcionales
    AuthModule,
    PlazasModule,
    ConfiguracionModule,
    UsuariosModule,
    RolesStaffModule,
    LocalesModule,
    InquilinosModule,
    ContratosModule,
    CategoriasModule,
    // AprobacionesModule ANTES de SolicitudesModule: sus rutas estaticas
    // (/solicitudes/bandeja, /solicitudes/cron/*) deben registrarse antes
    // que el parametro :id del controller de solicitudes.
    AprobacionesModule,
    SolicitudesModule,
    NotificacionesModule,
    CalendarioModule,
    AdjuntosModule,
    ReportesModule,
    AdminModule,
    AuditoriaModule,
    HealthModule,
  ],
  providers: [
    // El orden define la ejecución del triple guard (T-023..T-025):
    //   1) Throttler (rate limit)  2) JwtAuthGuard  3) PlazaScopeGuard  4) RolesGuard
    // Los endpoints @Public() se saltan los guards 2-4.
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PlazaScopeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
