import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { MailerService as SmtpMailerService } from '../../../common/mailer/mailer.service';
import { TemplateRendererService } from '../../notificaciones/template-renderer.service';
import { EmailService } from '../../notificaciones/email.service';
import { PrismaAdminService } from '../../../prisma/prisma-admin.service';

/**
 * Wrapper de compatibilidad (T-126) sobre la infraestructura del módulo 09.
 * Mantiene la API que ya consumían auth (T-029), usuarios (T-059) y plazas
 * (T-040), pero delega en TemplateRendererService (T-120) + SMTP común
 * (T-119) + cola EmailService (T-121).
 *
 * Decisión "híbrido" (sesión 2026-06-07 con el owner):
 *  - reset-password es time-sensitive → se ENVÍA INMEDIATO (sin esperar el
 *    tick de 1 min del worker) y se registra post-envío en email_log.
 *    ⚠️ La resetUrl NO se persiste en email_log (contiene el token en claro:
 *    un admin podría tomar la cuenta desde el preview de T-127) → sin
 *    reintento del worker; si el envío falla, el usuario re-solicita.
 *  - bienvenida va por la COLA estándar (sin secretos; latencia ≤1 min OK).
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(
    private readonly smtp: SmtpMailerService,
    private readonly renderer: TemplateRendererService,
    private readonly emails: EmailService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Email de reset (T-029, crítico): render + envío inmediato. `plazaId`
   * null para superadmin (sin tenant): se envía igual, sin fila en email_log
   * (plaza_id es NOT NULL en la tabla).
   */
  async sendPasswordReset(
    to: string,
    nombre: string,
    resetUrl: string,
    plazaId?: string | null,
  ): Promise<void> {
    const contexto = await this.contextoPlaza(plazaId);
    const { subject, html } = this.renderer.render('reset-password', {
      nombre,
      resetUrl,
      ...contexto,
    });
    const variablesLog = { nombre, resetUrl: '[REDACTADO]' };
    try {
      await this.smtp.send(to, subject, html);
      if (plazaId) {
        await this.registrarEnLog(plazaId, to, 'reset-password', variablesLog, 'enviado');
      }
    } catch (err) {
      // El endpoint de reset SIEMPRE responde 200 (no revela existencia).
      this.logger.error(`no se pudo enviar el reset a ${to}: ${String(err)}`);
      if (plazaId) {
        await this.registrarEnLog(plazaId, to, 'reset-password', variablesLog, 'fallido', err);
      }
    }
  }

  /** Email de bienvenida (RN-AU-8): encolado en email_log; envía el worker. */
  async sendBienvenida(
    to: string,
    nombre: string,
    _plazaNombre: string,
    plazaId: string,
  ): Promise<void> {
    const loginUrl = `${this.frontendUrl()}/login`;
    await this.emails.sendEmail('bienvenida', to, { nombre, email: to, loginUrl }, { plazaId });
  }

  /** Branding para el render inmediato (los encolados los enriquece el worker). */
  private async contextoPlaza(plazaId?: string | null): Promise<Record<string, unknown>> {
    const plaza = plazaId
      ? await this.prismaAdmin.plaza.findUnique({
          where: { id: plazaId },
          select: { nombre_comercial: true, logo_url: true, color_primario: true },
        })
      : null;
    return {
      plaza: {
        nombreComercial: plaza?.nombre_comercial ?? 'Plazapp',
        logoUrl: plaza?.logo_url ?? null,
        colorPrimario: plaza?.color_primario ?? '#2563eb',
      },
      appUrl: this.frontendUrl(),
    };
  }

  /** Registro post-envío (mismo patrón que la alerta T-056). Best-effort. */
  private async registrarEnLog(
    plazaId: string,
    destinatario: string,
    plantilla: string,
    variables: Record<string, unknown>,
    estado: 'enviado' | 'fallido',
    err?: unknown,
  ): Promise<void> {
    await this.prismaAdmin.email_log
      .create({
        data: {
          plaza_id: plazaId,
          destinatario,
          plantilla,
          variables: variables as Prisma.InputJsonValue,
          estado,
          // Fallido por diseño SIN reintentos del worker (la URL va redactada):
          // reintentos agotados para que el reintento manual tampoco lo tome.
          reintentos: estado === 'fallido' ? 3 : 0,
          sent_at: estado === 'enviado' ? new Date() : null,
          last_error: err ? String(err) : null,
        },
      })
      .catch((e: unknown) =>
        this.logger.error(`no se pudo registrar email_log de ${plantilla}: ${String(e)}`),
      );
  }

  private frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, '');
  }
}
