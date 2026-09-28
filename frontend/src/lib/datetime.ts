import { formatInTimeZone } from 'date-fns-tz';

/**
 * Formateo de fechas en la zona de la plaza (T-043).
 *
 * T-V08: la TZ es fija `America/El_Salvador` para toda la plataforma. El backend
 * almacena en UTC (TIMESTAMPTZ); aquí se convierte a la TZ de la plaza al mostrar.
 *
 * Convención (2026-09-28, pedido del cliente): toda hora VISIBLE va en 12 horas
 * con sufijo en minúsculas separado por espacio — "2:00 pm", nunca "14:00" ni
 * "14:00:00". El almacenamiento y los `<input type="time">` siguen en 24h.
 */

/** Formato date-fns de hora visible: "2:00 pm". */
export const HORA_12H = 'h:mm aaa';
export const PLAZA_TZ = 'America/El_Salvador';

export function formatInPlazaTz(date: Date | string, fmt = `dd/MM/yyyy ${HORA_12H}`): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, PLAZA_TZ, fmt);
}

export function formatDateInPlazaTz(date: Date | string): string {
  return formatInPlazaTz(date, 'dd/MM/yyyy');
}

export function formatTimeInPlazaTz(date: Date | string): string {
  return formatInPlazaTz(date, HORA_12H);
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

/**
 * Hora `"HH:mm"` o `"HH:mm:ss"` (24h) → 12h con sufijo:
 * `"15:27"` → `"3:27 pm"`, `"00:05:00"` → `"12:05 am"`.
 */
export function formatHora12(hhmm: string | null | undefined): string {
  if (!hhmm) return '—';
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h24 = Number(m[1]);
  const sufijo = h24 < 12 ? 'am' : 'pm';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m[2]} ${sufijo}`;
}

/** Horas/minutos (24h) → `"2:00 pm"`. Base de los formateadores de FullCalendar. */
export function hhmm12(horas: number, minutos: number): string {
  const sufijo = horas >= 12 ? 'pm' : 'am';
  const h12 = horas % 12 === 0 ? 12 : horas % 12;
  return `${h12}:${String(minutos).padStart(2, '0')} ${sufijo}`;
}

/**
 * Instante → `"dd/MM/yyyy h:mm am|pm"` en la zona indicada (por defecto la del
 * navegador). Para vistas con switch de TZ (calendario); el resto usa
 * `formatInPlazaTz`.
 */
export function formatFechaHora12(
  date: Date | string,
  timeZone?: string,
  conHora = true,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const tz = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return formatInTimeZone(d, tz, conHora ? `dd/MM/yyyy ${HORA_12H}` : 'dd/MM/yyyy');
}

/** Convierte un ISO de input a Date (UTC) para enviar al backend. */
export function parseISOToUTC(iso: string): Date {
  return new Date(iso);
}
