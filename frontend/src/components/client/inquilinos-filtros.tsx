'use client';

import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

/** Filtros de inquilinos por razón social / identificación (T-059). */
export function InquilinosFiltros({
  razonSocial,
  identificacion,
}: {
  razonSocial?: string;
  identificacion?: string;
}) {
  const router = useRouter();

  const apply = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { razonSocial, identificacion, ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    router.push(`/admin/inquilinos?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
      <div className="grid gap-1">
        <label className="text-xs font-medium text-gray-500">Razón social</label>
        <Input
          className="h-9 w-56"
          defaultValue={razonSocial ?? ''}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply({ razonSocial: e.currentTarget.value || undefined });
          }}
          onBlur={(e) => {
            if (e.target.value !== (razonSocial ?? ''))
              apply({ razonSocial: e.target.value || undefined });
          }}
        />
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-medium text-gray-500">Identificación</label>
        <Input
          className="h-9 w-44"
          defaultValue={identificacion ?? ''}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply({ identificacion: e.currentTarget.value || undefined });
          }}
          onBlur={(e) => {
            if (e.target.value !== (identificacion ?? ''))
              apply({ identificacion: e.target.value || undefined });
          }}
        />
      </div>
      {(razonSocial || identificacion) && (
        <button
          type="button"
          className="h-9 text-sm text-gray-500 underline hover:text-gray-700"
          onClick={() => router.push('/admin/inquilinos')}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
