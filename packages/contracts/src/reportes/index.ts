/**
 * Schemas del módulo de reportes y panel (módulo 11, T-138..T-144).
 */
import { z } from 'zod';
import { UuidSchema } from '../common/index.js';
import { SolicitudEstadoSchema, SolicitudTipoSchema } from '../solicitudes/index.js';
import { SolicitudPrioridadSchema } from '../categorias/index.js';
import { LocalEstadoSchema } from '../locales/index.js';

export const ReporteEntidadSchema = z.enum(['solicitudes', 'locales', 'inquilinos']);
export type ReporteEntidad = z.infer<typeof ReporteEntidadSchema>;

export const ReporteFormatoSchema = z.enum(['csv', 'xlsx', 'pdf']);
export type ReporteFormato = z.infer<typeof ReporteFormatoSchema>;

/** Filtros de exportación de solicitudes (S-Exportación: máx 12 meses). */
export const ReporteSolicitudesFiltrosSchema = z.object({
  estado: SolicitudEstadoSchema.optional(),
  tipo: SolicitudTipoSchema.optional(),
  prioridad: SolicitudPrioridadSchema.optional(),
  localId: UuidSchema.optional(),
  inquilinoId: UuidSchema.optional(),
  fechaDesde: z.iso.date().optional(),
  fechaHasta: z.iso.date().optional(),
});
export type ReporteSolicitudesFiltros = z.infer<typeof ReporteSolicitudesFiltrosSchema>;

export const ReporteLocalesFiltrosSchema = z.object({
  estado: LocalEstadoSchema.optional(),
});
export type ReporteLocalesFiltros = z.infer<typeof ReporteLocalesFiltrosSchema>;

export const ReporteInquilinosFiltrosSchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
});
export type ReporteInquilinosFiltros = z.infer<typeof ReporteInquilinosFiltrosSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// KPIs (T-141) y dashboard (T-143)

export interface KpisOutput {
  pendientes: number;
  aprobadasHoy: number;
  rechazadasHoy: number;
  eventosProximos7d: number;
  contratosPorVencer30d: number;
  /** aprobadas / (aprobadas + rechazadas), histórico. null sin decisiones. */
  tasaAprobacion: number | null;
  /** Promedio de (decision_at - enviada_at) en horas. null sin decisiones. */
  tiempoMedioRespuestaHoras: number | null;
  solicitudesConSubsanacion: number;
  top5Antiguedad: Array<{ id: string; codigo: string; titulo: string; enviadaAt: string }>;
}

export interface DashboardChartsOutput {
  /** Últimos 6 meses: una fila por mes con conteo por estado. */
  tendenciaMensual: Array<{ mes: string } & Record<string, number | string>>;
  porTipo: Array<{ tipo: string; total: number }>;
  porPrioridad: Array<{ prioridad: string; total: number }>;
  actividadReciente: Array<{
    id: string;
    solicitudId: string;
    solicitudCodigo: string;
    evento: string;
    usuario: string | null;
    createdAt: string;
  }>;
}
