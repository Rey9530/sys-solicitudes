/**
 * Schemas del módulo de notificaciones por email (módulo 09, T-127).
 */
import { z } from 'zod';
import { PaginationSchema, UuidSchema } from '../common/index.js';

export const EmailLogEstadoSchema = z.enum(['pendiente', 'enviado', 'fallido']);
export type EmailLogEstado = z.infer<typeof EmailLogEstadoSchema>;

/** Plantillas del registro del backend (T-120) — para filtros de UI. */
export const EMAIL_PLANTILLAS = [
  'solicitud-asignada-responsable',
  'solicitud-nueva-supervisor',
  'solicitud-recibida',
  'solicitud-aprobada',
  'solicitud-rechazada',
  'solicitud-subsanacion',
  'solicitud-reasignada',
  'reset-password',
  'bienvenida',
  'contrato-por-vencer',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Listado del log (CU-NE-6)

export const ListEmailLogQuerySchema = PaginationSchema.extend({
  estado: EmailLogEstadoSchema.optional(),
  plantilla: z.string().trim().min(1).max(80).optional(),
  destinatario: z.string().trim().min(1).max(254).optional(),
  fechaDesde: z.iso.date().optional(),
  fechaHasta: z.iso.date().optional(),
});
export type ListEmailLogQuery = z.infer<typeof ListEmailLogQuerySchema>;

export interface EmailLogOutput {
  id: string;
  plazaId: string;
  solicitudId: string | null;
  destinatario: string;
  plantilla: string;
  estado: EmailLogEstado;
  reintentos: number;
  lastError: string | null;
  nextRetryAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface EmailLogPreview {
  subject: string;
  html: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Desuscripciones (T-125)

export const ListUnsubscribesQuerySchema = PaginationSchema.extend({
  email: z.string().trim().min(1).max(254).optional(),
});
export type ListUnsubscribesQuery = z.infer<typeof ListUnsubscribesQuerySchema>;

export interface UnsubscribeOutput {
  id: string;
  plazaId: string;
  email: string;
  plantilla: string;
  createdAt: string;
}

export const UnsubscribeIdParamSchema = z.object({ id: UuidSchema });
