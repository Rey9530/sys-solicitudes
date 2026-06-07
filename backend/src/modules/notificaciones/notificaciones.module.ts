import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { TemplateRendererService } from './template-renderer.service';
import { EmailService } from './email.service';
import { UnsubscribeService } from './unsubscribe.service';
import { EmailWorker } from './cron/email-worker.cron';

/**
 * Módulo 09 — notificaciones por email. Es HOJA (no importa módulos de
 * negocio): lo consumen SolicitudStateModule, auth y contratos sin ciclos.
 * JwtModule.register({}) sin secret global: UnsubscribeService firma/verifica
 * pasando el JWT_SECRET por llamada.
 */
@Module({
  imports: [ScheduleModule.forRoot(), JwtModule.register({}), AuditoriaModule],
  controllers: [NotificacionesController],
  providers: [
    NotificacionesService,
    TemplateRendererService,
    EmailService,
    UnsubscribeService,
    EmailWorker,
  ],
  exports: [NotificacionesService, TemplateRendererService, EmailService, UnsubscribeService],
})
export class NotificacionesModule {}
