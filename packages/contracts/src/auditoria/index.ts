/**
 * Schemas del log de auditoría (módulo 12, T-146 — endpoint de consulta
 * añadido por decisión del owner 2026-06-07; enriquecido con join de usuario
 * en T-161 para evitar N+1 en el frontend).
 */
import { z } from 'zod';
import { PaginationSchema, UuidSchema } from '../common/index.js';

export const ListAuditoriaQuerySchema = PaginationSchema.extend({
  accion: z.string().trim().min(1).max(80).optional(),
  entidadTipo: z.string().trim().min(1).max(40).optional(),
  entidadId: UuidSchema.optional(),
  usuarioId: UuidSchema.optional(),
  fechaDesde: z.iso.date().optional(),
  fechaHasta: z.iso.date().optional(),
});
export type ListAuditoriaQuery = z.infer<typeof ListAuditoriaQuerySchema>;

/** T-161: datos del usuario autor, enriquecidos en el backend (join batch). */
export interface AuditoriaUsuario {
  id: string;
  nombre: string;
  email: string;
}

export interface AuditoriaOutput {
  id: string;
  plazaId: string | null;
  usuarioId: string | null;
  /** T-161: null si el usuario fue eliminado o pertenece a otra plaza. */
  usuario: AuditoriaUsuario | null;
  accion: string;
  entidadTipo: string;
  entidadId: string | null;
  antes: unknown;
  despues: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}
