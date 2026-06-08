import { Inject, Injectable, Logger } from '@nestjs/common';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import {
  HARD_BOUNCE_CODES,
  MAILER_OPTIONS,
  MailerSendError,
  type MailerErrorKind,
  type MailerOptions,
} from './mailer.types';

/**
 * Transporte de correo único de la app (T-119). Refactor SMTP → Mailgun API
 * HTTP (`mailgun.js`): ya NO usa Nodemailer; envía por la API REST de Mailgun.
 * Este servicio NO arma HTML — recibe el render final del
 * TemplateRendererService (T-120) y solo envía.
 *
 * - En prod/staging: requiere `MAILGUN_API_KEY` + `MAILGUN_DOMAIN`.
 * - En dev: si NO hay `MAILGUN_API_KEY`, entra en modo log-only (no llama a la
 *   API ni envía correos reales) — reemplaza la necesidad de MailHog.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  /** undefined en modo log-only (sin API key): nunca se usa, ver `send`. */
  private readonly mg?: ReturnType<InstanceType<typeof Mailgun>['client']>;
  private readonly domain: string;
  /** Sin API key (dev): no se envía; solo se loggea (reemplaza MailHog). */
  private readonly devLogOnly: boolean;
  readonly defaultFrom: string;

  constructor(@Inject(MAILER_OPTIONS) options: MailerOptions) {
    this.defaultFrom = options.from;
    this.domain = options.domain;
    this.devLogOnly = !options.apiKey;
    if (this.devLogOnly) {
      // `mailgun.client()` exige `key`: en log-only no se crea el cliente.
      this.logger.warn(
        'MAILGUN_API_KEY no configurada: modo log-only (no se enviarán correos reales).',
      );
    } else {
      const mailgun = new Mailgun(FormData);
      this.mg = mailgun.client({ username: 'api', key: options.apiKey, url: options.apiUrl });
    }
  }

  /**
   * Envía un email ya renderizado vía la API de Mailgun. Lanza
   * `MailerSendError` clasificado (invalid_auth | connection_timeout |
   * recipients_refused | hard_bounce | unknown) para que el caller decida
   * reintento/bounce. Logging SIN el body (solo subject + destinatario).
   */
  async send(to: string, subject: string, html: string): Promise<void> {
    console.log('MailerService.send', { to, subject }); // log básico (sin body)
    if (this.devLogOnly || !this.mg) {
      this.logger.log(`email log-only (sin envío) to=${to} subject="${subject}"`);
      return;
    }
    try {
      await this.mg.messages.create(this.domain, { from: this.defaultFrom, to, subject, html });
      this.logger.log(`email enviado to=${to} subject="${subject}"`);
    } catch (err) {
      const clasificado = this.clasificar(err);
      this.logger.warn(
        `fallo Mailgun to=${to} subject="${subject}" kind=${clasificado.kind}` +
          `${clasificado.responseCode ? ` code=${clasificado.responseCode}` : ''}: ${clasificado.message}`,
      );
      throw clasificado;
    }
  }

  /** Mapea errores de mailgun.js a MailerSendError (T-119/T-124). */
  private clasificar(err: unknown): MailerSendError {
    if (err instanceof MailerSendError) return err;
    const e = err as { code?: string; status?: number; details?: string; message?: string };
    const message = e?.details ?? e?.message ?? String(err);
    const status = typeof e?.status === 'number' ? e.status : undefined;

    let kind: MailerErrorKind = 'unknown';
    if (status !== undefined && HARD_BOUNCE_CODES.includes(status)) {
      // 550/551/553: el buzón no existe — bounce permanente (T-124). Con la API
      // de Mailgun esto rara vez es síncrono (ver nota en mailer.types.ts).
      kind = 'hard_bounce';
    } else if (status === 401) {
      kind = 'invalid_auth';
    } else if (
      e?.code === 'ETIMEDOUT' ||
      e?.code === 'ECONNRESET' ||
      e?.code === 'ECONNECTION' ||
      e?.code === 'ESOCKET' ||
      status === 429 ||
      (status !== undefined && status >= 500)
    ) {
      // Errores transitorios (red o 5xx/429 de Mailgun): reintentables.
      kind = 'connection_timeout';
    } else if (status === 400) {
      kind = 'recipients_refused';
    }
    return new MailerSendError(kind, message, status);
  }
}
