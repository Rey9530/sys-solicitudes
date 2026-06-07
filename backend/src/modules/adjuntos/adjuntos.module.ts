import { Module } from '@nestjs/common';
import { AdjuntosController } from './adjuntos.controller';
import { AdjuntosService } from './adjuntos.service';
import { AdjuntoValidator } from './validators/adjunto.validator';
import { QuarantinePurgeCron } from './cron/quarantine-purge.cron';
import { AuditoriaModule } from '../auditoria/auditoria.module';

// ⚠️ fix (módulo 11): ScheduleModule.forRoot() vive SOLO en AppModule.
// Tenerlo aquí Y en NotificacionesModule creaba DOS schedulers y cada @Cron
// de la app disparaba dos veces (detectado por kpi_snapshot duplicado).
@Module({
  imports: [AuditoriaModule],
  controllers: [AdjuntosController],
  providers: [AdjuntosService, AdjuntoValidator, QuarantinePurgeCron],
  exports: [AdjuntosService, AdjuntoValidator],
})
export class AdjuntosModule {}
