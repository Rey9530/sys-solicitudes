import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
import { TiposSolicitudModule } from './modules/tipos-solicitud/tipos-solicitud.module';
import { SolicitudesModule } from './modules/solicitudes/solicitudes.module';
import { AprobacionesModule } from './modules/aprobaciones/aprobaciones.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { CalendarioModule } from './modules/calendario/calendario.module';
import { AdjuntosModule } from './modules/adjuntos/adjuntos.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { HealthModule } from './modules/health/health.module';
import { PermisosModule } from './modules/permisos/permisos.module';

import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './common/storage/storage.module';
import { MailerModule } from './common/mailer/mailer.module';
import { buildPinoOptions } from './common/logger/pino.config';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';
import { AuditoriaInterceptor } from './common/interceptors/auditoria.interceptor';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PlazaScopeGuard } from './modules/auth/guards/plaza-scope.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

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
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),

    // BD
    PrismaModule,

    // Storage S3-compatible (MinIO)
    StorageModule,

    // Transporte de correo (T-119): Mailgun API HTTP. Sin MAILGUN_API_KEY en
    // dev → modo log-only (no envía). En prod/staging usa la API real.
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        apiKey: config.get<string>('MAILGUN_API_KEY', ''),
        domain: config.get<string>('MAILGUN_DOMAIN', ''),
        from: config.get<string>('MAILGUN_FROM', 'Plazapp <noreply@plazapp.com>'),
        apiUrl: config.get<string>('MAILGUN_API_URL', 'https://api.mailgun.net'),
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
    TiposSolicitudModule,
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
    PermisosModule,
  ],
  providers: [
    // El orden define la ejecución de los guards (T-023..T-025 + T-RBAC-1):
    //   1) Throttler (rate limit)  2) JwtAuthGuard  3) PlazaScopeGuard  4) RolesGuard
    //   5) PermissionsGuard (T-RBAC-1: gating fino por permiso granular)
    // Los endpoints @Public() se saltan los guards 2-5.
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PlazaScopeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // T-150: captura automática de auditoría (opt-in vía @Auditable).
    { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor },
  ],
})
export class AppModule {}
