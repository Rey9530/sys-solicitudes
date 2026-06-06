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

/** Convierte un ISO de input a Date (UTC) para enviar al backend. */
export function parseISOToUTC(iso: string): Date {
  return new Date(iso);
}
