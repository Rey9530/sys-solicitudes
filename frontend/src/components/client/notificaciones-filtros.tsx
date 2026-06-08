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

  const hayFiltros = estado || plantilla || destinatario || fechaDesde || fechaHasta;

  return (
    <div className="card">
      <div className="filters">
        <div className="field">
          <label htmlFor="nf-estado">Estado</label>
          <select
            id="nf-estado"
            className="select"
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
        <div className="field">
          <label htmlFor="nf-plantilla">Plantilla</label>
          <select
            id="nf-plantilla"
            className="select"
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
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            apply({ destinatario: busqueda.trim() || undefined });
          }}
        >
          <label htmlFor="nf-dest">Destinatario</label>
          <input
            id="nf-dest"
            className="input"
            placeholder="email@…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onBlur={() => apply({ destinatario: busqueda.trim() || undefined })}
          />
        </form>
        <div className="field">
          <label htmlFor="nf-desde">Desde</label>
          <input
            id="nf-desde"
            type="date"
            className="input"
            value={fechaDesde ?? ''}
            onChange={(e) => apply({ fechaDesde: e.target.value || undefined })}
          />
        </div>
        <div className="field">
          <label htmlFor="nf-hasta">Hasta</label>
          <input
            id="nf-hasta"
            type="date"
            className="input"
            value={fechaHasta ?? ''}
            onChange={(e) => apply({ fechaHasta: e.target.value || undefined })}
          />
        </div>
        {hayFiltros && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
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
    </div>
  );
}
