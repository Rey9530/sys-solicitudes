/**
 * Schemas comunes reutilizables.
 */
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Primitivos

/** UUID v4. */
export const UuidSchema = z.uuid();
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
