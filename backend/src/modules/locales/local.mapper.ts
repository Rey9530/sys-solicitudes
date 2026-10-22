import type { local as LocalModel } from '@prisma/client';
import type { LocalOutput } from '@app/contracts';

/** Mapeo snake_case → camelCase de un local (Decimal → number). */
export function localToOutput(l: LocalModel): LocalOutput {
  return {
    id: l.id,
    plazaId: l.plaza_id,
    codigo: l.codigo,
    modulo: l.modulo,
    nivel: l.nivel,
    areaM2: l.area_m2 === null ? null : Number(l.area_m2),
    medidorEnergia: l.medidor_energia,
    medidorAgua: l.medidor_agua,
    estado: l.estado,
    createdAt: l.created_at.toISOString(),
    updatedAt: l.updated_at.toISOString(),
    deletedAt: l.deleted_at?.toISOString() ?? null,
  };
}
