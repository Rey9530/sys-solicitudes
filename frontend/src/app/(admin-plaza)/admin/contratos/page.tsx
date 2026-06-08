import type { Metadata } from 'next';
import Link from 'next/link';
import type { ContratoListItem, LocalOutput, InquilinoOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { ContratosTable } from '@/components/client/contratos-table';
import { ContratosFiltros } from '@/components/client/contratos-filtros';
import { PageHeader } from '@/components/ui/page-header';
import { Pager } from '@/components/ui/pager';

export const metadata: Metadata = { title: 'Contratos' };

interface Paginated {
  items: ContratoListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export default async function AdminContratosPage({
  searchParams,
}: {
  searchParams: Promise<{ localId?: string; inquilinoId?: string; estado?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ page: sp.page ?? '1', pageSize: '20' });
  if (sp.localId) qs.set('localId', sp.localId);
  if (sp.inquilinoId) qs.set('inquilinoId', sp.inquilinoId);
  if (sp.estado) qs.set('estado', sp.estado);

  const [res, localesRes, inquilinosRes] = await Promise.all([
    apiFetch(`/contratos?${qs.toString()}`),
    apiFetch('/locales?page=1&pageSize=100'),
    apiFetch('/inquilinos?page=1&pageSize=100'),
  ]);
  const data: Paginated = res.ok
    ? ((await res.json()) as Paginated)
    : { items: [], total: 0, page: 1, totalPages: 0 };
  const locales = localesRes.ok
    ? ((await localesRes.json()) as { items: LocalOutput[] }).items
    : [];
  const inquilinos = inquilinosRes.ok
    ? ((await inquilinosRes.json()) as { items: InquilinoOutput[] }).items
    : [];

  const hrefFor = (page: number) =>
    `/admin/contratos?${new URLSearchParams({ ...sp, page: String(page) }).toString()}`;

  return (
    <div className="page wide">
      <PageHeader
        title="Contratos"
        subtitle={`${data.total} contratos.`}
        actions={
          <Link href="/admin/contratos/nuevo" className="btn btn-primary">
            Nuevo contrato
          </Link>
        }
      />
      <div className="mb-4">
        <ContratosFiltros
          locales={locales.map((l) => ({ id: l.id, codigo: l.codigo }))}
          inquilinos={inquilinos.map((i) => ({ id: i.id, razonSocial: i.razonSocial }))}
          localId={sp.localId}
          inquilinoId={sp.inquilinoId}
          estado={sp.estado}
        />
      </div>
      <ContratosTable contratos={data.items} />
      <div className="mt-4">
        <Pager page={data.page} totalPages={data.totalPages} hrefFor={hrefFor} />
      </div>
    </div>
  );
}
