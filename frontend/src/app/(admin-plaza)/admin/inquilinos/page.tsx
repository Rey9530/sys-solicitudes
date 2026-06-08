import type { Metadata } from 'next';
import Link from 'next/link';
import type { InquilinoOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { InquilinosTable } from '@/components/client/inquilinos-table';
import { InquilinosFiltros } from '@/components/client/inquilinos-filtros';
import { PageHeader } from '@/components/ui/page-header';
import { Pager } from '@/components/ui/pager';

export const metadata: Metadata = { title: 'Inquilinos' };

interface Paginated {
  items: InquilinoOutput[];
  total: number;
  page: number;
  totalPages: number;
}

export default async function AdminInquilinosPage({
  searchParams,
}: {
  searchParams: Promise<{ razonSocial?: string; identificacion?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ page: sp.page ?? '1', pageSize: '20' });
  if (sp.razonSocial) qs.set('razonSocial', sp.razonSocial);
  if (sp.identificacion) qs.set('identificacion', sp.identificacion);

  const res = await apiFetch(`/inquilinos?${qs.toString()}`);
  const data: Paginated = res.ok
    ? ((await res.json()) as Paginated)
    : { items: [], total: 0, page: 1, totalPages: 0 };

  const hrefFor = (page: number) =>
    `/admin/inquilinos?${new URLSearchParams({ ...sp, page: String(page) }).toString()}`;

  return (
    <div className="page wide">
      <PageHeader
        title="Inquilinos"
        subtitle={`${data.total} inquilinos registrados.`}
        actions={
          <Link href="/admin/inquilinos/nuevo" className="btn btn-primary">
            Nuevo inquilino
          </Link>
        }
      />
      <div className="mb-4">
        <InquilinosFiltros razonSocial={sp.razonSocial} identificacion={sp.identificacion} />
      </div>
      <InquilinosTable inquilinos={data.items} />
      <div className="mt-4">
        <Pager page={data.page} totalPages={data.totalPages} hrefFor={hrefFor} />
      </div>
    </div>
  );
}
