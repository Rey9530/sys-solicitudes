/**
 * Schemas de categorías y subcategorías.
 * Detalles: PLANIFICACION/05-categorias-subcategorias.md (T-067, T-068, T-069, T-070).
 */
import { z } from 'zod';
import { UuidSchema, PaginationSchema } from '../common/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Categoría

export const CreateCategoriaSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  descripcion: z.string().trim().max(500).optional(),
});
export type CreateCategoriaInput = z.infer<typeof CreateCategoriaSchema>;

export const UpdateCategoriaSchema = z.object({
  nombre: z.string().trim().min(1).max(80).optional(),
  descripcion: z.string().trim().max(500).nullable().optional(),
  activo: z.boolean().optional(),
});
export type UpdateCategoriaInput = z.infer<typeof UpdateCategoriaSchema>;

export const CategoriaOutputSchema = z.object({
  id: UuidSchema,
  plazaId: UuidSchema,
  nombre: z.string(),
  descripcion: z.string().nullable(),
  activo: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type CategoriaOutput = z.infer<typeof CategoriaOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Subcategoría

export const SolicitudPrioridadSchema = z.enum(['A', 'B', 'C', 'D', 'F']);
export type SolicitudPrioridad = z.infer<typeof SolicitudPrioridadSchema>;

export const CreateSubcategoriaSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  descripcion: z.string().trim().max(500).optional(),
  responsableId: UuidSchema,
  prioridad: SolicitudPrioridadSchema.default('B'),
  supervisorIds: z.array(UuidSchema).max(5).default([]),
});
export type CreateSubcategoriaInput = z.infer<typeof CreateSubcategoriaSchema>;

export const UpdateSubcategoriaSchema = z.object({
  nombre: z.string().trim().min(1).max(80).optional(),
  descripcion: z.string().trim().max(500).nullable().optional(),
  prioridad: SolicitudPrioridadSchema.optional(),
  activo: z.boolean().optional(),
});
export type UpdateSubcategoriaInput = z.infer<typeof UpdateSubcategoriaSchema>;

export const SetResponsableSubcategoriaSchema = z.object({
  responsableId: UuidSchema,
});
export type SetResponsableSubcategoriaInput = z.infer<typeof SetResponsableSubcategoriaSchema>;

export const AddSupervisorSubcategoriaSchema = z.object({
  usuarioId: UuidSchema,
});
export type AddSupervisorSubcategoriaInput = z.infer<typeof AddSupervisorSubcategoriaSchema>;

export const ListSubcategoriasQuerySchema = PaginationSchema.extend({
  activo: z.coerce.boolean().optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
export type ListSubcategoriasQuery = z.infer<typeof ListSubcategoriasQuerySchema>;

export const ListCategoriasQuerySchema = PaginationSchema.extend({
  activo: z.coerce.boolean().optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
export type ListCategoriasQuery = z.infer<typeof ListCategoriasQuerySchema>;

/** Referencia mínima a un usuario staff (responsable/supervisor). */
export const StaffRefSchema = z.object({
  id: UuidSchema,
  nombre: z.string(),
  email: z.string(),
});
export type StaffRef = z.infer<typeof StaffRefSchema>;

export const SubcategoriaOutputSchema = z.object({
  id: UuidSchema,
  plazaId: UuidSchema,
  categoriaId: UuidSchema,
  responsableId: UuidSchema,
  nombre: z.string(),
  descripcion: z.string().nullable(),
  prioridad: SolicitudPrioridadSchema,
  activo: z.boolean(),
  supervisorIds: z.array(UuidSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SubcategoriaOutput = z.infer<typeof SubcategoriaOutputSchema>;

/** Detalle con responsable y supervisores enriquecidos (pantalla T-073). */
export const SubcategoriaDetailOutputSchema = SubcategoriaOutputSchema.extend({
  responsable: StaffRefSchema.nullable(),
  supervisores: z.array(StaffRefSchema),
});
export type SubcategoriaDetailOutput = z.infer<typeof SubcategoriaDetailOutputSchema>;

/** Detalle de categoría + subcategorías (T-067). */
export const CategoriaDetailOutputSchema = CategoriaOutputSchema.extend({
  subcategorias: z.array(SubcategoriaDetailOutputSchema),
});
export type CategoriaDetailOutput = z.infer<typeof CategoriaDetailOutputSchema>;
