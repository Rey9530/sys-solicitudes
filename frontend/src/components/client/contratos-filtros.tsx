'use client';

import { useRouter } from 'next/navigation';
import { ContratoEstadoSchema } from '@app/contracts';

/** Filtros de contratos por local/inquilino/estado (T-060). */
export function ContratosFiltros({
  locales,
  inquilinos,
  localId,
  inquilinoId,
  estado,
}: {
  locales: Array<{ id: string; codigo: string }>;
  inquilinos: Array<{ id: string; razonSocial: string }>;
  localId?: string;
  inquilinoId?: string;
  estado?: string;
}) {
  const router = useRouter();

  const apply = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { localId, inquilinoId, estado, ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    router.push(`/admin/contratos?${params.toString()}`);
  };

  return (
    <div className="card">
      <div className="filters">
        <div className="field">
          <label htmlFor="cf-local">Local</label>
          <select
            id="cf-local"
            className="select"
            value={localId ?? ''}
            onChange={(e) => apply({ localId: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            {locales.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cf-inq">Inquilino</label>
          <select
            id="cf-inq"
            className="select"
            value={inquilinoId ?? ''}
            onChange={(e) => apply({ inquilinoId: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            {inquilinos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.razonSocial}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="cf-estado">Estado</label>
          <select
            id="cf-estado"
            className="select"
            value={estado ?? ''}
            onChange={(e) => apply({ estado: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            {ContratoEstadoSchema.options.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        {(localId || inquilinoId || estado) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => router.push('/admin/contratos')}
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
