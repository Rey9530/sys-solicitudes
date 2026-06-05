import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { EmailWorker } from './cron/email-worker.cron';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, EmailWorker],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
