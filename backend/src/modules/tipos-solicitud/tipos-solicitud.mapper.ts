import type { solicitud_tipo_config as TipoConfigModel } from '@prisma/client';
import type { SolicitudTipoConfigOutput } from '@app/contracts';

/**
 * Mapper solicitud_tipo_config → DTO de salida.
 * Modelo (T-V20): el `codigo` es uno de los 4 valores del enum `solicitud_tipo`
 * y NO se transforma. La etiqueta visible es la del admin de la plaza
 * (o el default si la fila no existe aún).
 */
export function tipoConfigToOutput(t: TipoConfigModel): SolicitudTipoConfigOutput {
  return {
    id: t.id,
    plazaId: t.plaza_id,
    codigo: t.codigo as SolicitudTipoConfigOutput['codigo'],
    etiqueta: t.etiqueta,
    descripcion: t.descripcion,
    activo: t.activo,
    orden: t.orden,
    createdAt: t.created_at.toISOString(),
    updatedAt: t.updated_at.toISOString(),
  };
}
