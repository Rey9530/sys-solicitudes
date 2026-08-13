/**
 * Schemas comunes reutilizables.
 */
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Primitivos

/**
 * UUID en formato canónico `8-4-4-4-12` (32 hex chars con guiones).
 *
 * ⚠️ NO usamos `z.uuid()` de Zod 4: ese valida variante RFC-4122 (último
 * segmento debe empezar por 8/9/a/b). Esto rechaza UUIDs NIL (`00000000-…`)
 * y otros formatos válidos que pueden aparecer en BD legacy o seeds con
 * sentinels deterministas (ej. `00000000-0000-0000-0000-000000000001`).
 * Como `UuidSchema` se usa para IDs que Prisma devuelve desde Postgres
 * (no para validar UUIDs generados por la app), preferimos formato a variant.
 */
export const UuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'UUID inválido (formato esperado 8-4-4-4-12 hex)',
  );
export type Uuid = z.infer<typeof UuidSchema>;

/** Email normalizado (lowercase, sin espacios). */
export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(254)
  .email();
export type Email = z.infer<typeof EmailSchema>;

/** Teléfono internacional/long-distance flexible. Acepta 8-20 chars entre
 *  dígitos, espacios, paréntesis, guiones y el signo `+` inicial.
 *  La validación de formato específico por país se hace en la app/backend
 *  si es necesario (CLDR, libphonenumber, etc.). */
export const PhoneSchema = z
  .string()
  .trim()
  .min(8)
  .max(20)
  .regex(/^[0-9+\-\s()]+$/, 'Teléfono inválido');
export type Phone = z.infer<typeof PhoneSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Paginación y orden

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export const PaginatedResponseSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalPages: z.number().int().min(0),
  });

// ─────────────────────────────────────────────────────────────────────────────
// Errores (formato RFC 7807)

export const ErrorResponseSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string().optional(),
  code: z.string(),
  requestId: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
