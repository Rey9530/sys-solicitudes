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
  })
  .refine(
    (v) => v.fechaFin == null || v.fechaFin >= v.fechaInicio,
    { message: 'fechaFin debe ser >= fechaInicio', path: ['fechaFin'] },
  );
export type CreateContratoInput = z.infer<typeof CreateContratoSchema>;

export const UpdateContratoSchema = z.object({
  montoMensual: z.coerce.number().min(0).max(1_000_000_000).optional(),
  condiciones: z.string().trim().max(4000).nullable().optional(),
});
export type UpdateContratoInput = z.infer<typeof UpdateContratoSchema>;

export const CerrarContratoSchema = z.object({
  motivoFin: z.string().trim().min(1).max(500),
  fechaFinEfectiva: z.iso.date().optional(),
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
  montoMensual: z.number(),
  moneda: z.string(),
  condiciones: z.string().nullable(),
  estado: ContratoEstadoSchema,
  fechaFinEfectiva: z.iso.date().nullable(),
  motivoFin: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type ContratoOutput = z.infer<typeof ContratoOutputSchema>;
