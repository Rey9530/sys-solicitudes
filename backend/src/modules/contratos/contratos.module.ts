import { Module } from '@nestjs/common';
import { ContratosController } from './contratos.controller';
import { ContratosService } from './contratos.service';
import { VencimientoAlertCron } from './cron/vencimiento-alert.cron';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AdjuntosModule } from '../adjuntos/adjuntos.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  // NotificacionesModule aporta EmailService (T-126: alerta T-056 encolada);
  // AuditoriaModule, AuditoriaService; AdjuntosModule, AdjuntosService (T-062).
  // El descubrimiento de @Cron lo hace ScheduleModule.forRoot() (NotificacionesModule).
  imports: [AuditoriaModule, AdjuntosModule, NotificacionesModule],
  controllers: [ContratosController],
  providers: [ContratosService, VencimientoAlertCron],
  exports: [ContratosService],
})
export class ContratosModule {}
