import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AdjuntosController } from './adjuntos.controller';
import { AdjuntosService } from './adjuntos.service';
import { AdjuntoValidator } from './validators/adjunto.validator';
import { QuarantinePurgeCron } from './cron/quarantine-purge.cron';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [ScheduleModule.forRoot(), AuditoriaModule],
  controllers: [AdjuntosController],
  providers: [AdjuntosService, AdjuntoValidator, QuarantinePurgeCron],
  exports: [AdjuntosService, AdjuntoValidator],
})
export class AdjuntosModule {}
