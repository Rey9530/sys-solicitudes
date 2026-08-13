'use client';

import { useRouter } from 'next/navigation';
import { LocalEstadoSchema } from '@app/contracts';

/** Filtros de listado de locales por estado/módulo/nivel (T-057). */
export function LocalesFiltros({
  estado,
  modulo,
  nivel,
}: {
  estado?: string;
  modulo?: string;
  nivel?: string;
}) {
  const router = useRouter();

  const apply = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { estado, modulo, nivel, ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    router.push(`/admin/locales?${params.toString()}`);
  };

  return (
    <div className="card">
      <div className="filters">
        <div className="field">
          <label htmlFor="lf-estado">Estado</label>
          <select
            id="lf-estado"
            className="select"
            value={estado ?? ''}
            onChange={(e) => apply({ estado: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            {LocalEstadoSchema.options.map((e) => (
              <option key={e} value={e}>
                {e.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lf-modulo">Módulo</label>
          <input
            id="lf-modulo"
            className="input"
            style={{ width: 144 }}
            defaultValue={modulo ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') apply({ modulo: e.currentTarget.value || undefined });
            }}
            onBlur={(e) => {
              if (e.target.value !== (modulo ?? '')) apply({ modulo: e.target.value || undefined });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="lf-nivel">Nivel</label>
          <input
            id="lf-nivel"
            className="input"
            style={{ width: 112 }}
            defaultValue={nivel ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') apply({ nivel: e.currentTarget.value || undefined });
            }}
            onBlur={(e) => {
              if (e.target.value !== (nivel ?? '')) apply({ nivel: e.target.value || undefined });
            }}
          />
        </div>
        {(estado || modulo || nivel) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => router.push('/admin/locales')}
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
