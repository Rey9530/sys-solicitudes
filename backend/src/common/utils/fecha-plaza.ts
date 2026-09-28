/**
 * Formato de fechas/horas VISIBLES para el usuario (emails, PDFs, exportaciones).
 *
 * Convención (2026-09-28, pedido del cliente): las horas se muestran siempre en
 * 12 horas con sufijo en minúsculas separado por espacio — "2:00 pm", nunca
 * "14:00" ni "14:00:00". El almacenamiento (`hora_inicio`/`hora_fin` "HH:mm",
 * timestamps UTC) sigue en 24h; estas funciones son solo de presentación.
 */

/** Offset fijo de la plaza respecto a UTC (T-V08: America/El_Salvador, sin DST). */
export const PLAZA_UTC_OFFSET_MS = 6 * 3_600_000;

function hhmm12(horas: number, minutos: number): string {
  const sufijo = horas >= 12 ? 'pm' : 'am';
  const h12 = horas % 12 === 0 ? 12 : horas % 12;
  return `${h12}:${String(minutos).padStart(2, '0')} ${sufijo}`;
}

/**
 * Convierte una hora civil "HH:mm" (o "HH:mm:ss") a "h:mm am|pm".
 * Si la entrada no parece una hora la devuelve tal cual (no rompe el render).
 */
export function hora12(hora: string | null | undefined): string | null {
  if (!hora) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hora.trim());
  if (!m) return hora;
  return hhmm12(Number(m[1]), Number(m[2]));
}

/** Instante UTC → "YYYY-MM-DD h:mm am|pm" en hora de la plaza. */
export function fechaHora12(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date.getTime() - PLAZA_UTC_OFFSET_MS);
  const iso = d.toISOString().slice(0, 10);
  return `${iso} ${hhmm12(d.getUTCHours(), d.getUTCMinutes())}`;
}

/** Instante UTC → "h:mm am|pm" en hora de la plaza. */
export function horaPlaza12(date: Date): string {
  const d = new Date(date.getTime() - PLAZA_UTC_OFFSET_MS);
  return hhmm12(d.getUTCHours(), d.getUTCMinutes());
}
