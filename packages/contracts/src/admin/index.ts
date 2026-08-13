/**
 * Schemas cross-plataforma del módulo `admin` (T-V25).
 *
 * Vista de solo-lectura del `superadmin` sobre datos agregados de todas las
 * plazas. Decisión SC-5 (`docs/06-roles-y-permisos.md` §6.3): el superadmin
 * observa pero no opera; estos schemas NO exponen acciones de workflow.
 */
import { z } from 'zod';
import {
  PaginatedResponseSchema,
  PaginationSchema,
  UuidSchema,
} from '../common/index.js';
import { SolicitudPrioridadSchema } from '../categorias/index.js';
import {
  SolicitudEstadoSchema,
  SolicitudListItemSchema,
  SolicitudTipoSchema,
} from '../solicitudes/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Plaza (referencia mínima)

// T-V25: slug y nombreComercial son los campos visibles en la tabla plataforma.
// Mantener sincronizado con `PlazaOutputSchema` (plazas/index.ts).
export const PlazaRefSchema = z.object({
  id: UuidSchema,
  slug: z.string(),
  nombreComercial: z.string(),
});
export type PlazaRef = z.infer<typeof PlazaRefSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Listado cross-plaza de solicitudes

/**
 * Query del listado plataforma. Se separa deliberadamente de
 * `ListSolicitudesQuerySchema` (solicitudes/index.ts) porque este opera
 * cross-tenant vía `PrismaAdminService` y añade campos específicos
 * (`plazaId`, `search` libre) que no aplican al listado de una sola plaza.
 */
export const ListSolicitudesPlataformaQuerySchema = PaginationSchema.extend({
  plazaId: UuidSchema.optional(),
  // Búsqueda libre sobre `codigo`, `titulo`, `local.codigo` e `inquilino.razon_social`.
  // 1-100 chars (evita queries monstruosas); trim en FE antes de enviar.
  search: z.string().trim().min(1).max(100).optional(),
  estado: SolicitudEstadoSchema.optional(),
  tipo: SolicitudTipoSchema.optional(),
  categoriaId: UuidSchema.optional(),
  subcategoriaId: UuidSchema.optional(),
  prioridad: SolicitudPrioridadSchema.optional(),
  fechaDesde: z.iso.date().optional(),
  fechaHasta: z.iso.date().optional(),
});
export type ListSolicitudesPlataformaQuery = z.infer<
  typeof ListSolicitudesPlataformaQuerySchema
>;

/**
 * Item de listado plataforma: extiende `SolicitudListItemSchema` con la
 * referencia a la plaza (nullable por defensa; en la práctica siempre viene
 * porque `plaza_id` es NOT NULL en BD, pero la nulabilidad se mantiene por
 * simetría con el shape `SolicitudListItem` original).
 */
export const SolicitudPlataformaListItemSchema = SolicitudListItemSchema.extend({
  plaza: PlazaRefSchema.nullable(),
});
export type SolicitudPlataformaListItem = z.infer<
  typeof SolicitudPlataformaListItemSchema
>;

export const PaginatedSolicitudesPlataformaSchema = PaginatedResponseSchema(
  SolicitudPlataformaListItemSchema,
);
export type PaginatedSolicitudesPlataforma = z.infer<
  typeof PaginatedSolicitudesPlataformaSchema
>;
