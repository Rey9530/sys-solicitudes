import type { contrato as ContratoModel } from '@prisma/client';
import type { ContratoOutput } from '@app/contracts';

/** Fecha DATE de Prisma (Date a medianoche UTC) → 'YYYY-MM-DD'. */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Mapeo snake_case → camelCase de un contrato (Decimal → number). */
export function contratoToOutput(c: ContratoModel): ContratoOutput {
  return {
    id: c.id,
    plazaId: c.plaza_id,
    localId: c.local_id,
    inquilinoId: c.inquilino_id,
    fechaInicio: toIsoDate(c.fecha_inicio),
    fechaFin: c.fecha_fin ? toIsoDate(c.fecha_fin) : null,
    montoMensual: c.monto_mensual === null ? null : Number(c.monto_mensual),
    moneda: c.moneda,
    condiciones: c.condiciones,
    estado: c.estado,
    fechaFinEfectiva: c.fecha_fin_efectiva ? toIsoDate(c.fecha_fin_efectiva) : null,
    motivoFin: c.motivo_fin,
    createdAt: c.created_at.toISOString(),
    updatedAt: c.updated_at.toISOString(),
  };
}

/**
 * Orden de negocio del historial (T-061): vigente → finalizado → cancelado,
 * y dentro de cada grupo por fecha_inicio DESC. El orden del enum en BD es
 * alfabético, por eso se ordena en memoria (volúmenes bajos por local).
 */
const PRIORIDAD_ESTADO: Record<ContratoModel['estado'], number> = {
  vigente: 0,
  finalizado: 1,
  cancelado: 2,
};

export function ordenarHistorial<T extends ContratoModel>(contratos: T[]): T[] {
  return [...contratos].sort(
    (a, b) =>
      PRIORIDAD_ESTADO[a.estado] - PRIORIDAD_ESTADO[b.estado] ||
      b.fecha_inicio.getTime() - a.fecha_inicio.getTime(),
  );
}
