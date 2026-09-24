import { formatInTimeZone } from 'date-fns-tz';

/**
 * Formateo de fechas en la zona de la plaza (T-043).
 *
 * T-V08: la TZ es fija `America/El_Salvador` para toda la plataforma. El backend
 * almacena en UTC (TIMESTAMPTZ); aquí se convierte a la TZ de la plaza al mostrar.
 */
export const PLAZA_TZ = 'America/El_Salvador';

export function formatInPlazaTz(date: Date | string, fmt = 'dd/MM/yyyy HH:mm'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, PLAZA_TZ, fmt);
}

export function formatDateInPlazaTz(date: Date | string): string {
  return formatInPlazaTz(date, 'dd/MM/yyyy');
}

export function formatTimeInPlazaTz(date: Date | string): string {
  return formatInPlazaTz(date, 'HH:mm');
}

/**
 * Fecha civil `"YYYY-MM-DD"` → `"DD-MM-YYYY"` (T-V22, fechas del permiso).
 *
 * Trabaja sobre el string: el valor ya es fecha local de plaza, y pasarlo por
 * `new Date()` lo interpretaría como UTC medianoche y retrocedería un día en UTC-6.
 */
export function formatFechaDMY(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ymd;
}

/** Hora `"HH:mm"` (24h) → 12h con sufijo: `"15:27"` → `"3:27pm"`, `"00:05"` → `"12:05am"`. */
export function formatHora12(hhmm: string | null | undefined): string {
  if (!hhmm) return '—';
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h24 = Number(m[1]);
  const sufijo = h24 < 12 ? 'am' : 'pm';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m[2]}${sufijo}`;
}

/** Convierte un ISO de input a Date (UTC) para enviar al backend. */
export function parseISOToUTC(iso: string): Date {
  return new Date(iso);
}
