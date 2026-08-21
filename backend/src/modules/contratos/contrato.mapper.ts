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

    // ── Campos nuevos Excel Hoja 2 U-AK (T-V14+) ─────────────────────────────
    plazoMeses: c.plazo_meses,
    areaMt2MedicionReal:
      c.area_mt2_medicion_real === null ? null : Number(c.area_mt2_medicion_real),
    cuotaArrendamiento:
      c.cuota_arrendamiento === null ? null : Number(c.cuota_arrendamiento),
    cuotaCam: c.cuota_cam === null ? null : Number(c.cuota_cam),
    depositoGarantia: c.deposito_garantia === null ? null : Number(c.deposito_garantia),
    fechaPagoDeposito: c.fecha_pago_deposito ? toIsoDate(c.fecha_pago_deposito) : null,
    fechaEntregaLocal: c.fecha_entrega_local ? toIsoDate(c.fecha_entrega_local) : null,
    periodoGraciaDias: c.periodo_gracia_dias,
    inicioOperaciones: c.inicio_operaciones ? toIsoDate(c.inicio_operaciones) : null,
    avisoTerminacion: c.aviso_terminacion ? toIsoDate(c.aviso_terminacion) : null,
    condicionesIncrementoCanon: c.condiciones_incremento_canon,

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