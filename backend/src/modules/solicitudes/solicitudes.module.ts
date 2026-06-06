import { Module } from '@nestjs/common';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudStateService } from './state/solicitud-state.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { CategoriasModule } from '../categorias/categorias.module';
import { AdjuntosModule } from '../adjuntos/adjuntos.module';

@Module({
  imports: [AuditoriaModule, CategoriasModule, AdjuntosModule],
  controllers: [SolicitudesController],
  providers: [SolicitudesService, SolicitudStateService],
  exports: [SolicitudesService, SolicitudStateService],
})
export class SolicitudesModule {}
