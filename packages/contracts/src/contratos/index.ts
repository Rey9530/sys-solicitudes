/**
 * Schemas de contratos.
 * Detalles: PLANIFICACION/04-locales-inquilinos-contratos.md (T-054, T-055).
 */
import { z } from 'zod';
import { UuidSchema, PaginationSchema } from '../common/index.js';

export const ContratoEstadoSchema = z.enum(['vigente', 'finalizado', 'cancelado']);
export type ContratoEstado = z.infer<typeof ContratoEstadoSchema>;

// ISO 4217: solo 3 letras mayúsculas
const MONEDA_REGEX = /^[A-Z]{3}$/;

export const CreateContratoSchema = z
  .object({
    localId: UuidSchema,
    inquilinoId: UuidSchema,
    fechaInicio: z.iso.date(),
    fechaFin: z.iso.date().nullable().optional(),
    montoMensual: z.coerce.number().min(0).max(1_000_000_000),
    moneda: z
      .string()
      .regex(MONEDA_REGEX, 'Moneda debe ser código ISO 4217 (3 letras mayúsculas)')
      .default('USD'),
    condiciones: z.string().trim().max(4000).optional(),

    // ── Campos nuevos Excel Hoja 2 U-AK (T-V14+; excluye AD/AE ya en BD,
    // AI ignorado, Y/Z/AA derivados en frontend) ────────────────────────────
    plazoMeses: z
      .coerce.number()
      .int()
      .min(1)
      .max(1200)
      .nullable()
      .optional(),
    areaMt2MedicionReal: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
    cuotaArrendamiento: z.coerce.number().min(0).max(1_000_000_000).nullable().optional(),
    cuotaCam: z.coerce.number().min(0).max(1_000_000_000).nullable().optional(),
    depositoGarantia: z.coerce.number().min(0).max(1_000_000_000).nullable().optional(),
    fechaPagoDeposito: z.iso.date().nullable().optional(),
    fechaEntregaLocal: z.iso.date().nullable().optional(),
    periodoGraciaDias: z
      .coerce.number()
      .int()
      .min(0)
      .max(3650)
      .nullable()
      .optional(),
    inicioOperaciones: z.iso.date().nullable().optional(),
    avisoTerminacion: z.iso.date().nullable().optional(),
    condicionesIncrementoCanon: z.string().trim().max(4000).nullable().optional(),
  })
  .refine(
    (v) => v.fechaFin == null || v.fechaFin >= v.fechaInicio,
    { message: 'fechaFin debe ser >= fechaInicio', path: ['fechaFin'] },
  )
  .refine(
    (v) => v.fechaEntregaLocal == null || v.fechaEntregaLocal >= v.fechaInicio,
    { message: 'fechaEntregaLocal debe ser >= fechaInicio', path: ['fechaEntregaLocal'] },
  )
  .refine(
    (v) => v.fechaPagoDeposito == null || v.fechaPagoDeposito >= v.fechaInicio,
    { message: 'fechaPagoDeposito debe ser >= fechaInicio', path: ['fechaPagoDeposito'] },
  )
  .refine(
    (v) =>
      v.avisoTerminacion == null || v.fechaFin == null || v.avisoTerminacion <= v.fechaFin,
    { message: 'avisoTerminacion debe ser <= fechaFin', path: ['avisoTerminacion'] },
  );
export type CreateContratoInput = z.infer<typeof CreateContratoSchema>;

/**
 * Update sigue limitado a `montoMensual` y `condiciones` (regla RN-CO-5
 * vigente: cambiar fechas/local/inquilino requiere cerrar y crear uno nuevo).
 * Los 11 campos contractuales del Excel NO son editables en PATCH — se
 * capturan al crear/renovar. Para modificarlos: cerrar + crear nuevo.
 */
export const UpdateContratoSchema = z.object({
  montoMensual: z.coerce.number().min(0).max(1_000_000_000).optional(),
  condiciones: z.string().trim().max(4000).nullable().optional(),
});
export type UpdateContratoInput = z.infer<typeof UpdateContratoSchema>;

export const CerrarContratoSchema = z.object({
  motivoFin: z.string().trim().min(1).max(500),
  fechaFinEfectiva: z.iso.date().optional(),
  // T-055: el cierre puede producir `finalizado` (default) o `cancelado`.
  estado: z.enum(['finalizado', 'cancelado']).default('finalizado'),
});
export type CerrarContratoInput = z.infer<typeof CerrarContratoSchema>;

export const RenovarContratoSchema = z
  .object({
    nuevaFechaInicio: z.iso.date(),
    nuevaFechaFin: z.iso.date().nullable().optional(),
    nuevoMontoMensual: z.coerce.number().min(0).max(1_000_000_000).optional(),
  })
  .refine(
    (v) => v.nuevaFechaFin == null || v.nuevaFechaFin >= v.nuevaFechaInicio,
    { message: 'nuevaFechaFin debe ser >= nuevaFechaInicio', path: ['nuevaFechaFin'] },
  );
export type RenovarContratoInput = z.infer<typeof RenovarContratoSchema>;

export const ListContratosQuerySchema = PaginationSchema.extend({
  localId: UuidSchema.optional(),
  inquilinoId: UuidSchema.optional(),
  estado: ContratoEstadoSchema.optional(),
});
export type ListContratosQuery = z.infer<typeof ListContratosQuerySchema>;

export const ContratoOutputSchema = z.object({
  id: UuidSchema,
  plazaId: UuidSchema,
  localId: UuidSchema,
  inquilinoId: UuidSchema,
  fechaInicio: z.iso.date(),
  fechaFin: z.iso.date().nullable(),
  montoMensual: z.number().nullable(),
  moneda: z.string(),
  condiciones: z.string().nullable(),
  estado: ContratoEstadoSchema,
  fechaFinEfectiva: z.iso.date().nullable(),
  motivoFin: z.string().nullable(),

  // ── Campos nuevos Excel Hoja 2 U-AK ─────────────────────────────────────
  plazoMeses: z.number().int().nullable(),
  areaMt2MedicionReal: z.number().nullable(),
  cuotaArrendamiento: z.number().nullable(),
  cuotaCam: z.number().nullable(),
  depositoGarantia: z.number().nullable(),
  fechaPagoDeposito: z.iso.date().nullable(),
  fechaEntregaLocal: z.iso.date().nullable(),
  periodoGraciaDias: z.number().int().nullable(),
  inicioOperaciones: z.iso.date().nullable(),
  avisoTerminacion: z.iso.date().nullable(),
  condicionesIncrementoCanon: z.string().nullable(),

  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ContratoOutput = z.infer<typeof ContratoOutputSchema>;

/** Output enriquecido del listado: razón social y código de local para tablas. */
export const ContratoListItemSchema = ContratoOutputSchema.extend({
  localCodigo: z.string().nullable(),
  inquilinoRazonSocial: z.string().nullable(),
});
export type ContratoListItem = z.infer<typeof ContratoListItemSchema>;

/** Detalle de contrato (T-054): incluye flags de ventana de vencimiento (T-056). */
export const ContratoDetailOutputSchema = ContratoListItemSchema.extend({
  enVentanaT30: z.boolean(),
  enVentanaT7: z.boolean(),
});
export type ContratoDetailOutput = z.infer<typeof ContratoDetailOutputSchema>;

/** Query del historial de contratos por local/inquilino (T-061). */
export const ListContratoHistorialQuerySchema = PaginationSchema.extend({
  estado: ContratoEstadoSchema.optional(),
});
export type ListContratoHistorialQuery = z.infer<typeof ListContratoHistorialQuerySchema>;