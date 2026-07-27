/**
 * Schemas del módulo de permisos (T-RBAC-1).
 * Detalles: PERMISOS_README.md.
 */
import { z } from 'zod';
import { UuidSchema } from '../common/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Validador del código de permiso

/**
 * Convención `<modulo>.<accion>` en snake_case lowercase. Mismo patrón que
 * usa el seed (`backend/prisma/seed-data/permisos.ts`).
 */
export const PermisoCodigoSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/, {
    message:
      'El código debe tener el formato "<modulo>.<accion>" en snake_case.',
  });
export type PermisoCodigo = z.infer<typeof PermisoCodigoSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Output: permiso del catálogo (GET /permisos)

export const PermisoOutputSchema = z.object({
  id: UuidSchema,
  codigo: PermisoCodigoSchema,
  modulo: z.string(),
  accion: z.string(),
  descripcion: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type PermisoOutput = z.infer<typeof PermisoOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Asignación de permisos a un rol (PUT /permisos/roles/:rolStaffId)

export const AsignarPermisosInputSchema = z.object({
  /**
   * Lista completa de IDs de permiso que el rol debe tener tras la operación
   * (PUT = reemplazo total). Vacío = quitar todos los permisos al rol (útil
   * para reset; ojo: si el rol es `es_sistema`, el backend rechaza la operación).
   */
  permisoIds: z.array(UuidSchema).max(500),
});
export type AsignarPermisosInput = z.infer<typeof AsignarPermisosInputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Output: matriz rol → permisos (GET /permisos/roles/:rolStaffId)

export const RolPermisosOutputSchema = z.object({
  rolStaffId: UuidSchema,
  esSistema: z.boolean(),
  permisos: z.array(PermisoOutputSchema),
});
export type RolPermisosOutput = z.infer<typeof RolPermisosOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Output: catálogo agrupado por módulo (forma conveniente para la matriz UI)

export const PermisosPorModuloSchema = z.object({
  modulo: z.string(),
  permisos: z.array(PermisoOutputSchema),
});
export type PermisosPorModulo = z.infer<typeof PermisosPorModuloSchema>;

export const ListarPermisosOutputSchema = z.object({
  total: z.number().int().nonnegative(),
  modulos: z.array(PermisosPorModuloSchema),
});
export type ListarPermisosOutput = z.infer<typeof ListarPermisosOutputSchema>;