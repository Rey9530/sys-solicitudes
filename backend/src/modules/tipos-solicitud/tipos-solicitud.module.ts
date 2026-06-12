import { Module } from '@nestjs/common';
import { TiposSolicitudController } from './tipos-solicitud.controller';
import { TiposSolicitudService } from './tipos-solicitud.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

/**
 * Módulo 13 (T-V20): configuración por plaza de los tipos de solicitud.
 * Sin dependencias circulares: solo lee de `solicitud` para validar el bloqueo
 * por solicitudes activas.
 */
@Module({
  imports: [AuditoriaModule],
  controllers: [TiposSolicitudController],
  providers: [TiposSolicitudService],
  exports: [TiposSolicitudService],
})
export class TiposSolicitudModule {}
