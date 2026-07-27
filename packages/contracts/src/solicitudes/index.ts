/**
 * Schemas de solicitudes + campos extra por tipo (Zod 4 + JSONB).
 * Detalles: PLANIFICACION/06-solicitudes.md (T-078 a T-090).
 *
 * Decisión T-V05:
 *   - Sin recurrencia en v1.
 *   - Umbral aprobación especial: 200 asistentes (configurable por plaza).
 */
import { z } from 'zod';
import { UuidSchema, PaginationSchema, EmailSchema, PhoneSchema } from '../common/index.js';
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
  'pausada', // T-091d-pausar: reversible desde asignado|en_revision, vuelve a en_revision.
]);
export type SolicitudEstado = z.infer<typeof SolicitudEstadoSchema>;

/** Estados desde los que aún se puede transicionar. `pausada` se omite: ya
 *  no requiere acción humana (SLA congelado); pero sigue siendo "viva". */
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
  'pausada', // T-091d-pausar
  'reanudada', // T-091d-pausar
]);
export type SolicitudHistorialEvento = z.infer<typeof SolicitudHistorialEventoSchema>;

/** Semáforo SLA (S-SLA): null para estados terminales o sin enviar. */
export const SlaStatusSchema = z.enum(['verde', 'amarillo', 'rojo']).nullable();
export type SlaStatus = z.infer<typeof SlaStatusSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Campos extra por tipo (T-079, S-CamposTipo)
// T-V21: bloque de asistentes (nombre + documento) transversal a los 4 tipos.
//   - `evento`: `asistentes_estimados` OBLIGATORIO (mín 1, T-V05 umbral aprobación especial).
//   - resto: `asistentes_estimados` OPCIONAL (0 por defecto); si N>0 se piden
//     nombre+documento de cada uno (refine de coherencia abajo).

/** Asistente individual: nombre + documento (DUI, NIT, pasaporte, etc.). */
export const AsistenteSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  documento: z.string().trim().min(3).max(20),
});
export type Asistente = z.infer<typeof AsistenteSchema>;

/**
 * Bloque de asistentes para tipos donde es opcional (mantenimiento, remodelación, otro).
 * `evento` usa una versión estricta con `min(1)` directamente.
 *
 * T-V22: mín 1 (antes 0), máx 20 (antes 10). Aplica a los 4 tipos.
 */
export const AsistentesBloqueSchema = z.object({
  asistentes_estimados: z.coerce.number().int().min(1).max(20),
  asistentes: z.array(AsistenteSchema),
});
export type AsistentesBloque = z.infer<typeof AsistentesBloqueSchema>;

export const CamposExtraMantenimientoSchema = z
  .object({
    area_afectada: z.string().trim().min(1).max(200),
    requiere_ingreso_a_local: z.boolean(),
  })
  .and(AsistentesBloqueSchema);
export type CamposExtraMantenimiento = z.infer<typeof CamposExtraMantenimientoSchema>;

export const CamposExtraEventoSchema = z.object({
  // T-V22: mínimo 1 asistente, tope 20 (antes 10). Se mantiene la regla
  // T-V05 de "umbral aprobación especial" sobre este valor (en el service).
  // T-091d-remove: removidos requiere_corte_calle y requiere_amplificacion
  // (decisión cliente 2026-07-27). Sin impacto en datos: sistema no en
  // producción.
  asistentes_estimados: z.coerce.number().int().min(1).max(20),
  asistentes: z.array(AsistenteSchema),
});
export type CamposExtraEvento = z.infer<typeof CamposExtraEventoSchema>;

export const CamposExtraRemodelacionSchema = z
  .object({
    fecha_inicio_estimada: z.iso.date(),
    duracion_dias: z.coerce.number().int().min(1).max(365),
    empresa_constructora: z.string().trim().min(1).max(160),
    monto_presupuesto: z.coerce.number().min(0),
  })
  .and(AsistentesBloqueSchema);
export type CamposExtraRemodelacion = z.infer<typeof CamposExtraRemodelacionSchema>;

/**
 * T-V21 (Interpretación B): `otro` se comporta como cualquier otro tipo:
 * categoría + subcategoría obligatorias (validado a nivel de CreateSolicitudSchema.refine
 * y en SolicitudesService.resolverSubcategoria). El bloque de asistentes es opcional
 * (puede ser 0 si la solicitud no involucra gente, e.g. "solicito información").
 */
export const CamposExtraOtroSchema = AsistentesBloqueSchema;
export type CamposExtraOtro = z.infer<typeof CamposExtraOtroSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Crear / actualizar

const BaseSolicitudSchema = z.object({
  localId: UuidSchema,
  tipo: SolicitudTipoSchema,
  titulo: z.string().trim().min(1).max(120),
  descripcion: z.string().trim().min(1).max(4000),
  // T-V22: fechas obligatorias para todo tipo (antes opcional, solo evento).
  fechaEventoInicio: z.iso.date(),
  fechaEventoFin: z.iso.date(),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  categoriaId: UuidSchema.optional(),
  subcategoriaId: UuidSchema.optional(),
  // T-V22: bloque transversal empresa ejecutante.
  empresaNombre: z.string().trim().min(1).max(160),
  empresaResponsable: z.string().trim().min(1).max(160),
  empresaTelefono: PhoneSchema,
  empresaEmail: EmailSchema,
  // Contacto de emergencia (en caso de accidente durante el permiso).
  emergenciaContacto: z.string().trim().min(1).max(160),
  emergenciaTelefono: PhoneSchema,
  // Marca de "permiso de emergencia" (S-SO-Emergencia).
  esEmergencia: z.boolean().default(false),
});

export const CreateSolicitudSchema = BaseSolicitudSchema.and(
  z.discriminatedUnion('tipo', [
    z.object({ tipo: z.literal('mantenimiento'), camposExtra: CamposExtraMantenimientoSchema }),
    z.object({ tipo: z.literal('evento'), camposExtra: CamposExtraEventoSchema }),
    z.object({ tipo: z.literal('remodelacion'), camposExtra: CamposExtraRemodelacionSchema }),
    z.object({ tipo: z.literal('otro'), camposExtra: CamposExtraOtroSchema }),
  ]),
)
  // T-V21: categoría y subcategoría obligatorias para TODOS los tipos (antes
  // 'otro' estaba exento). Esto se refuerza también en
  // SolicitudesService.resolverSubcategoria (RN-CA-1).
  .refine((v) => Boolean(v.categoriaId) && Boolean(v.subcategoriaId), {
    message: 'categoriaId y subcategoriaId son obligatorios para todo tipo de solicitud.',
    path: ['categoriaId'],
  })
  // T-V21: coherencia N ↔ lista de asistentes. Si N=0 la lista debe estar
  // vacía; si N>0 la lista debe tener exactamente N elementos (validados por
  // AsistenteSchema). El check fino se hace también en el validator de BE
  // (campos-extra.validator.ts → assertAsistentesCoherentes) para cubrir PATCH
  // donde camposExtra llega por separado.
  .refine(
    (v) => {
      const n = (v.camposExtra as { asistentes_estimados: number }).asistentes_estimados;
      const lista = (v.camposExtra as { asistentes: unknown[] }).asistentes;
      return Array.isArray(lista) && lista.length === n;
    },
    {
      message: 'La lista de asistentes no coincide con la cantidad estimada.',
      path: ['camposExtra'],
    },
  )
  // T-V22: reglas dinámicas de fecha según modo (estándar vs emergencia).
  //   - Estándar: fechaInicio >= ahora + 48h; fechaFin <= fechaInicio + 7d.
  //   - Emergencia: fechaInicio >= ahora; fechaFin <= ahora + 7d.
  //   - En ambos modos: fechaFin >= fechaInicio (mismo día OK).
  // El límite de "3 emergencias/mes" se valida en el servicio
  // (assertLimiteEmergencia, scope: inquilino + mes actual).
  .superRefine((v, ctx) => {
    const inicio = new Date(`${v.fechaEventoInicio}T${v.horaInicio}:00`);
    const fin = new Date(`${v.fechaEventoFin}T${v.horaFin}:00`);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return;
    const ahora = new Date();
    const HORA = 60 * 60 * 1000;
    const DIA = 24 * HORA;

    if (fin < inicio) {
      ctx.addIssue({
        code: 'custom',
        path: ['fechaEventoFin'],
        message: 'La fecha/hora de fin debe ser posterior al inicio.',
      });
    }

    if (v.esEmergencia) {
      if (inicio < ahora) {
        ctx.addIssue({
          code: 'custom',
          path: ['fechaEventoInicio'],
          message: 'La fecha/hora de inicio no puede ser en el pasado.',
        });
      }
      const maxFin = new Date(ahora.getTime() + 7 * DIA);
      if (fin > maxFin) {
        ctx.addIssue({
          code: 'custom',
          path: ['fechaEventoFin'],
          message: 'En modo emergencia la fecha fin no puede exceder 7 días desde hoy.',
        });
      }
    } else {
      const minInicio = new Date(ahora.getTime() + 48 * HORA);
      if (inicio < minInicio) {
        ctx.addIssue({
          code: 'custom',
          path: ['fechaEventoInicio'],
          message: 'La fecha de inicio debe ser al menos 48 horas después de este momento.',
        });
      }
      const maxFin = new Date(inicio.getTime() + 7 * DIA);
      if (fin > maxFin) {
        ctx.addIssue({
          code: 'custom',
          path: ['fechaEventoFin'],
          message: 'La fecha fin no puede exceder 7 días desde la fecha de inicio.',
        });
      }
    }
  });
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

/** T-094: la aprobación admite comentario opcional. */
export const AprobarSolicitudSchema = z.object({
  comentario: z.string().trim().min(1).max(4000).optional(),
});
export type AprobarSolicitudInput = z.infer<typeof AprobarSolicitudSchema>;

/** T-093: liberar devuelve la solicitud a la cola (`enviada`). */
export const LiberarSolicitudSchema = z.object({
  motivo: z.string().trim().max(1000).optional(),
});
export type LiberarSolicitudInput = z.infer<typeof LiberarSolicitudSchema>;

/** T-091d-pausar: pausar solicitud activa. Motivo opcional (visible para el
 *  equipo). Solo transitable desde `asignado` o `en_revision` (validado en
 *  backend). `pausada` NO es terminal: se reanuda con `POST :id/reanudar`. */
export const PausarSolicitudSchema = z.object({
  motivo: z.string().trim().max(1000).optional(),
});
export type PausarSolicitudInput = z.infer<typeof PausarSolicitudSchema>;

/** T-099: bandeja del admin. Acepta cualquier estado del workflow (decisión owner
 *  2026-06-23 — antes restringido a enviada/asignado/en_revision). */
export const BandejaQuerySchema = PaginationSchema.extend({
  estado: z
    .enum([
      'borrador',
      'enviada',
      'asignado',
      'en_revision',
      'requerida_subsanacion',
      'pausada', // T-091d-pausar: filtro explícito para ver pausadas
      'aprobada',
      'rechazada',
      'cancelada',
    ])
    .optional(),
  tipo: SolicitudTipoSchema.optional(),
  categoriaId: UuidSchema.optional(),
  subcategoriaId: UuidSchema.optional(),
  localId: UuidSchema.optional(),
  prioridad: SolicitudPrioridadSchema.optional(),
  /** Default `true` (decisión owner 2026-06-23): la bandeja muestra por defecto
   *  las solicitudes asignadas al admin actual. Pasar `false` (o `?asignadasAMi=false`)
   *  para ver todas las de la plaza. */
  asignadasAMi: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .optional()
    .default(true),
});
export type BandejaQuery = z.infer<typeof BandejaQuerySchema>;

/** T-108: baja de local con rechazo masivo de solicitudes pendientes. */
export const FueraDeServicioSchema = z.object({
  motivo: z.string().trim().min(1).max(1000),
  rechazarSolicitudesPendientes: z.boolean().default(false),
});
export type FueraDeServicioInput = z.infer<typeof FueraDeServicioSchema>;

/** T-128/T-102: evento de calendario 1:1 con la solicitud aprobada. */
export const EventoCalendarioOutputSchema = z.object({
  id: UuidSchema,
  plazaId: UuidSchema,
  solicitudId: UuidSchema,
  titulo: z.string(),
  inicio: z.iso.datetime(),
  fin: z.iso.datetime(),
  color: z.string(),
  createdAt: z.iso.datetime(),
});
export type EventoCalendarioOutput = z.infer<typeof EventoCalendarioOutputSchema>;

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
  // T-V22: bloque empresa ejecutante (transversal).
  empresaNombre: z.string(),
  empresaResponsable: z.string(),
  empresaTelefono: z.string(),
  empresaEmail: z.string(),
  emergenciaContacto: z.string(),
  emergenciaTelefono: z.string(),
  esEmergencia: z.boolean(),
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
