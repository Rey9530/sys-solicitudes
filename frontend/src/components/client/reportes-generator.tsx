'use client';

import { useState, useTransition } from 'react';
import type { SolicitudTipo } from '@app/contracts';
import { Button } from '@/components/ui/button';
import { previewReporteAction } from '@/app/(admin-plaza)/admin/reportes/actions';

const ENTIDADES = [
  { value: 'solicitudes', label: 'Solicitudes' },
  { value: 'locales', label: 'Locales' },
  { value: 'inquilinos', label: 'Inquilinos' },
] as const;
const FORMATOS = ['csv', 'xlsx', 'pdf'] as const;
const ESTADOS_SOLICITUD = [
  'borrador',
  'enviada',
  'asignado',
  'en_revision',
  'requerida_subsanacion',
  'aprobada',
  'rechazada',
  'cancelada',
];
const ESTADOS_LOCAL = ['disponible', 'alquilado', 'en_mantenimiento', 'fuera_de_servicio'];

/** T-144: generador de reportes con filtros contextuales y preview.
 *  T-V20: la lista de tipos viene de la config por plaza (etiqueta visible). */
export function ReportesGenerator({
  locales,
  inquilinos,
  tipos,
}: {
  locales: Array<{ id: string; label: string }>;
  inquilinos: Array<{ id: string; label: string }>;
  tipos: Array<{ codigo: SolicitudTipo; etiqueta: string }>;
}) {
  const [entidad, setEntidad] = useState<string>('solicitudes');
  const [formato, setFormato] = useState<string>('csv');
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Array<Record<string, unknown>> | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setF = (k: string, v: string) =>
    setFiltros((prev) => {
      const next = { ...prev };
      if (v) next[k] = v;
      else delete next[k];
      return next;
    });

  const cambiarEntidad = (e: string) => {
    setEntidad(e);
    setFiltros({});
    setPreview(null);
    setTotal(null);
  };

  const verPreview = () =>
    startTransition(async () => {
      setError(null);
      const res = await previewReporteAction(entidad, filtros);
      if (!res.ok) setError(res.error ?? 'Error');
      else {
        setPreview(res.items ?? []);
        setTotal(res.total ?? 0);
      }
    });

  const descargarHref = `/api/reportes/export?${new URLSearchParams({
    entidad,
    formato,
    ...filtros,
  }).toString()}`;

  const selectClass = 'select';
  const labelClass = 'muted text-xs font-medium uppercase tracking-wide';

  return (
    <div className="space-y-4">
      <div className="card filters">
        <div className="grid gap-1">
          <label className={labelClass}>Entidad</label>
          <select
            className={selectClass}
            value={entidad}
            onChange={(e) => cambiarEntidad(e.target.value)}
          >
            {ENTIDADES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>

        {entidad === 'solicitudes' && (
          <>
            <div className="grid gap-1">
              <label className={labelClass}>Estado</label>
              <select
                className={selectClass}
                value={filtros.estado ?? ''}
                onChange={(e) => setF('estado', e.target.value)}
              >
                <option value="">Todos</option>
                {ESTADOS_SOLICITUD.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label className={labelClass}>Tipo</label>
              <select
                className={selectClass}
                value={filtros.tipo ?? ''}
                onChange={(e) => setF('tipo', e.target.value)}
              >
                <option value="">Todos</option>
                {tipos.map((t) => (
                  <option key={t.codigo} value={t.codigo}>
                    {t.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label className={labelClass}>Local</label>
              <select
                className={selectClass}
                value={filtros.localId ?? ''}
                onChange={(e) => setF('localId', e.target.value)}
              >
                <option value="">Todos</option>
                {locales.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label className={labelClass}>Inquilino</label>
              <select
                className={selectClass}
                value={filtros.inquilinoId ?? ''}
                onChange={(e) => setF('inquilinoId', e.target.value)}
              >
                <option value="">Todos</option>
                {inquilinos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label className={labelClass}>Desde</label>
              <input
                type="date"
                className={selectClass}
                value={filtros.fechaDesde ?? ''}
                onChange={(e) => setF('fechaDesde', e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <label className={labelClass}>Hasta</label>
              <input
                type="date"
                className={selectClass}
                value={filtros.fechaHasta ?? ''}
                onChange={(e) => setF('fechaHasta', e.target.value)}
              />
            </div>
          </>
        )}

        {entidad === 'locales' && (
          <div className="grid gap-1">
            <label className={labelClass}>Estado</label>
            <select
              className={selectClass}
              value={filtros.estado ?? ''}
              onChange={(e) => setF('estado', e.target.value)}
            >
              <option value="">Todos</option>
              {ESTADOS_LOCAL.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        )}

        {entidad === 'inquilinos' && (
          <div className="grid gap-1">
            <label className={labelClass}>Buscar</label>
            <input
              className={selectClass}
              placeholder="razón social…"
              value={filtros.search ?? ''}
              onChange={(e) => setF('search', e.target.value)}
            />
          </div>
        )}

        <div className="grid gap-1">
          <label className={labelClass}>Formato</label>
          <select
            className={selectClass}
            value={formato}
            onChange={(e) => setFormato(e.target.value)}
          >
            {FORMATOS.map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" disabled={pending} onClick={verPreview}>
            Previsualizar
          </Button>
          <Button asChild>
            <a href={descargarHref}>Generar</a>
          </Button>
        </div>
      </div>

      {error && <div className="banner banner-danger">{error}</div>}

      {preview !== null && (
        <div className="card card-pad">
          <h3 className="mb-2 text-sm font-semibold">
            Previsualización — primeros {preview.length} de {total} registros
          </h3>
          {preview.length === 0 ? (
            <p className="muted text-sm">No hay registros con esos filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs report-preview">
                <thead>
                  <tr className="border-b text-left muted">
                    {Object.keys(preview[0] ?? {}).map((h) => (
                      <th key={h} className="px-2 py-1.5 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((fila, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {Object.values(fila).map((v, j) => (
                        <td key={j} className="px-2 py-1.5">
                          {String(v ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card card-pad text-sm muted">
        <h3 className="mb-1 font-semibold" style={{ color: 'var(--text-2)' }}>
          Historial de reportes
        </h3>
        <p>Los reportes programados y el historial de generación quedan fuera de v1 (placeholder).</p>
      </div>
    </div>
  );
}
