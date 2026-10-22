import { Module } from '@nestjs/common';
import { ImportacionController } from './importacion.controller';
import { CargaInicialService } from './carga-inicial.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [ImportacionController],
  providers: [CargaInicialService],
})
export class ImportacionModule {}
