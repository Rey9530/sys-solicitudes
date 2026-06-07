import type { Metadata } from 'next';
import Link from 'next/link';
import type { SolicitudListItem } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { SolicitudesTable } from '@/components/client/solicitudes-table';
import { AutoRefresh } from '@/components/client/auto-refresh';

export const metadata: Metadata = { title: 'Bandeja de solicitudes' };

interface Paginated {
  items: SolicitudListItem[];
  total: number;
  page: number;
  totalPages: number;
}

/** Bandeja priorizada del admin (T-106): colas enviada/asignado/en_revision. */
export default async function AdminSolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{
    estado?: string;
    tipo?: string;
    prioridad?: string;
    asignadasAMi?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ page: sp.page ?? '1', pageSize: '20' });
  for (const k of ['estado', 'tipo', 'prioridad', 'asignadasAMi'] as const) {
    if (sp[k]) qs.set(k, sp[k] as string);
  }

  const res = await apiFetch(`/solicitudes/bandeja?${qs.toString()}`);
  const data: Paginated = res.ok
    ? ((await res.json()) as Paginated)
    : { items: [], total: 0, page: 1, totalPages: 0 };

  const selectClass = 'h-9 rounded-md border border-input bg-white px-2 text-sm';
  const asignadasAMi = sp.asignadasAMi === 'true';

  return (
    <div className="space-y-6">
      {/* T-106: refresco automático cada 60 s (server component re-render). */}
      <AutoRefresh intervalMs={60_000} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bandeja de solicitudes</h1>
          <p className="text-sm text-gray-500">
            {data.total} en curso · ordenadas por prioridad y antigüedad · semáforo SLA.
          </p>
        </div>
        <Button asChild variant={asignadasAMi ? 'default' : 'outline'} size="sm">
          <Link
            href={`/admin/solicitudes?${new URLSearchParams({
              ...sp,
              asignadasAMi: asignadasAMi ? '' : 'true',
              page: '1',
            }).toString()}`}
          >
            {asignadasAMi ? 'Viendo: asignadas a mí' : 'Asignadas a mí'}
          </Link>
        </Button>
      </div>

      <form className="flex flex-wrap gap-2" action="/admin/solicitudes">
        <select name="estado" defaultValue={sp.estado ?? ''} className={selectClass}>
          <option value="">Las 3 colas</option>
          <option value="enviada">Enviadas (en espera)</option>
          <option value="asignado">Asignadas</option>
          <option value="en_revision">En revisión</option>
        </select>
        <select name="tipo" defaultValue={sp.tipo ?? ''} className={selectClass}>
          <option value="">Todos los tipos</option>
          <option value="mantenimiento">Mantenimiento</option>
          <option value="evento">Evento</option>
          <option value="remodelacion">Remodelación</option>
          <option value="otro">Otro</option>
        </select>
        <select name="prioridad" defaultValue={sp.prioridad ?? ''} className={selectClass}>
          <option value="">Toda prioridad</option>
          {['A', 'B', 'C', 'D', 'F'].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {asignadasAMi && <input type="hidden" name="asignadasAMi" value="true" />}
        <Button type="submit" variant="outline" size="sm" className="h-9">
          Filtrar
        </Button>
      </form>

      <SolicitudesTable
        solicitudes={data.items}
        baseHref="/admin/solicitudes"
        showSla
        showAsignado
      />

      {data.totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/solicitudes?${new URLSearchParams({ ...sp, page: String(p) }).toString()}`}
              className={`rounded px-3 py-1 ${p === data.page ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
