/**
 * Tipos del MailerModule (T-119).
 *
 * Clasificación de errores SMTP requerida por el plan (InvalidAuth,
 * ConnectionTimeout, RecipientsRefused) + hard bounce (T-124: 550/551/553).
 */

export interface MailerOptions {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
  /** Remitente por defecto, e.g. "Plazapp <noreply@plazapp.com>". */
  from: string;
}

export const MAILER_OPTIONS = Symbol('MAILER_OPTIONS');

export type MailerErrorKind =
  | 'invalid_auth'
  | 'connection_timeout'
  | 'recipients_refused'
  | 'hard_bounce'
  | 'unknown';

/** Códigos SMTP de hard bounce (S-Bounce, RN-NE-2). */
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
