'use client';

import { useRouter } from 'next/navigation';
import { LocalEstadoSchema } from '@app/contracts';
import { Input } from '@/components/ui/input';

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
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
      <div className="grid gap-1">
        <label className="text-xs font-medium text-gray-500">Estado</label>
        <select
          className="h-9 rounded-md border border-input bg-white px-2 text-sm"
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
      <div className="grid gap-1">
        <label className="text-xs font-medium text-gray-500">Piso</label>
        <Input
          className="h-9 w-28"
          defaultValue={piso ?? ''}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply({ piso: e.currentTarget.value || undefined });
          }}
          onBlur={(e) => {
            if (e.target.value !== (piso ?? '')) apply({ piso: e.target.value || undefined });
          }}
        />
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-medium text-gray-500">Sector</label>
        <Input
          className="h-9 w-36"
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
          className="h-9 text-sm text-gray-500 underline hover:text-gray-700"
          onClick={() => router.push('/admin/locales')}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
