'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search } from 'lucide-react';

/**
 * T-161: filtros de la página de auditoría.
 *
 * La query del backend acepta `accion` (contains, case-insensitive),
 * `entidadTipo` (igualdad), `fechaDesde` y `fechaHasta` (ISO date).
 *
 * El usuario del log no es buscable como filtro en el endpoint (solo por
 * `usuarioId` UUID exacto); si se necesita buscar por email se puede agregar
 * después con un endpoint `/usuarios?q=` y un picker. Por ahora exponemos
 * solo los 4 filtros que la API soporta nativamente.
 */
export function AuditoriaFiltros({
  accion,
  entidadTipo,
  fechaDesde,
  fechaHasta,
}: {
  accion?: string;
  entidadTipo?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Estados locales para los inputs (no se aplican hasta "Filtrar" o Enter).
  const [localAccion, setLocalAccion] = useState(accion ?? '');
  const [localEntidad, setLocalEntidad] = useState(entidadTipo ?? '');
  const [localDesde, setLocalDesde] = useState(fechaDesde ?? '');
  const [localHasta, setLocalHasta] = useState(fechaHasta ?? '');

  const apply = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      accion,
      entidadTipo,
      fechaDesde,
      fechaHasta,
      ...next,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    startTransition(() => {
      router.push(`/admin/auditoria?${params.toString()}`);
    });
  };

  const onSubmit = () => {
    apply({
      accion: localAccion || undefined,
      entidadTipo: localEntidad || undefined,
      fechaDesde: localDesde || undefined,
      fechaHasta: localHasta || undefined,
    });
  };

  const onClear = () => {
    setLocalAccion('');
    setLocalEntidad('');
    setLocalDesde('');
    setLocalHasta('');
    startTransition(() => {
      router.push('/admin/auditoria');
    });
  };

  const hayFiltros = Boolean(accion || entidadTipo || fechaDesde || fechaHasta);

  return (
    <div className="card">
      <div className="filters">
        <div className="field">
          <label htmlFor="af-accion">Acción</label>
          <input
            id="af-accion"
            className="input"
            placeholder="ej. local.update"
            value={localAccion}
            onChange={(e) => setLocalAccion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit();
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="af-entidad">Tipo de entidad</label>
          <select
            id="af-entidad"
            className="select"
            value={localEntidad}
            onChange={(e) => setLocalEntidad(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="local">local</option>
            <option value="inquilino">inquilino</option>
            <option value="contrato">contrato</option>
            <option value="solicitud">solicitud</option>
            <option value="categoria">categoria</option>
            <option value="subcategoria">subcategoria</option>
            <option value="usuario">usuario</option>
            <option value="adjunto">adjunto</option>
            <option value="plaza">plaza</option>
            <option value="configuracion">configuracion</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="af-desde">Desde</label>
          <input
            id="af-desde"
            type="date"
            className="input"
            value={localDesde}
            onChange={(e) => setLocalDesde(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="af-hasta">Hasta</label>
          <input
            id="af-hasta"
            type="date"
            className="input"
            value={localHasta}
            onChange={(e) => setLocalHasta(e.target.value)}
          />
        </div>
        <div className="field" style={{ alignSelf: 'end' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onSubmit}
            disabled={isPending}
          >
            <Search />
            Filtrar
          </button>
        </div>
        {hayFiltros && (
          <div className="field" style={{ alignSelf: 'end' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
              Limpiar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
