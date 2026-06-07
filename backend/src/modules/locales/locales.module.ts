import { Module } from '@nestjs/common';
import { LocalesController } from './locales.controller';
import { LocalesService } from './locales.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { SolicitudStateModule } from '../solicitudes/state/solicitud-state.module';

@Module({
  imports: [AuditoriaModule, SolicitudStateModule],
  controllers: [LocalesController],
  providers: [LocalesService],
  exports: [LocalesService],
})
export class LocalesModule {}
