/**
 * Schemas de configuración por plaza de los tipos de solicitud canónicos.
 * Detalles: PLANIFICACION/T-V20 (TIPO_CONFIGURABLE_POR_PLAZA).
 *
 * Decisión vinculante: el `codigo` es siempre uno de los 4 valores del enum
 * `solicitud_tipo` (`mantenimiento | evento | remodelacion | otro`) y NO es
 * editable. Lo configurable por plaza es `etiqueta`, `descripcion`, `orden` y
 * `activo`. El tipo `otro` es siempre activo (regla enforced en el service).
 */
import { z } from 'zod';
import { UuidSchema, PaginationSchema } from '../common/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Codigo canónico (subset del enum solicitud_tipo)
// ─────────────────────────────────────────────────────────────────────────────

/** Uno de los 4 valores del enum PostgreSQL `solicitud_tipo`. */
export const SolicitudTipoCodigoSchema = z.enum(['mantenimiento', 'evento', 'remodelacion', 'otro']);
export type SolicitudTipoCodigo = z.infer<typeof SolicitudTipoCodigoSchema>;

/** Etiquetas default (fallback cuando el admin no configuró nada). */
export const SOLICITUD_TIPO_ETIQUETA_DEFAULT: Record<SolicitudTipoCodigo, string> = {
  mantenimiento: 'Mantenimiento',
  evento: 'Evento',
  remodelacion: 'Remodelación',
  otro: 'Otro',
};

// ─────────────────────────────────────────────────────────────────────────────
// Output / update
// ─────────────────────────────────────────────────────────────────────────────

export const SolicitudTipoConfigOutputSchema = z.object({
  id: UuidSchema,
  plazaId: UuidSchema,
  codigo: SolicitudTipoCodigoSchema,
  etiqueta: z.string(),
  descripcion: z.string().nullable(),
  activo: z.boolean(),
  orden: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SolicitudTipoConfigOutput = z.infer<typeof SolicitudTipoConfigOutputSchema>;

/**
 * Update: solo los campos configurables. `codigo` no se expone.
 * El servicio backend valida que `otro` no se pueda desactivar
 * (TIPO_INMUTABLE) y que un tipo con solicitudes activas no se pueda
 * desactivar (TIPO_CON_SOLICITUDES_ACTIVAS).
 */
export const UpdateSolicitudTipoConfigSchema = z.object({
  etiqueta: z.string().trim().min(1).max(80).optional(),
  descripcion: z.string().trim().max(500).nullable().optional(),
  activo: z.boolean().optional(),
  orden: z.number().int().min(0).max(99).optional(),
});
export type UpdateSolicitudTipoConfigInput = z.infer<typeof UpdateSolicitudTipoConfigSchema>;

export const ListSolicitudTiposConfigQuerySchema = PaginationSchema.extend({
  activo: z.coerce.boolean().optional(),
});
export type ListSolicitudTiposConfigQuery = z.infer<typeof ListSolicitudTiposConfigQuerySchema>;
