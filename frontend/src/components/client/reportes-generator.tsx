'use client';

import { useState, useTransition } from 'react';
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
const TIPOS = ['mantenimiento', 'evento', 'remodelacion', 'otro'];
const ESTADOS_LOCAL = ['disponible', 'alquilado', 'en_mantenimiento', 'fuera_de_servicio'];

/** T-144: generador de reportes con filtros contextuales y preview. */
export function ReportesGenerator({
  locales,
  inquilinos,
}: {
  locales: Array<{ id: string; label: string }>;
  inquilinos: Array<{ id: string; label: string }>;
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

  const selectClass = 'h-9 rounded-md border border-input bg-white px-2 text-sm';
  const labelClass = 'text-xs font-medium text-gray-500';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
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
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
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

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {preview !== null && (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            Previsualización — primeros {preview.length} de {total} registros
          </h3>
          {preview.length === 0 ? (
            <p className="text-sm text-gray-500">No hay registros con esos filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-gray-500">
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

      <div className="rounded-lg border border-dashed bg-white p-4 text-sm text-gray-500">
        <h3 className="mb-1 font-semibold text-gray-700">Historial de reportes</h3>
        <p>
          Los reportes programados y el historial de generación quedan fuera de v1 (placeholder).
        </p>
      </div>
    </div>
  );
}
