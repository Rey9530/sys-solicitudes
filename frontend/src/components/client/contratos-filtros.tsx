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

  const selectClass = 'h-9 rounded-md border border-input bg-white px-2 text-sm';

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
      <div className="grid gap-1">
        <label className="text-xs font-medium text-gray-500">Local</label>
        <select
          className={selectClass}
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
      <div className="grid gap-1">
        <label className="text-xs font-medium text-gray-500">Inquilino</label>
        <select
          className={selectClass}
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
      <div className="grid gap-1">
        <label className="text-xs font-medium text-gray-500">Estado</label>
        <select
          className={selectClass}
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
          className="h-9 text-sm text-gray-500 underline hover:text-gray-700"
          onClick={() => router.push('/admin/contratos')}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
