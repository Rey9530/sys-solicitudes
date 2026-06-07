import { Module } from '@nestjs/common';
import { SolicitudStateService } from './solicitud-state.service';
import { NotificacionesModule } from '../../notificaciones/notificaciones.module';

/**
 * Módulo dedicado del state machine (T-091). Lo importan SolicitudesModule,
 * AprobacionesModule, CategoriasModule (T-069 masivo) y LocalesModule (T-108)
 * sin crear ciclos. Desde T-121 importa NotificacionesModule (EmailService,
 * que es hoja: no depende de ningún módulo de negocio).
 */
@Module({
  imports: [NotificacionesModule],
  providers: [SolicitudStateService],
  exports: [SolicitudStateService],
})
export class SolicitudStateModule {}
