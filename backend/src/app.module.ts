import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './modules/auth/auth.module';
import { PlazasModule } from './modules/plazas/plazas.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { RolesStaffModule } from './modules/roles-staff/roles-staff.module';
import { LocalesModule } from './modules/locales/locales.module';
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
import { buildPinoOptions } from './common/logger/pino.config';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';

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

    // Módulos funcionales
    AuthModule,
    PlazasModule,
    UsuariosModule,
    RolesStaffModule,
    LocalesModule,
    ContratosModule,
    CategoriasModule,
    SolicitudesModule,
    AprobacionesModule,
    NotificacionesModule,
    CalendarioModule,
    AdjuntosModule,
    ReportesModule,
    AdminModule,
    AuditoriaModule,
    HealthModule,
  ],
  providers: [
    // ThrottlerGuard global detrás de proxy (T-014). 100 req/min por IP.
    // Se sobreescribe con @Throttle() en endpoints sensibles (e.g. /auth/login).
    { provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard },
  ],
})
export class AppModule {}
