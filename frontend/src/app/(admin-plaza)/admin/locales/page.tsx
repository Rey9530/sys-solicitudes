import type { Metadata } from 'next';
import Link from 'next/link';
import type { LocalOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { LocalesTable } from '@/components/client/locales-table';
import { LocalesFiltros } from '@/components/client/locales-filtros';
import { PageHeader } from '@/components/ui/page-header';
import { Pager } from '@/components/ui/pager';

export const metadata: Metadata = { title: 'Locales' };

interface Paginated {
  items: LocalOutput[];
  total: number;
  page: number;
  totalPages: number;
}

export default async function AdminLocalesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; modulo?: string; nivel?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ page: sp.page ?? '1', pageSize: '20' });
  if (sp.estado) qs.set('estado', sp.estado);
  if (sp.modulo) qs.set('modulo', sp.modulo);
  if (sp.nivel) qs.set('nivel', sp.nivel);

  const res = await apiFetch(`/locales?${qs.toString()}`);
  const data: Paginated = res.ok
    ? ((await res.json()) as Paginated)
    : { items: [], total: 0, page: 1, totalPages: 0 };

  const hrefFor = (page: number) =>
    `/admin/locales?${new URLSearchParams({ ...sp, page: String(page) }).toString()}`;

  return (
    <div className="page wide">
      <PageHeader
        title="Locales"
        subtitle={`${data.total} locales · gestiona las unidades de la plaza.`}
        actions={
          <Link href="/admin/locales/nuevo" className="btn btn-primary">
            Nuevo local
          </Link>
        }
      />
      <div className="mb-4">
        <LocalesFiltros estado={sp.estado} modulo={sp.modulo} nivel={sp.nivel} />
      </div>
      <LocalesTable locales={data.items} />
      <div className="mt-4">
        <Pager page={data.page} totalPages={data.totalPages} hrefFor={hrefFor} />
      </div>
    </div>
  );
}
