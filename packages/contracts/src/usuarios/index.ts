/**
 * Schemas de usuarios.
 * Detalles: PLANIFICACION/02-autenticacion-usuarios.md (T-022, T-034).
 */
import { z } from 'zod';
import { EmailSchema, UuidSchema, PaginationSchema } from '../common/index.js';
import { PasswordSchema } from '../auth/index.js';

export const RolGlobalSchema = z.enum(['superadmin', 'admin_plaza', 'inquilino']);
export type RolGlobal = z.infer<typeof RolGlobalSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Crear usuario

export const CreateUsuarioSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  nombre: z.string().trim().min(1).max(120),
  telefono: z
    .string()
    .trim()
    .max(40)
    .optional(),
  rol: RolGlobalSchema,
  rolStaffId: UuidSchema.optional(),
  inquilinoId: UuidSchema.optional(),
});
export type CreateUsuarioInput = z.infer<typeof CreateUsuarioSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Actualizar usuario

export const UpdateUsuarioSchema = z.object({
  nombre: z.string().trim().min(1).max(120).optional(),
  telefono: z.string().trim().max(40).nullable().optional(),
  rolStaffId: UuidSchema.nullable().optional(),
  activo: z.boolean().optional(),
});
export type UpdateUsuarioInput = z.infer<typeof UpdateUsuarioSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Listado con filtros

export const ListUsuariosQuerySchema = PaginationSchema.extend({
  rol: RolGlobalSchema.optional(),
  activo: z.coerce.boolean().optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
export type ListUsuariosQuery = z.infer<typeof ListUsuariosQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Deshabilitar usuario (soft delete) — RN-AU-5: si se deshabilita un
// admin_plaza, se exige un motivo trazable (auditoría).

export const DisableUsuarioSchema = z.object({
  motivo: z.string().trim().min(3, 'Mínimo 3 caracteres').max(500).optional(),
});
export type DisableUsuarioInput = z.infer<typeof DisableUsuarioSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Output

export const UsuarioOutputSchema = z.object({
  id: UuidSchema,
  email: EmailSchema,
  nombre: z.string(),
  telefono: z.string().nullable(),
  rol: RolGlobalSchema,
  rolStaffId: UuidSchema.nullable(),
  inquilinoId: UuidSchema.nullable(),
  plazaId: UuidSchema.nullable(),
  emailInvalido: z.boolean(),
  lastLoginAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable(),
});
export type UsuarioOutput = z.infer<typeof UsuarioOutputSchema>;
