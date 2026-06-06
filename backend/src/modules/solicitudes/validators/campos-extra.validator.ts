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
 * Valida `campos_extra` contra el schema Zod del tipo (T-079, S-SO-A).
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
  return parsed.data as Record<string, unknown>;
}
