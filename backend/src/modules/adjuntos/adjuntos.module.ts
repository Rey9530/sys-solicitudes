import { Module } from '@nestjs/common';
import { AdjuntosController } from './adjuntos.controller';
import { AdjuntosService } from './adjuntos.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [AdjuntosController],
  providers: [AdjuntosService],
  exports: [AdjuntosService],
})
export class AdjuntosModule {}
