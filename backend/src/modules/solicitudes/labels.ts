/**
 * Etiquetas legibles en español para los enums de solicitudes.
 *
 * Pensadas para usarse en:
 *  - Emails de notificación (módulo 09)
 *  - UI (tablas, badges, selects)
 *  - Logs y mensajes de error
 *
 * Si en el futuro se requiere i18n, se cambia a `Record<Enum, Record<Locale, string>>`.
 * Hoy solo 'es-SV' (El Salvador, plaza por defecto del sistema).
 *
 * Los keys coinciden 1:1 con los enums de `packages/contracts/src/solicitudes/index.ts`.
 */

import type {
  SolicitudTipo,
  SolicitudEstado,
  SolicitudPrioridad,
} from '@app/contracts';

/** Etiqueta humana del tipo de solicitud. */
export const SOLICITUD_TIPO_LABEL: Record<SolicitudTipo, string> = {
  mantenimiento: 'Mantenimiento',
  evento: 'Evento',
  remodelacion: 'Remodelación',
  otro: 'Otro',
};

/** Etiqueta humana del estado de solicitud. */
export const SOLICITUD_ESTADO_LABEL: Record<SolicitudEstado, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  asignado: 'Asignada',
  en_revision: 'En revisión',
  aprobada: 'Aprobada',
  cerrada: 'Cerrada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  requerida_subsanacion: 'Requiere cambios',
  pausada: 'Pausada',
};

/** Etiqueta humana de la prioridad.
 *  Escala S-SLA (docs/05-flujo-de-solicitudes.md): A=0.5 (Alta) … F=3.0 (Mínima).
 *  A mayor letra, menor urgencia y mayor SLA efectivo. */
export const SOLICITUD_PRIORIDAD_LABEL: Record<SolicitudPrioridad, string> = {
  A: 'Alta',
  B: 'Media',
  C: 'Baja',
  D: 'Muy baja',
  F: 'Mínima',
};

/** Color (hex) por prioridad — útil para badges en emails y UI. */
export const SOLICITUD_PRIORIDAD_COLOR: Record<SolicitudPrioridad, string> = {
  A: '#b91c1c', // red-700
  B: '#d97706', // amber-600
  C: '#2563eb', // blue-600
  D: '#6b7280', // gray-500
  F: '#a8a29e', // stone-400
};
