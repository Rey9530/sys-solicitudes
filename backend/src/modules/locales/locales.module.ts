import { Module } from '@nestjs/common';
import { LocalesController } from './locales.controller';
import { LocalesService } from './locales.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { SolicitudStateModule } from '../solicitudes/state/solicitud-state.module';
import { AdjuntosModule } from '../adjuntos/adjuntos.module';

@Module({
  imports: [AuditoriaModule, SolicitudStateModule, AdjuntosModule],
  controllers: [LocalesController],
  providers: [LocalesService],
  exports: [LocalesService],
})
export class LocalesModule {}
