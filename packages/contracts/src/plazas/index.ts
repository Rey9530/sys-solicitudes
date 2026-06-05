/**
 * Schemas de plazas.
 * Detalles: PLANIFICACION/03-plazas-multitenant.md (T-040, T-044).
 */
import { z } from 'zod';
import { UuidSchema, PaginationSchema } from '../common/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Slug de plaza (inmutable, usado como identificador interno tras T-V01)

export const SlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9-]+$/, 'El slug solo puede contener minúsculas, dígitos y guiones');
export type Slug = z.infer<typeof SlugSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Color HEX (#RRGGBB)

export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color debe ser HEX (#RRGGBB)');
export type HexColor = z.infer<typeof HexColorSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// TZ fija en El Salvador (decisión T-V08)

export const TimezoneSchema = z.literal('America/El_Salvador');
export type Timezone = z.infer<typeof TimezoneSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Crear plaza

export const CreatePlazaSchema = z.object({
  slug: SlugSchema,
  nombreComercial: z.string().trim().min(1).max(120),
  emailContacto: z.string().trim().toLowerCase().email().optional(),
  telefonoContacto: z.string().trim().max(40).optional(),
  colorPrimario: HexColorSchema.default('#2563eb'),
  adminPlazaInicial: z
    .object({
      email: z.string().trim().toLowerCase().email(),
      nombre: z.string().trim().min(1).max(120),
      password: z.string().min(8).max(128),
      rolStaffCodigo: z.string().min(1).max(40),
    })
    .optional(),
});
export type CreatePlazaInput = z.infer<typeof CreatePlazaSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar plaza (slug NO modificable)

export const UpdatePlazaSchema = z.object({
  nombreComercial: z.string().trim().min(1).max(120).optional(),
  emailContacto: z.string().trim().toLowerCase().email().nullable().optional(),
  telefonoContacto: z.string().trim().max(40).nullable().optional(),
  colorPrimario: HexColorSchema.optional(),
});
export type UpdatePlazaInput = z.infer<typeof UpdatePlazaSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Configuración 1:1 con plaza

export const ConfiguracionSchema = z.object({
  tamanioMaxArchivoMb: z.number().int().min(1).max(2048), // T-V06: 50 MB default
  mimeTypesPermitidos: z.array(z.string()).min(1),
  slaDiasPorTipo: z.object({
    mantenimiento: z.number().min(0),
    evento: z.number().min(0),
    remodelacion: z.number().min(0),
    otro: z.number().min(0),
  }),
  slaMultiplicadorPorPrioridad: z.object({
    A: z.number().min(0),
    B: z.number().min(0),
    C: z.number().min(0),
    D: z.number().min(0),
    F: z.number().min(0),
  }),
  calendarMostrarHitosContrato: z.boolean(),
  aprobacionEspecialAsistentesMin: z.number().int().min(1), // T-V05
});
export type Configuracion = z.infer<typeof ConfiguracionSchema>;

export const UpdateConfiguracionSchema = ConfiguracionSchema.partial();
export type UpdateConfiguracionInput = z.infer<typeof UpdateConfiguracionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Listado

export const ListPlazasQuerySchema = PaginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
});
export type ListPlazasQuery = z.infer<typeof ListPlazasQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Output

export const PlazaOutputSchema = z.object({
  id: UuidSchema,
  slug: SlugSchema,
  nombreComercial: z.string(),
  emailContacto: z.string().nullable(),
  telefonoContacto: z.string().nullable(),
  logoUrl: z.string().nullable(),
  colorPrimario: HexColorSchema,
  timezone: TimezoneSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
});
export type PlazaOutput = z.infer<typeof PlazaOutputSchema>;
