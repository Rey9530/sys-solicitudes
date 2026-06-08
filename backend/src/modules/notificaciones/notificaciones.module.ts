import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
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
  // ⚠️ fix (módulo 11): ScheduleModule.forRoot() vive SOLO en AppModule
  // (duplicarlo creaba dos schedulers y los @Cron corrían dos veces).
  imports: [JwtModule.register({}), AuditoriaModule],
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
