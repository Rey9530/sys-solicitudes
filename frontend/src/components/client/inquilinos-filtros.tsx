'use client';

import { useRef } from 'react';
import { useRouter } from 'next/navigation';

/** Filtros de inquilinos por razón social / identificación (T-059). */
export function InquilinosFiltros({
  razonSocial,
  identificacion,
}: {
  razonSocial?: string;
  identificacion?: string;
}) {
  const router = useRouter();
  const razonRef = useRef<HTMLInputElement>(null);
  const identRef = useRef<HTMLInputElement>(null);

  const apply = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { razonSocial, identificacion, ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    router.push(`/admin/inquilinos?${params.toString()}`);
  };

  return (
    <div className="card">
      <div className="filters">
        <div className="field">
          <label htmlFor="if-razon">Razón social</label>
          <input
            id="if-razon"
            ref={razonRef}
            className="input"
            style={{ width: 224 }}
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
        <div className="field">
          <label htmlFor="if-ident">Identificación</label>
          <input
            id="if-ident"
            ref={identRef}
            className="input"
            style={{ width: 176 }}
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
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() =>
            apply({
              razonSocial: razonRef.current?.value || undefined,
              identificacion: identRef.current?.value || undefined,
            })
          }
        >
          Filtrar
        </button>
        {(razonSocial || identificacion) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => router.push('/admin/inquilinos')}
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
