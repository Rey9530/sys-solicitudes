import type { Metadata } from 'next';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import type { SolicitudListItem } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { SolicitudesTable } from '@/components/client/solicitudes-table';
import { AutoRefresh } from '@/components/client/auto-refresh';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Pager } from '@/components/ui/pager';

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

  const asignadasAMi = sp.asignadasAMi !== 'false'; // default true; solo se desactiva con ?asignadasAMi=false
  const hrefFor = (page: number) =>
    `/admin/solicitudes?${new URLSearchParams({ ...sp, page: String(page) }).toString()}`;

  return (
    <div className="page wide">
      {/* T-106: refresco automático cada 60 s (server component re-render). */}
      <AutoRefresh intervalMs={60_000} />

      <PageHeader
        title="Bandeja de solicitudes"
        subtitle={`${data.total} resultados · ordenadas por prioridad y más reciente primero · semáforo SLA.`}
        actions={
          <>
            <span className="badge b-neutral">
              <RefreshCw className="h-3 w-3" />
              60 s
            </span>
            <div className="segment">
              <Link
                href={`/admin/solicitudes?${new URLSearchParams({ ...sp, asignadasAMi: 'false', page: '1' }).toString()}`}
                className={!asignadasAMi ? 'on' : undefined}
              >
                Todas
              </Link>
              <Link
                href={`/admin/solicitudes?${new URLSearchParams({ ...sp, asignadasAMi: 'true', page: '1' }).toString()}`}
                className={asignadasAMi ? 'on' : undefined}
              >
                Asignadas a mí
              </Link>
            </div>
          </>
        }
      />

      <Card className="mb-4">
        <form className="filters" action="/admin/solicitudes">
          <div className="field">
            <label htmlFor="f-estado">Estado</label>
            <select id="f-estado" name="estado" defaultValue={sp.estado ?? ''} className="select">
              <option value="">Todos los estados</option>
              <option value="borrador">Borrador</option>
              <option value="enviada">Enviada (en espera)</option>
              <option value="asignado">Asignada</option>
              <option value="en_revision">En revisión</option>
              <option value="requerida_subsanacion">Requerida subsanación</option>
              <option value="aprobada">Aprobada</option>
              <option value="rechazada">Rechazada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-tipo">Tipo</label>
            <select id="f-tipo" name="tipo" defaultValue={sp.tipo ?? ''} className="select">
              <option value="">Todos</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="evento">Evento</option>
              <option value="remodelacion">Remodelación</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-prioridad">Prioridad</label>
            <select id="f-prioridad" name="prioridad" defaultValue={sp.prioridad ?? ''} className="select">
              <option value="">Toda</option>
              {['A', 'B', 'C', 'D', 'F'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {asignadasAMi && <input type="hidden" name="asignadasAMi" value="true" />}
          <button type="submit" className="btn btn-secondary btn-sm">
            Filtrar
          </button>
        </form>
      </Card>

      <SolicitudesTable solicitudes={data.items} baseHref="/admin/solicitudes" showSla showAsignado />

      <div className="mt-4">
        <Pager page={data.page} totalPages={data.totalPages} hrefFor={hrefFor} />
      </div>
    </div>
  );
}
