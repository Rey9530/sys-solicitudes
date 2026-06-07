import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import {
  HARD_BOUNCE_CODES,
  MAILER_OPTIONS,
  MailerSendError,
  type MailerErrorKind,
  type MailerOptions,
} from './mailer.types';

/**
 * Transporter SMTP único de la app (T-119). Reemplaza al MailerService
 * provisional de auth (T-029): este NO arma HTML — recibe el render final
 * del TemplateRendererService (T-120) y solo envía.
 *
 * En dev apunta a MailHog (localhost:1025, ver docker-compose); en prod al
 * SMTP real con TLS (SMTP_SECURE=true o STARTTLS del servidor).
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter;
  readonly defaultFrom: string;

  constructor(@Inject(MAILER_OPTIONS) options: MailerOptions) {
    this.defaultFrom = options.from;
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.auth,
    });
  }

  /**
   * Envía un email ya renderizado. Lanza `MailerSendError` clasificado
   * (invalid_auth | connection_timeout | recipients_refused | hard_bounce |
   * unknown) para que el caller decida reintento/bounce.
   * Logging SIN el body (solo subject + destinatario), per plan T-119.
   */
  async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.defaultFrom, to, subject, html });
      this.logger.log(`email enviado to=${to} subject="${subject}"`);
    } catch (err) {
      const clasificado = this.clasificar(err);
      this.logger.warn(
        `fallo SMTP to=${to} subject="${subject}" kind=${clasificado.kind}` +
          `${clasificado.responseCode ? ` code=${clasificado.responseCode}` : ''}: ${clasificado.message}`,
      );
      throw clasificado;
    }
  }

  /** Mapea errores de nodemailer a MailerSendError (T-119/T-124). */
  private clasificar(err: unknown): MailerSendError {
    if (err instanceof MailerSendError) return err;
    const e = err as { code?: string; responseCode?: number; message?: string };
    const message = e?.message ?? String(err);
    const responseCode = typeof e?.responseCode === 'number' ? e.responseCode : undefined;

    let kind: MailerErrorKind = 'unknown';
    if (responseCode !== undefined && HARD_BOUNCE_CODES.includes(responseCode)) {
      // 550/551/553: el buzón no existe — bounce permanente (T-124).
      kind = 'hard_bounce';
    } else if (e?.code === 'EAUTH') {
      kind = 'invalid_auth';
    } else if (e?.code === 'ETIMEDOUT' || e?.code === 'ECONNECTION' || e?.code === 'ESOCKET') {
      kind = 'connection_timeout';
    } else if (e?.code === 'EENVELOPE') {
      kind = 'recipients_refused';
    }
    return new MailerSendError(kind, message, responseCode);
  }
}
