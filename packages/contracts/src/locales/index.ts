/**
 * Schemas de locales e inquilinos.
 * Detalles: PLANIFICACION/04-locales-inquilinos-contratos.md (T-051, T-053).
 * Campos de local alineados al formato Excel "INFORMACION PARA CREACION DE LOCALES":
 *   MODULO, NIVEL, LOCAL (codigo), ÁREA (areaM2), MEDIDOR ENERGIA, MEDIDOR AGUA.
 */
import { z } from 'zod';
import { UuidSchema, PaginationSchema } from '../common/index.js';
import { ContratoOutputSchema } from '../contratos/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Local

export const LocalEstadoSchema = z.enum([
  'disponible',
  'alquilado',
  'en_mantenimiento',
  'fuera_de_servicio',
]);
export type LocalEstado = z.infer<typeof LocalEstadoSchema>;

/** Normaliza un medidor (string de dígitos): trim + filtra `null`/`''` → `undefined`. */
const medidorSchema = (max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, 'Solo dígitos')
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const CreateLocalSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(16)
    .regex(/^[A-Z0-9-]+$/, 'El código solo puede contener mayúsculas, dígitos y guiones'),
  modulo: z.string().trim().toUpperCase().min(1).max(20).optional(),
  nivel: z.string().trim().min(1).max(10).optional(),
  areaM2: z.coerce.number().positive().max(1_000_000).optional(),
  medidorEnergia: medidorSchema(20),
  medidorAgua: medidorSchema(20),
});
export type CreateLocalInput = z.infer<typeof CreateLocalSchema>;

export const UpdateLocalSchema = z.object({
  modulo: z.string().trim().toUpperCase().min(1).max(20).nullable().optional(),
  nivel: z.string().trim().min(1).max(10).nullable().optional(),
  areaM2: z.coerce.number().positive().max(1_000_000).nullable().optional(),
  medidorEnergia: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Solo dígitos')
    .max(20)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  medidorAgua: z
    .string()
    .trim()
    .regex(/^\d+$/, 'Solo dígitos')
    .max(20)
    .nullable()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  estado: LocalEstadoSchema.optional(),
});
export type UpdateLocalInput = z.infer<typeof UpdateLocalSchema>;

export const ListLocalesQuerySchema = PaginationSchema.extend({
  estado: LocalEstadoSchema.optional(),
  modulo: z.string().trim().optional(),
  nivel: z.string().trim().optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
export type ListLocalesQuery = z.infer<typeof ListLocalesQuerySchema>;

export const LocalOutputSchema = z.object({
  id: UuidSchema,
  plazaId: UuidSchema,
  codigo: z.string(),
  modulo: z.string().nullable(),
  nivel: z.string().nullable(),
  areaM2: z.number().nullable(),
  medidorEnergia: z.string().nullable(),
  medidorAgua: z.string().nullable(),
  estado: LocalEstadoSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
});
export type LocalOutput = z.infer<typeof LocalOutputSchema>;

/** Detalle de local (T-051): incluye contrato vigente e histórico (T-061). */
export const LocalDetailOutputSchema = LocalOutputSchema.extend({
  contratoVigente: ContratoOutputSchema.nullable(),
  historicoContratos: z.array(ContratoOutputSchema),
});
export type LocalDetailOutput = z.infer<typeof LocalDetailOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Inquilino
//
// Campos alineados al formato Excel "INFORMACION PARA CREACION DE INQUILINOS"
// (Hoja 2, columnas B-T + AL). Los 16 campos de contrato (U-AK) NO están aquí:
// esos viven en el CRUD de `contrato`.
//
// Inmutables tras la creación: `razonSocial` e `identificacion`. El schema de
// update no los expone; para "renombrar" un inquilino se desactiva y se crea
// uno nuevo (trazabilidad legal/contable).

export const InquilinoTipoClienteSchema = z.enum(['grande', 'mediano', 'otro']);
export type InquilinoTipoCliente = z.infer<typeof InquilinoTipoClienteSchema>;

export const CreateInquilinoSchema = z.object({
  // Identidad
  razonSocial: z.string().trim().min(1).max(160),
  identificacion: z.string().trim().max(40).optional(),
  nombreComercial: z.string().trim().max(160).optional(),
  representanteLegal: z.string().trim().max(160).optional(),
  numeroNrc: z.string().trim().max(40).optional(),
  // Canales del inquilino
  correoRecepcionDte: z.string().trim().toLowerCase().email().max(160).optional(),
  numeroTelefono: z.string().trim().max(40).optional(),
  direccion: z.string().trim().max(300).optional(),
  // Contacto 1
  contacto1Nombre: z.string().trim().max(120).optional(),
  contacto1Cargo: z.string().trim().max(80).optional(),
  contacto1Email: z.string().trim().toLowerCase().email().optional(),
  contacto1Telefono: z.string().trim().max(40).optional(),
  // Contacto 2
  contacto2Nombre: z.string().trim().max(120).optional(),
  contacto2Cargo: z.string().trim().max(80).optional(),
  contacto2Email: z.string().trim().toLowerCase().email().max(160).optional(),
  contacto2Telefono: z.string().trim().max(40).optional(),
  // Clasificación
  tipoCliente: InquilinoTipoClienteSchema.optional(),
  giroAutorizado: z.string().trim().max(160).optional(),
  categoria: z.string().trim().max(120).optional(),
  subcategoria: z.string().trim().max(120).optional(),
  // Otros
  comentarios: z.string().trim().max(2000).optional(),
});
export type CreateInquilinoInput = z.infer<typeof CreateInquilinoSchema>;

export const UpdateInquilinoSchema = z.object({
  // Identidad (NO se permiten los inmutables razonSocial ni identificacion)
  nombreComercial: z.string().trim().max(160).nullable().optional(),
  representanteLegal: z.string().trim().max(160).nullable().optional(),
  numeroNrc: z.string().trim().max(40).nullable().optional(),
  // Canales
  correoRecepcionDte: z.string().trim().toLowerCase().email().max(160).nullable().optional(),
  numeroTelefono: z.string().trim().max(40).nullable().optional(),
  direccion: z.string().trim().max(300).nullable().optional(),
  // Contacto 1
  contacto1Nombre: z.string().trim().max(120).nullable().optional(),
  contacto1Cargo: z.string().trim().max(80).nullable().optional(),
  contacto1Email: z.string().trim().toLowerCase().email().nullable().optional(),
  contacto1Telefono: z.string().trim().max(40).nullable().optional(),
  // Contacto 2
  contacto2Nombre: z.string().trim().max(120).nullable().optional(),
  contacto2Cargo: z.string().trim().max(80).nullable().optional(),
  contacto2Email: z.string().trim().toLowerCase().email().max(160).nullable().optional(),
  contacto2Telefono: z.string().trim().max(40).nullable().optional(),
  // Clasificación
  tipoCliente: InquilinoTipoClienteSchema.nullable().optional(),
  giroAutorizado: z.string().trim().max(160).nullable().optional(),
  categoria: z.string().trim().max(120).nullable().optional(),
  subcategoria: z.string().trim().max(120).nullable().optional(),
  // Otros
  comentarios: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateInquilinoInput = z.infer<typeof UpdateInquilinoSchema>;

export const ListInquilinosQuerySchema = PaginationSchema.extend({
  razonSocial: z.string().trim().min(1).max(160).optional(),
  identificacion: z.string().trim().min(1).max(40).optional(),
});
export type ListInquilinosQuery = z.infer<typeof ListInquilinosQuerySchema>;

export const InquilinoOutputSchema = z.object({
  id: UuidSchema,
  plazaId: UuidSchema,
  // Identidad
  razonSocial: z.string(),
  identificacion: z.string().nullable(),
  nombreComercial: z.string().nullable(),
  representanteLegal: z.string().nullable(),
  numeroNrc: z.string().nullable(),
  // Canales
  correoRecepcionDte: z.string().nullable(),
  numeroTelefono: z.string().nullable(),
  direccion: z.string().nullable(),
  // Contacto 1
  contacto1Nombre: z.string().nullable(),
  contacto1Cargo: z.string().nullable(),
  contacto1Email: z.string().nullable(),
  contacto1Telefono: z.string().nullable(),
  // Contacto 2
  contacto2Nombre: z.string().nullable(),
  contacto2Cargo: z.string().nullable(),
  contacto2Email: z.string().nullable(),
  contacto2Telefono: z.string().nullable(),
  // Clasificación
  tipoCliente: InquilinoTipoClienteSchema.nullable(),
  giroAutorizado: z.string().nullable(),
  categoria: z.string().nullable(),
  subcategoria: z.string().nullable(),
  // Otros
  comentarios: z.string().nullable(),
  // Auditoría
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
});
export type InquilinoOutput = z.infer<typeof InquilinoOutputSchema>;

/** Detalle de inquilino: añade contratos (vigentes + histórico) (T-053). */
export const InquilinoDetailOutputSchema = InquilinoOutputSchema.extend({
  contratosVigentes: z.array(ContratoOutputSchema),
  historicoContratos: z.array(ContratoOutputSchema),
});
export type InquilinoDetailOutput = z.infer<typeof InquilinoDetailOutputSchema>;
