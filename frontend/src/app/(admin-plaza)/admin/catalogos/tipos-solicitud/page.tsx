import type { Metadata } from 'next';
import type { SolicitudTipoConfigOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { TiposSolicitudTable } from '@/components/client/tipos-solicitud-table';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Pager } from '@/components/ui/pager';

export const metadata: Metadata = { title: 'Tipos de solicitud' };

interface Paginated {
  items: SolicitudTipoConfigOutput[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Listado admin de tipos de solicitud configurables (T-V20). Muestra los 4
 * tipos canónicos del enum `solicitud_tipo` con su etiqueta/descripcion/activo
 * por plaza. No se crean ni eliminan tipos: solo se edita la presentación.
 */
export default async function AdminTiposSolicitudPage({
  searchParams,
}: {
  searchParams: Promise<{ activo?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ page: sp.page ?? '1', pageSize: '20' });
  if (sp.activo) qs.set('activo', sp.activo);

  const res = await apiFetch(`/admin/tipos-solicitud?${qs.toString()}`);
  const data: Paginated = res.ok
    ? ((await res.json()) as Paginated)
    : { items: [], total: 0, page: 1, totalPages: 0 };

  const hrefFor = (page: number) =>
    `/admin/catalogos/tipos-solicitud?${new URLSearchParams({ ...sp, page: String(page) }).toString()}`;

  return (
    <div className="page wide">
      <PageHeader
        title="Tipos de solicitud"
        subtitle={`${data.total} tipos · controla la etiqueta visible y si se ofrecen a los inquilinos.`}
      />

      <Card className="mb-4">
        <form className="filters" action="/admin/catalogos/tipos-solicitud">
          <div className="field">
            <label htmlFor="tipos-activo">Estado</label>
            <select id="tipos-activo" name="activo" defaultValue={sp.activo ?? ''} className="select">
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
          <button type="submit" className="btn btn-secondary btn-sm">
            Filtrar
          </button>
        </form>
      </Card>

      <TiposSolicitudTable tipos={data.items} />

      <div className="mt-4">
        <Pager page={data.page} totalPages={data.totalPages} hrefFor={hrefFor} />
      </div>
    </div>
  );
}
