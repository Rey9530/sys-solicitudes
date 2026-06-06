/**
 * Schemas de solicitudes + campos extra por tipo (Zod 4 + JSONB).
 * Detalles: PLANIFICACION/06-solicitudes.md (T-078 a T-090).
 *
 * Decisión T-V05:
 *   - Sin recurrencia en v1.
 *   - Umbral aprobación especial: 200 asistentes (configurable por plaza).
 */
import { z } from 'zod';
import { UuidSchema, PaginationSchema } from '../common/index.js';
import { SolicitudPrioridadSchema } from '../categorias/index.js';
import { AdjuntoOutputSchema } from '../adjuntos/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Enums (T-078)

export const SolicitudTipoSchema = z.enum(['mantenimiento', 'evento', 'remodelacion', 'otro']);
export type SolicitudTipo = z.infer<typeof SolicitudTipoSchema>;

export const SolicitudEstadoSchema = z.enum([
  'borrador',
  'enviada',
  'asignado', // T-V03: nuevo estado entre 'enviada' y 'en_revision'
  'en_revision',
  'aprobada',
  'rechazada',
  'cancelada',
  'requerida_subsanacion',
]);
export type SolicitudEstado = z.infer<typeof SolicitudEstadoSchema>;

/** Estados desde los que aún se puede transicionar. */
export const SOLICITUD_ESTADOS_ACTIVOS = [
  'borrador',
  'enviada',
  'asignado',
  'en_revision',
  'requerida_subsanacion',
] as const satisfies readonly SolicitudEstado[];

export const SolicitudHistorialEventoSchema = z.enum([
  'creada',
  'enviada',
  'asignada',
  'tomada',
  'aprobada',
  'rechazada',
  'subsanada',
  'reasignada',
  'cancelada',
  'comentario',
  'adjunto_agregado',
  'prioridad_cambiada',
]);
export type SolicitudHistorialEvento = z.infer<typeof SolicitudHistorialEventoSchema>;

/** Semáforo SLA (S-SLA): null para estados terminales o sin enviar. */
export const SlaStatusSchema = z.enum(['verde', 'amarillo', 'rojo']).nullable();
export type SlaStatus = z.infer<typeof SlaStatusSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Campos extra por tipo (T-079, S-CamposTipo)

export const CamposExtraMantenimientoSchema = z.object({
  area_afectada: z.string().trim().min(1).max(200),
  requiere_ingreso_a_local: z.boolean(),
});
export type CamposExtraMantenimiento = z.infer<typeof CamposExtraMantenimientoSchema>;

export const CamposExtraEventoSchema = z.object({
  asistentes_estimados: z.coerce.number().int().min(1).max(10_000),
  requiere_corte_calle: z.boolean(),
  requiere_amplificacion: z.boolean(),
});
export type CamposExtraEvento = z.infer<typeof CamposExtraEventoSchema>;

export const CamposExtraRemodelacionSchema = z.object({
  fecha_inicio_estimada: z.iso.date(),
  duracion_dias: z.coerce.number().int().min(1).max(365),
  empresa_constructora: z.string().trim().min(1).max(160),
  monto_presupuesto: z.coerce.number().min(0),
});
export type CamposExtraRemodelacion = z.infer<typeof CamposExtraRemodelacionSchema>;

export const CamposExtraOtroSchema = z.object({
  categoria_libre: z.string().trim().min(1).max(120),
  descripcion_larga: z.string().trim().min(1).max(4000),
});
export type CamposExtraOtro = z.infer<typeof CamposExtraOtroSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Crear / actualizar

const BaseSolicitudSchema = z.object({
  localId: UuidSchema,
  tipo: SolicitudTipoSchema,
  titulo: z.string().trim().min(1).max(120),
  descripcion: z.string().trim().min(1).max(4000),
  fechaEventoInicio: z.iso.date().optional(),
  fechaEventoFin: z.iso.date().optional(),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  // categoriaId y subcategoriaId NO se reciben si tipo=otro
  categoriaId: UuidSchema.optional(),
  subcategoriaId: UuidSchema.optional(),
});

export const CreateSolicitudSchema = BaseSolicitudSchema.and(
  z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('mantenimiento'), camposExtra: CamposExtraMantenimientoSchema }),
    z.object({ tipo: z.literal('evento'), camposExtra: CamposExtraEventoSchema }),
    z.object({ tipo: z.literal('remodelacion'), camposExtra: CamposExtraRemodelacionSchema }),
    z.object({ tipo: z.literal('otro'), camposExtra: CamposExtraOtroSchema }),
  ]),
).refine(
  (v) => v.tipo === 'otro' || (v.categoriaId && v.subcategoriaId),
  {
    message: 'categoriaId y subcategoriaId son obligatorios salvo tipo=otro',
    path: ['categoriaId'],
  },
);
export type CreateSolicitudInput = z.infer<typeof CreateSolicitudSchema>;

export const UpdateSolicitudSchema = BaseSolicitudSchema.partial().extend({
  // Para updates permitidos en borrador/requerida_subsanacion
  camposExtra: z.union([
    CamposExtraMantenimientoSchema,
    CamposExtraEventoSchema,
    CamposExtraRemodelacionSchema,
    CamposExtraOtroSchema,
  ]).optional(),
});
export type UpdateSolicitudInput = z.infer<typeof UpdateSolicitudSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Acciones de flujo

export const CancelarSolicitudSchema = z.object({
  motivo: z.string().trim().min(1).max(1000).optional(),
});
export type CancelarSolicitudInput = z.infer<typeof CancelarSolicitudSchema>;

export const RechazarSolicitudSchema = z.object({
  comentario: z.string().trim().min(1).max(4000),
});
export type RechazarSolicitudInput = z.infer<typeof RechazarSolicitudSchema>;

export const SubsanarSolicitudAdminSchema = z.object({
  comentario: z.string().trim().min(1).max(4000),
});
export type SubsanarSolicitudAdminInput = z.infer<typeof SubsanarSolicitudAdminSchema>;

export const UpdatePrioridadSchema = z.object({
  prioridad: SolicitudPrioridadSchema,
});
export type UpdatePrioridadInput = z.infer<typeof UpdatePrioridadSchema>;

export const ReasignarSolicitudSchema = z.object({
  nuevoResponsableId: UuidSchema,
  comentario: z.string().trim().max(1000).optional(),
});
export type ReasignarSolicitudInput = z.infer<typeof ReasignarSolicitudSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Comentarios

export const ComentarioTipoSchema = z.enum(['decision', 'subsanacion', 'general']);
export type ComentarioTipo = z.infer<typeof ComentarioTipoSchema>;

export const CreateComentarioSchema = z.object({
  cuerpo: z.string().trim().min(1).max(4000),
  tipo: ComentarioTipoSchema.default('general'),
});
export type CreateComentarioInput = z.infer<typeof CreateComentarioSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Listado

export const ListSolicitudesQuerySchema = PaginationSchema.extend({
  estado: SolicitudEstadoSchema.optional(),
  tipo: SolicitudTipoSchema.optional(),
  localId: UuidSchema.optional(),
  categoriaId: UuidSchema.optional(),
  subcategoriaId: UuidSchema.optional(),
  prioridad: SolicitudPrioridadSchema.optional(),
  fechaDesde: z.iso.date().optional(),
  fechaHasta: z.iso.date().optional(),
});
export type ListSolicitudesQuery = z.infer<typeof ListSolicitudesQuerySchema>;

/** Heurística de duplicados (T-090): mismo local + tipo, últimos 30 días. */
export const DuplicadosQuerySchema = z.object({
  localId: UuidSchema,
  tipo: SolicitudTipoSchema,
});
export type DuplicadosQuery = z.infer<typeof DuplicadosQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Output

/** Referencia mínima a un usuario (creador/asignado/comentarista). */
export const UsuarioRefSchema = z.object({
  id: UuidSchema,
  nombre: z.string(),
  email: z.string(),
});
export type UsuarioRef = z.infer<typeof UsuarioRefSchema>;

export const SolicitudOutputSchema = z.object({
  id: UuidSchema,
  plazaId: UuidSchema,
  localId: UuidSchema,
  inquilinoId: UuidSchema,
  usuarioCreadorId: UuidSchema,
  adminAsignadoId: UuidSchema.nullable(),
  categoriaId: UuidSchema.nullable(),
  subcategoriaId: UuidSchema.nullable(),
  codigo: z.string(),
  tipo: SolicitudTipoSchema,
  prioridad: SolicitudPrioridadSchema,
  titulo: z.string(),
  descripcion: z.string(),
  estado: SolicitudEstadoSchema,
  camposExtra: z.record(z.string(), z.unknown()),
  fechaEventoInicio: z.iso.date().nullable(),
  fechaEventoFin: z.iso.date().nullable(),
  horaInicio: z.string().nullable(),
  horaFin: z.string().nullable(),
  enviadaAt: z.iso.datetime().nullable(),
  asignadaAt: z.iso.datetime().nullable(),
  decisionAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SolicitudOutput = z.infer<typeof SolicitudOutputSchema>;

/** Item de listado con relaciones aplanadas (T-087/T-106). */
export const SolicitudListItemSchema = SolicitudOutputSchema.extend({
  localCodigo: z.string().nullable(),
  categoriaNombre: z.string().nullable(),
  subcategoriaNombre: z.string().nullable(),
  adminAsignado: UsuarioRefSchema.nullable(),
  slaStatus: SlaStatusSchema,
});
export type SolicitudListItem = z.infer<typeof SolicitudListItemSchema>;

export const ComentarioOutputSchema = z.object({
  id: UuidSchema,
  solicitudId: UuidSchema,
  usuario: UsuarioRefSchema.nullable(),
  tipo: ComentarioTipoSchema,
  cuerpo: z.string(),
  createdAt: z.iso.datetime(),
});
export type ComentarioOutput = z.infer<typeof ComentarioOutputSchema>;

export const SolicitudHistorialOutputSchema = z.object({
  id: UuidSchema,
  solicitudId: UuidSchema,
  usuario: UsuarioRefSchema.nullable(),
  evento: SolicitudHistorialEventoSchema,
  estadoAnterior: SolicitudEstadoSchema.nullable(),
  estadoNuevo: SolicitudEstadoSchema.nullable(),
  comentario: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type SolicitudHistorialOutput = z.infer<typeof SolicitudHistorialOutputSchema>;

/** Detalle completo (T-080/T-089): incluye adjuntos, comentarios e historial. */
export const SolicitudDetailOutputSchema = SolicitudListItemSchema.extend({
  inquilinoRazonSocial: z.string().nullable(),
  usuarioCreador: UsuarioRefSchema.nullable(),
  adjuntos: z.array(AdjuntoOutputSchema),
  comentarios: z.array(ComentarioOutputSchema),
  historial: z.array(SolicitudHistorialOutputSchema),
});
export type SolicitudDetailOutput = z.infer<typeof SolicitudDetailOutputSchema>;
