'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EMAIL_PLANTILLAS, EmailLogEstadoSchema } from '@app/contracts';

/** Filtros del log de emails (T-127): estado, plantilla, destinatario, fechas. */
export function NotificacionesFiltros({
  estado,
  plantilla,
  destinatario,
  fechaDesde,
  fechaHasta,
}: {
  estado?: string;
  plantilla?: string;
  destinatario?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState(destinatario ?? '');

  const apply = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { estado, plantilla, destinatario, fechaDesde, fechaHasta, ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    router.push(`/admin/notificaciones?${params.toString()}`);
  };

  const selectClass = 'h-9 rounded-md border border-input bg-white px-2 text-sm';
  const hayFiltros = estado || plantilla || destinatario || fechaDesde || fechaHasta;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
      <div className="grid gap-1">
        <label className="text-xs font-medium text-gray-500">Estado</label>
        <select
          className={selectClass}
          value={estado ?? ''}
          onChange={(e) => apply({ estado: e.target.value || undefined })}
        >
          <option value="">Todos</option>
          {EmailLogEstadoSchema.options.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-medium text-gray-500">Plantilla</label>
        <select
          className={selectClass}
          value={plantilla ?? ''}
          onChange={(e) => apply({ plantilla: e.target.value || undefined })}
        >
          <option value="">Todas</option>
          {EMAIL_PLANTILLAS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <form
        className="grid gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          apply({ destinatario: busqueda.trim() || undefined });
        }}
      >
        <label className="text-xs font-medium text-gray-500">Destinatario</label>
        <input
          className="h-9 rounded-md border border-input bg-white px-2 text-sm"
          placeholder="email@…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onBlur={() => apply({ destinatario: busqueda.trim() || undefined })}
        />
      </form>
      <div className="grid gap-1">
        <label className="text-xs font-medium text-gray-500">Desde</label>
        <input
          type="date"
          className={selectClass}
          value={fechaDesde ?? ''}
          onChange={(e) => apply({ fechaDesde: e.target.value || undefined })}
        />
      </div>
      <div className="grid gap-1">
        <label className="text-xs font-medium text-gray-500">Hasta</label>
        <input
          type="date"
          className={selectClass}
          value={fechaHasta ?? ''}
          onChange={(e) => apply({ fechaHasta: e.target.value || undefined })}
        />
      </div>
      {hayFiltros && (
        <button
          type="button"
          className="h-9 rounded-md px-3 text-sm text-gray-500 hover:bg-gray-100"
          onClick={() =>
            apply({
              estado: undefined,
              plantilla: undefined,
              destinatario: undefined,
              fechaDesde: undefined,
              fechaHasta: undefined,
            })
          }
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
