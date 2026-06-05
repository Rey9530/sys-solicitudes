/**
 * Schemas de roles de staff.
 * Detalles: PLANIFICACION/02-autenticacion-usuarios.md (T-035).
 */
import { z } from 'zod';
import { UuidSchema, PaginationSchema } from '../common/index.js';

export const CreateRolStaffSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'El código solo puede contener minúsculas, dígitos y guiones'),
  nombre: z.string().trim().min(1).max(80),
  descripcion: z.string().trim().max(500).optional(),
});
export type CreateRolStaffInput = z.infer<typeof CreateRolStaffSchema>;

export const UpdateRolStaffSchema = z.object({
  nombre: z.string().trim().min(1).max(80).optional(),
  descripcion: z.string().trim().max(500).nullable().optional(),
  activo: z.boolean().optional(),
});
export type UpdateRolStaffInput = z.infer<typeof UpdateRolStaffSchema>;

export const ListRolesStaffQuerySchema = PaginationSchema.extend({
  activo: z.coerce.boolean().optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
export type ListRolesStaffQuery = z.infer<typeof ListRolesStaffQuerySchema>;

export const RolStaffOutputSchema = z.object({
  id: UuidSchema,
  plazaId: UuidSchema,
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  activo: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type RolStaffOutput = z.infer<typeof RolStaffOutputSchema>;
