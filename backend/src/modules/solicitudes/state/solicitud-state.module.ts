import { Module } from '@nestjs/common';
import { SolicitudStateService } from './solicitud-state.service';

/**
 * Módulo dedicado del state machine (T-091). Sin dependencias: lo importan
 * SolicitudesModule, AprobacionesModule, CategoriasModule (T-069 masivo) y
 * LocalesModule (T-108) sin crear ciclos.
 */
@Module({
  providers: [SolicitudStateService],
  exports: [SolicitudStateService],
})
export class SolicitudStateModule {}
