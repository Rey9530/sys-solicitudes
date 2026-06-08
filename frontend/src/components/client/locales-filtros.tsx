'use client';

import { useRouter } from 'next/navigation';
import { LocalEstadoSchema } from '@app/contracts';

/** Filtros de listado de locales por estado/piso/sector (T-057). */
export function LocalesFiltros({
  estado,
  piso,
  sector,
}: {
  estado?: string;
  piso?: string;
  sector?: string;
}) {
  const router = useRouter();

  const apply = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { estado, piso, sector, ...next };
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
          <label htmlFor="lf-piso">Piso</label>
          <input
            id="lf-piso"
            className="input"
            style={{ width: 112 }}
            defaultValue={piso ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') apply({ piso: e.currentTarget.value || undefined });
            }}
            onBlur={(e) => {
              if (e.target.value !== (piso ?? '')) apply({ piso: e.target.value || undefined });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="lf-sector">Sector</label>
          <input
            id="lf-sector"
            className="input"
            style={{ width: 144 }}
            defaultValue={sector ?? ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') apply({ sector: e.currentTarget.value || undefined });
            }}
            onBlur={(e) => {
              if (e.target.value !== (sector ?? '')) apply({ sector: e.target.value || undefined });
            }}
          />
        </div>
        {(estado || piso || sector) && (
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
