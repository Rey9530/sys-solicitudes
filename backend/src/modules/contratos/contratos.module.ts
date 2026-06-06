import { Module } from '@nestjs/common';
import { ContratosController } from './contratos.controller';
import { ContratosService } from './contratos.service';
import { VencimientoAlertCron } from './cron/vencimiento-alert.cron';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthModule } from '../auth/auth.module';
import { AdjuntosModule } from '../adjuntos/adjuntos.module';

@Module({
  // AuthModule aporta MailerService (alertas T-056); AuditoriaModule, AuditoriaService;
  // AdjuntosModule, AdjuntosService (T-062, subida/listado de PDF firmado).
  // El descubrimiento de @Cron lo hace ScheduleModule.forRoot() (NotificacionesModule).
  imports: [AuditoriaModule, AuthModule, AdjuntosModule],
  controllers: [ContratosController],
  providers: [ContratosService, VencimientoAlertCron],
  exports: [ContratosService],
})
export class ContratosModule {}
