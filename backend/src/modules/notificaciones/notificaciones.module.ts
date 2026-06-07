import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { TemplateRendererService } from './template-renderer.service';
import { EmailService } from './email.service';
import { EmailWorker } from './cron/email-worker.cron';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [NotificacionesController],
  providers: [NotificacionesService, TemplateRendererService, EmailService, EmailWorker],
  exports: [NotificacionesService, TemplateRendererService, EmailService],
})
export class NotificacionesModule {}
