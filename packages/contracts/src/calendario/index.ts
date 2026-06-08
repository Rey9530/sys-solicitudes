/**
 * Schemas del módulo de calendario (módulo 10, T-129..T-134).
 */
import { z } from 'zod';
import { UuidSchema } from '../common/index.js';

/** Tipos de entrada del feed. ⚠️ `remodelacion` no es distinguible en v1:
 *  los locales en mantenimiento no guardan qué tipo de solicitud los originó,
 *  por lo que todo aparece como `mantenimiento` (ver bitácora T-129). */
export const CalendarioTipoSchema = z.enum(['evento', 'mantenimiento', 'hito_contrato']);
export type CalendarioTipo = z.infer<typeof CalendarioTipoSchema>;

/** Fecha ISO: date-only o datetime con offset (FullCalendar manda ambas). */
const IsoFechaSchema = z.union([z.iso.datetime({ offset: true }), z.iso.date()]);

/** Lista separada por comas → array (multi-select de filtros, T-134). */
const CsvUuidsSchema = z
  .string()
  .transform((s) => s.split(',').filter(Boolean))
  .pipe(z.array(UuidSchema));

export const CalendarioQuerySchema = z.object({
  from: IsoFechaSchema,
  to: IsoFechaSchema,
  localId: CsvUuidsSchema.optional(),
  inquilinoId: CsvUuidsSchema.optional(),
  tipo: z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(CalendarioTipoSchema))
    .optional(),
});
export type CalendarioQuery = z.infer<typeof CalendarioQuerySchema>;

export interface CalendarioEventoOutput {
  id: string;
  title: string;
  start: string;
  end: string | null;
  color: string;
  /** Eventos de día completo (mantenimientos, hitos). */
  allDay?: boolean;
  extendedProps: {
    tipo: CalendarioTipo;
    solicitudId?: string;
    solicitudCodigo?: string;
    localId?: string;
    localCodigo?: string;
    inquilinoId?: string;
    contratoId?: string;
    /** T-131: marcado cuando el evento se solapa con otro del mismo local. */
    choque?: boolean;
  };
}

export const IcsQuerySchema = z.object({
  localId: CsvUuidsSchema.optional(),
  tipo: z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .pipe(z.array(CalendarioTipoSchema))
    .optional(),
});
export type IcsQuery = z.infer<typeof IcsQuerySchema>;

export const ChoquesQuerySchema = z.object({
  from: IsoFechaSchema,
  to: IsoFechaSchema,
  localId: CsvUuidsSchema.optional(),
});
export type ChoquesQuery = z.infer<typeof ChoquesQuerySchema>;

export interface ChoqueOutput {
  localId: string;
  localCodigo: string | null;
  eventoAId: string;
  eventoBId: string;
}

/** Drag-and-drop del admin (decisión owner 2026-06-07): mover evento aprobado. */
export const MoverEventoFechasSchema = z
  .object({
    inicio: z.iso.datetime({ offset: true }),
    fin: z.iso.datetime({ offset: true }),
  })
  .refine((v) => new Date(v.fin) > new Date(v.inicio), {
    message: 'fin debe ser posterior a inicio',
    path: ['fin'],
  });
export type MoverEventoFechas = z.infer<typeof MoverEventoFechasSchema>;
