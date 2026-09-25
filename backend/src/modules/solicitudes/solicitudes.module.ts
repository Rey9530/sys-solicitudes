import { Module } from '@nestjs/common';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudStateModule } from './state/solicitud-state.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { CategoriasModule } from '../categorias/categorias.module';
import { AdjuntosModule } from '../adjuntos/adjuntos.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    SolicitudStateModule,
    AuditoriaModule,
    CategoriasModule,
    AdjuntosModule,
    NotificacionesModule,
  ],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
