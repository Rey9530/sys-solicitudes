import type { Metadata } from 'next';
import Link from 'next/link';
import type { SolicitudListItem } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { SolicitudesTable } from '@/components/client/solicitudes-table';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Pager } from '@/components/ui/pager';

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

  const hrefFor = (page: number) =>
    `/inquilino/solicitudes?${new URLSearchParams({ ...sp, page: String(page) }).toString()}`;

  return (
    <div className="page wide">
      <PageHeader
        title="Mis solicitudes"
        subtitle={`${data.total} solicitudes.`}
        actions={
          <Link href="/inquilino/solicitudes/nueva" className="btn btn-primary">
            Nueva solicitud
          </Link>
        }
      />

      <Card className="mb-4">
        <form className="filters" action="/inquilino/solicitudes">
          <div className="field">
            <label htmlFor="is-estado">Estado</label>
            <select id="is-estado" name="estado" defaultValue={sp.estado ?? ''} className="select">
              <option value="">Todos</option>
              <option value="borrador">Borrador</option>
              <option value="enviada">Enviada</option>
              <option value="asignado">Asignada</option>
              <option value="en_revision">En revisión</option>
              <option value="requerida_subsanacion">Requiere subsanación</option>
              <option value="pausada">Pausada</option>
              <option value="aprobada">Aprobada</option>
              <option value="rechazada">Rechazada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="is-tipo">Tipo</label>
            <select id="is-tipo" name="tipo" defaultValue={sp.tipo ?? ''} className="select">
              <option value="">Todos</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="evento">Evento</option>
              <option value="remodelacion">Remodelación</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="is-prioridad">Prioridad</label>
            <select id="is-prioridad" name="prioridad" defaultValue={sp.prioridad ?? ''} className="select">
              <option value="">Toda</option>
              {['A', 'B', 'C', 'D', 'F'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="is-desde">Desde</label>
            <input id="is-desde" type="date" name="fechaDesde" defaultValue={sp.fechaDesde} className="input" />
          </div>
          <div className="field">
            <label htmlFor="is-hasta">Hasta</label>
            <input id="is-hasta" type="date" name="fechaHasta" defaultValue={sp.fechaHasta} className="input" />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm">
            Filtrar
          </button>
        </form>
      </Card>

      <SolicitudesTable solicitudes={data.items} baseHref="/inquilino/solicitudes" />

      <div className="mt-4">
        <Pager page={data.page} totalPages={data.totalPages} hrefFor={hrefFor} />
      </div>
    </div>
  );
}
