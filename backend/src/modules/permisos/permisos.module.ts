import { Module } from '@nestjs/common';
import { PermisosController } from './permisos.controller';
import { PermisosService } from './permisos.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

/**
 * T-RBAC-1: módulo de gestión de la matriz de permisos. Exporta el servicio
 * para que pueda ser consumido por `TokenService` (en `AuthModule`) cuando
 * necesita resolver permisos efectivos al emitir el JWT. Sin embargo, en la
 * implementación actual `TokenService` resuelve permisos directamente vía
 * `PrismaService`/`PrismaAdminService` para evitar la dependencia circular.
 */
@Module({
  imports: [AuditoriaModule],
  controllers: [PermisosController],
  providers: [PermisosService],
  exports: [PermisosService],
})
export class PermisosModule {}