import { Module } from '@nestjs/common';
import { AprobacionesController } from './aprobaciones.controller';
import { AprobacionesService } from './aprobaciones.service';
import { AutoAsignacionCron } from './cron/auto-asignacion.cron';
import { SlaRefreshCron } from './cron/sla-refresh.cron';
import { MantenimientoFinCron } from './cron/mantenimiento-fin.cron';
import { SolicitudStateModule } from '../solicitudes/state/solicitud-state.module';
import { CategoriasModule } from '../categorias/categorias.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [SolicitudStateModule, CategoriasModule, AuditoriaModule],
  controllers: [AprobacionesController],
  providers: [AprobacionesService, AutoAsignacionCron, SlaRefreshCron, MantenimientoFinCron],
  exports: [AprobacionesService],
})
export class AprobacionesModule {}
