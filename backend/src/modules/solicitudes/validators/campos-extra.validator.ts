import { UnprocessableEntityException } from '@nestjs/common';
import { z } from 'zod';
import {
  CamposExtraMantenimientoSchema,
  CamposExtraEventoSchema,
  CamposExtraRemodelacionSchema,
  CamposExtraOtroSchema,
  type SolicitudTipo,
} from '@app/contracts';

const SCHEMAS: Record<SolicitudTipo, z.ZodType> = {
  mantenimiento: CamposExtraMantenimientoSchema,
  evento: CamposExtraEventoSchema,
  remodelacion: CamposExtraRemodelacionSchema,
  otro: CamposExtraOtroSchema,
};

/**
 * T-V21: coherencia entre `asistentes_estimados` y la longitud de `asistentes`.
 * Esta regla se valida además en el `.refine` de `CreateSolicitudSchema` del
 * lado POST, pero acá la replicamos para cubrir PATCH (donde tipo y
 * camposExtra llegan por separado) y `duplicar`.
 */
function assertAsistentesCoherentes(camposExtra: Record<string, unknown>): void {
  const n = Number(camposExtra.asistentes_estimados ?? 0);
  const lista = Array.isArray(camposExtra.asistentes) ? camposExtra.asistentes : [];
  if (lista.length !== n) {
    throw new UnprocessableEntityException({
      code: 'ASISTENTES_COHERENCIA',
      title: 'Entidad no procesable',
      message: `La lista de asistentes (${lista.length}) no coincide con la cantidad estimada (${n}).`,
      meta: { estimados: n, recibidos: lista.length },
    });
  }
}

/**
 * Valida `campos_extra` contra el schema Zod del tipo (T-079, S-SO-A, T-V21).
 *
 * El POST ya valida vía discriminated union en el controller; este helper
 * cubre PATCH (donde tipo y camposExtra llegan por separado) y duplicar.
 * Retorna el objeto parseado (con coerciones aplicadas).
 */
export function validateCamposExtra(
  tipo: SolicitudTipo,
  camposExtra: unknown,
): Record<string, unknown> {
  const parsed = SCHEMAS[tipo].safeParse(camposExtra);
  if (!parsed.success) {
    throw new UnprocessableEntityException({
      code: 'CAMPOS_EXTRA_INVALIDOS',
      title: 'Entidad no procesable',
      message: `Los campos extra no son válidos para el tipo "${tipo}".`,
      meta: { issues: parsed.error.issues },
    });
  }
  const data = parsed.data as Record<string, unknown>;
  assertAsistentesCoherentes(data);
  return data;
}
