/**
 * Schemas de locales e inquilinos.
 * Detalles: PLANIFICACION/04-locales-inquilinos-contratos.md (T-051, T-053).
 */
import { z } from 'zod';
import { UuidSchema, PaginationSchema } from '../common/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Local

export const LocalEstadoSchema = z.enum([
  'disponible',
  'alquilado',
  'en_mantenimiento',
  'fuera_de_servicio',
]);
export type LocalEstado = z.infer<typeof LocalEstadoSchema>;

export const CreateLocalSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(16)
    .regex(/^[A-Z0-9-]+$/, 'El código solo puede contener mayúsculas, dígitos y guiones'),
  nombre: z.string().trim().max(120).optional(),
  metrajeM2: z.coerce.number().positive().max(1_000_000).optional(),
  piso: z.string().trim().max(20).optional(),
  sector: z.string().trim().max(60).optional(),
  descripcion: z.string().trim().max(1000).optional(),
});
export type CreateLocalInput = z.infer<typeof CreateLocalSchema>;

export const UpdateLocalSchema = z.object({
  nombre: z.string().trim().max(120).nullable().optional(),
  metrajeM2: z.coerce.number().positive().max(1_000_000).nullable().optional(),
  piso: z.string().trim().max(20).nullable().optional(),
  sector: z.string().trim().max(60).nullable().optional(),
  descripcion: z.string().trim().max(1000).nullable().optional(),
  estado: LocalEstadoSchema.optional(),
});
export type UpdateLocalInput = z.infer<typeof UpdateLocalSchema>;

export const ListLocalesQuerySchema = PaginationSchema.extend({
  estado: LocalEstadoSchema.optional(),
  piso: z.string().trim().optional(),
  sector: z.string().trim().optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
export type ListLocalesQuery = z.infer<typeof ListLocalesQuerySchema>;

export const LocalOutputSchema = z.object({
  id: UuidSchema,
  plazaId: UuidSchema,
  codigo: z.string(),
  nombre: z.string().nullable(),
  metrajeM2: z.number().nullable(),
  piso: z.string().nullable(),
  sector: z.string().nullable(),
  descripcion: z.string().nullable(),
  estado: LocalEstadoSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
});
export type LocalOutput = z.infer<typeof LocalOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Inquilino

export const CreateInquilinoSchema = z.object({
  razonSocial: z.string().trim().min(1).max(160),
  identificacion: z.string().trim().max(40).optional(),
  direccion: z.string().trim().max(300).optional(),
  contactoNombre: z.string().trim().max(120).optional(),
  contactoEmail: z.string().trim().toLowerCase().email().optional(),
  contactoTelefono: z.string().trim().max(40).optional(),
});
export type CreateInquilinoInput = z.infer<typeof CreateInquilinoSchema>;

export const UpdateInquilinoSchema = z.object({
  contactoNombre: z.string().trim().max(120).nullable().optional(),
  contactoEmail: z.string().trim().toLowerCase().email().nullable().optional(),
  contactoTelefono: z.string().trim().max(40).nullable().optional(),
  direccion: z.string().trim().max(300).nullable().optional(),
});
export type UpdateInquilinoInput = z.infer<typeof UpdateInquilinoSchema>;

export const InquilinoOutputSchema = z.object({
  id: UuidSchema,
  plazaId: UuidSchema,
  razonSocial: z.string(),
  identificacion: z.string().nullable(),
  direccion: z.string().nullable(),
  contactoNombre: z.string().nullable(),
  contactoEmail: z.string().nullable(),
  contactoTelefono: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
});
export type InquilinoOutput = z.infer<typeof InquilinoOutputSchema>;
