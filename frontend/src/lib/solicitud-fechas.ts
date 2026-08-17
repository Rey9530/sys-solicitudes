/**
 * Helpers puros para validación de fechas y reglas de la solicitud (T-V22).
 *
 * Toda la lógica de "lead time de 48h", "7 días de duración", y "modo
 * emergencia" vive acá. Es consumida por el wizard del inquilino para
 * espejar (no reemplazar) la validación Zod del backend.
 *
 * El backend sigue siendo la fuente de verdad (SolicitudesService +
 * CreateSolicitudSchema.superRefine). Estos helpers dan feedback rápido en
 * la UI mientras el usuario llena el formulario.
 *
 * Actualización (2026-08-16): se añade el tope superior de anticipación
 * (5 días en estándar, 48 h en emergencia) y se migra el formateo a
 * `aYMDLocal()` para que las funciones `min*`/`max*` coincidan con la
 * validación por timestamp de `validarRangoFechas` independientemente de la
 * zona horaria del navegador.
 */
const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;

/** Formatea un Date a YYYY-MM-DD en zona local. Se usa en los atributos
 *  `min`/`max` del date picker para evitar el desfase de 1 día que producía
 *  `Date#toISOString().slice(0, 10)` en husos UTC− (p.ej. El Salvador UTC−6,
 *  donde a partir de las 18:00 locales el string sale del día siguiente). */
function aYMDLocal(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Lead time mínimo en modo estándar: la fechaInicio debe ser al menos 48h
 *  después del momento de elaboración del permiso. */
export const MIN_LEAD_HOURS = 48;

/** Ventana máxima de anticipación en modo estándar: la fechaInicio no puede
 *  ser más de 5 días después del momento de elaboración. Decisión del cliente
 *  (2026-08-16): sin un tope, los inquilinos podían agendar permisos a meses
 *  vista, vaciando de sentido el modo emergencia y su cupo de 3/mes. */
export const MAX_LEAD_DAYS = 5;

/** En modo emergencia el inicio debe caer dentro de las próximas 48h
 *  (si cabe más allá, corresponde un permiso estándar). */
export const MAX_LEAD_HOURS_EMERGENCIA = 48;

/** Duración máxima del permiso (estándar y emergencia). */
export const MAX_DURATION_DAYS = 7;

/** Máximo de permisos de emergencia por inquilino por mes (enforcement backend). */
export const MAX_EMERGENCIAS_POR_MES = 3;

/** Rango de la cantidad de personal (asistentes_estimados). */
export const MIN_PERSONAL = 1;
export const MAX_PERSONAL = 20;

/** Fecha mínima permitida para fechaInicio en modo estándar: ahora + 48h.
 *  Retorna string en formato YYYY-MM-DD listo para <input type="date" min="..."/>. */
export function minFechaInicioEstandar(now: Date = new Date()): string {
  return aYMDLocal(new Date(now.getTime() + MIN_LEAD_HOURS * HORA_MS));
}

/** Fecha máxima permitida para fechaInicio en modo estándar: ahora + 5 días.
 *  Espeja el límite superior que valida `validarRangoFechas` y Zod. */
export function maxFechaInicioEstandar(now: Date = new Date()): string {
  return aYMDLocal(new Date(now.getTime() + MAX_LEAD_DAYS * DIA_MS));
}

/** Fecha mínima permitida para fechaInicio en modo emergencia: hoy. */
export function minFechaInicioEmergencia(now: Date = new Date()): string {
  return aYMDLocal(now);
}

/** Fecha máxima permitida para fechaInicio en modo emergencia: ahora + 48h.
 *  Pasado ese límite corresponde un permiso estándar. */
export function maxFechaInicioEmergencia(now: Date = new Date()): string {
  return aYMDLocal(new Date(now.getTime() + MAX_LEAD_HOURS_EMERGENCIA * HORA_MS));
}

/** Fecha máxima permitida para fechaFin en modo estándar: fechaInicio + 7 días.
 *  Si no hay fechaInicio, cae a `now + 7 días`. */
export function maxFechaFinEstandar(fechaInicio: string, now: Date = new Date()): string {
  const base = fechaInicio ? new Date(`${fechaInicio}T00:00:00`) : now;
  return aYMDLocal(new Date(base.getTime() + MAX_DURATION_DAYS * DIA_MS));
}

/** Fecha máxima permitida para fechaFin en modo emergencia: ahora + 7 días. */
export function maxFechaFinEmergencia(now: Date = new Date()): string {
  return aYMDLocal(new Date(now.getTime() + MAX_DURATION_DAYS * DIA_MS));
}

/** Valida el rango fechaInicio..fechaFin según modo.
 *  Retorna string con el mensaje de error, o null si todo OK.
 *  Si falta algún input, retorna null (la obligatoriedad se valida aparte). */
export function validarRangoFechas(
  fechaInicio: string,
  fechaFin: string,
  horaInicio: string,
  horaFin: string,
  esEmergencia: boolean,
  now: Date = new Date(),
): string | null {
  if (!fechaInicio || !fechaFin || !horaInicio || !horaFin) return null;

  const inicio = new Date(`${fechaInicio}T${horaInicio}:00`);
  const fin = new Date(`${fechaFin}T${horaFin}:00`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    return 'Fecha u hora inválida.';
  }

  if (fin < inicio) {
    return 'La fecha/hora de fin debe ser posterior al inicio.';
  }

  if (esEmergencia) {
    if (inicio < now) {
      return 'La fecha de inicio no puede ser en el pasado.';
    }
    const maxInicioEm = new Date(now.getTime() + MAX_LEAD_HOURS_EMERGENCIA * HORA_MS);
    if (inicio > maxInicioEm) {
      return 'En modo emergencia el inicio debe ser dentro de las próximas 48 horas. Para fechas posteriores usa un permiso estándar.';
    }
    const maxFin = new Date(now.getTime() + MAX_DURATION_DAYS * DIA_MS);
    if (fin > maxFin) {
      return 'En modo emergencia la fecha fin no puede exceder 7 días desde hoy.';
    }
  } else {
    const minInicio = new Date(now.getTime() + MIN_LEAD_HOURS * HORA_MS);
    if (inicio < minInicio) {
      return 'La fecha de inicio debe ser al menos 48 horas después de este momento.';
    }
    const maxInicioStd = new Date(now.getTime() + MAX_LEAD_DAYS * DIA_MS);
    if (inicio > maxInicioStd) {
      return 'La fecha de inicio no puede ser más de 5 días después de este momento.';
    }
    const maxFin = new Date(inicio.getTime() + MAX_DURATION_DAYS * DIA_MS);
    if (fin > maxFin) {
      return 'La fecha fin no puede exceder 7 días desde la fecha de inicio.';
    }
  }
  return null;
}

/** Validación simple de email (regex pragmático, no RFC 5322 completo). */
export function emailBasicoValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Validación de teléfono (8-20 chars, dígitos/espacios/+/-/paréntesis). */
export function telefonoBasicoValido(telefono: string): boolean {
  return /^[0-9+\-\s()]{8,20}$/.test(telefono.trim());
}