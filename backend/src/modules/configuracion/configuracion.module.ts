import { Module } from '@nestjs/common';
import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionService } from './configuracion.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
