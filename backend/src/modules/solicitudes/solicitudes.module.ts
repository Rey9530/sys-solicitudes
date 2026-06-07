import { Module } from '@nestjs/common';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudStateModule } from './state/solicitud-state.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { CategoriasModule } from '../categorias/categorias.module';
import { AdjuntosModule } from '../adjuntos/adjuntos.module';

@Module({
  imports: [SolicitudStateModule, AuditoriaModule, CategoriasModule, AdjuntosModule],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
