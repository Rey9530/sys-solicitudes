import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Mailer PROVISIONAL para el flujo de reset (T-029).
 *
 * ⚠️ Provisional: el módulo de notificaciones (PLANIFICACION/09, T-118) define
 * la cola `email_log`, el worker con reintentos y las plantillas HTML. Aquí solo
 * enviamos directo por SMTP (MailHog en dev) con una plantilla inline para
 * desbloquear el flujo de auth end-to-end. Reemplazar al implementar T-118.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('SMTP_FROM', 'Plazapp <noreply@plazapp.com>');
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'localhost'),
      port: Number(this.config.get<string>('SMTP_PORT', '1025')),
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: this.config.get<string>('SMTP_USER')
        ? {
            user: this.config.get<string>('SMTP_USER'),
            pass: this.config.get<string>('SMTP_PASSWORD'),
          }
        : undefined,
    });
  }

  async sendPasswordReset(to: string, nombre: string, resetUrl: string): Promise<void> {
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Restablecer contraseña</h2>
        <p>Hola ${this.escape(nombre)},</p>
        <p>Recibimos una solicitud para restablecer tu contraseña en Plazapp.
        El enlace expira en 30 minutos y solo puede usarse una vez.</p>
        <p><a href="${resetUrl}"
          style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;
          text-decoration:none;border-radius:6px;">Restablecer contraseña</a></p>
        <p style="color:#666;font-size:13px;">Si no fuiste tú, ignora este correo.</p>
      </div>`;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Restablecer tu contraseña · Plazapp',
        html,
      });
    } catch (err) {
      // No exponemos fallos de envío al cliente (el endpoint siempre responde 200).
      this.logger.error(`No se pudo enviar el email de reset a ${to}: ${String(err)}`);
    }
  }

  /** Email de bienvenida al crear un usuario admin_plaza (RN-AU-8, T-040). */
  async sendBienvenida(to: string, nombre: string, plazaNombre: string): Promise<void> {
    const loginUrl = `${this.config.get<string>('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, '')}/login`;
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Bienvenido a Plazapp</h2>
        <p>Hola ${this.escape(nombre)},</p>
        <p>Tu cuenta de administrador para <strong>${this.escape(plazaNombre)}</strong>
        ya está activa. Ingresa con el email <strong>${this.escape(to)}</strong> y la
        contraseña que te compartieron.</p>
        <p><a href="${loginUrl}"
          style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;
          text-decoration:none;border-radius:6px;">Ir a Plazapp</a></p>
      </div>`;
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: `Bienvenido a Plazapp · ${plazaNombre}`,
        html,
      });
    } catch (err) {
      this.logger.error(`No se pudo enviar el email de bienvenida a ${to}: ${String(err)}`);
    }
  }

  private escape(value: string): string {
    return value.replace(/[<>&"]/g, (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] ?? c,
    );
  }
}
