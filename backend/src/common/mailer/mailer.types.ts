/**
 * Tipos del MailerModule (T-119).
 *
 * Refactor SMTP → Mailgun API HTTP (`mailgun.js`): el transporte ahora habla
 * con la API REST de Mailgun en lugar de SMTP/Nodemailer. Se conserva la
 * clasificación de errores del plan (InvalidAuth, ConnectionTimeout,
 * RecipientsRefused) + hard bounce (T-124) para no tocar el worker.
 */

export interface MailerOptions {
  /** API key de Mailgun (vacía en dev → modo log-only sin envío real). */
  apiKey: string;
  /** Dominio de envío configurado en Mailgun, e.g. "mg.tudominio.com". */
  domain: string;
  /** Remitente por defecto, e.g. "Plazapp <noreply@plazapp.com>". */
  from: string;
  /** Base URL de la API según región: US `https://api.mailgun.net` | EU `https://api.eu.mailgun.net`. */
  apiUrl: string;
}

export const MAILER_OPTIONS = Symbol('MAILER_OPTIONS');

export type MailerErrorKind =
  | 'invalid_auth'
  | 'connection_timeout'
  | 'recipients_refused'
  | 'hard_bounce'
  | 'unknown';

/**
 * Códigos SMTP de hard bounce (S-Bounce, RN-NE-2).
 * ⚠️ Con la API de Mailgun el envío responde 200 y encola el mensaje; los
 * bounces reales llegan después por webhooks/Events API, NO síncronos. Estos
 * códigos se conservan por compatibilidad con el worker (T-124), pero el
 * `hard_bounce` síncrono rara vez se disparará en modo API.
 */
export const HARD_BOUNCE_CODES = [550, 551, 553];

/** Error de envío con clasificación para el worker (T-122/T-124). */
export class MailerSendError extends Error {
  constructor(
    readonly kind: MailerErrorKind,
    message: string,
    readonly responseCode?: number,
  ) {
    super(message);
    this.name = 'MailerSendError';
  }

  get esHardBounce(): boolean {
    return this.kind === 'hard_bounce';
  }
}
