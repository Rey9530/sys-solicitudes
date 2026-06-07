import type { Metadata } from 'next';
import Link from 'next/link';
import type { SolicitudListItem } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { SolicitudesTable } from '@/components/client/solicitudes-table';

export const metadata: Metadata = { title: 'Mis solicitudes' };

interface Paginated {
  items: SolicitudListItem[];
  total: number;
  page: number;
  totalPages: number;
}

/** Listado de solicitudes del inquilino (T-087). El BE filtra por su JWT. */
export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{
    estado?: string;
    tipo?: string;
    prioridad?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ page: sp.page ?? '1', pageSize: '20' });
  for (const k of ['estado', 'tipo', 'prioridad', 'fechaDesde', 'fechaHasta'] as const) {
    if (sp[k]) qs.set(k, sp[k] as string);
  }

  const res = await apiFetch(`/solicitudes?${qs.toString()}`);
  const data: Paginated = res.ok
    ? ((await res.json()) as Paginated)
    : { items: [], total: 0, page: 1, totalPages: 0 };

  const selectClass = 'h-9 rounded-md border border-input bg-white px-2 text-sm';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis solicitudes</h1>
          <p className="text-sm text-gray-500">{data.total} solicitudes.</p>
        </div>
        <Button asChild>
          <Link href="/inquilino/solicitudes/nueva">Nueva solicitud</Link>
        </Button>
      </div>

      <form className="flex flex-wrap gap-2" action="/inquilino/solicitudes">
        <select name="estado" defaultValue={sp.estado ?? ''} className={selectClass}>
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="enviada">Enviada</option>
          <option value="asignado">Asignada</option>
          <option value="en_revision">En revisión</option>
          <option value="requerida_subsanacion">Requiere subsanación</option>
          <option value="aprobada">Aprobada</option>
          <option value="rechazada">Rechazada</option>
          <option value="cancelada">Cancelada</option>
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
        <input type="date" name="fechaDesde" defaultValue={sp.fechaDesde} className={selectClass} />
        <input type="date" name="fechaHasta" defaultValue={sp.fechaHasta} className={selectClass} />
        <Button type="submit" variant="outline" size="sm" className="h-9">
          Filtrar
        </Button>
      </form>

      <SolicitudesTable solicitudes={data.items} baseHref="/inquilino/solicitudes" />

      {data.totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/inquilino/solicitudes?${new URLSearchParams({ ...sp, page: String(p) }).toString()}`}
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
