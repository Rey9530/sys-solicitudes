import type { Metadata } from 'next';
import Link from 'next/link';
import type { InquilinoOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { InquilinosTable } from '@/components/client/inquilinos-table';
import { InquilinosFiltros } from '@/components/client/inquilinos-filtros';

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inquilinos</h1>
          <p className="text-sm text-gray-500">{data.total} inquilinos registrados.</p>
        </div>
        <Button asChild>
          <Link href="/admin/inquilinos/nuevo">Nuevo inquilino</Link>
        </Button>
      </div>
      <InquilinosFiltros razonSocial={sp.razonSocial} identificacion={sp.identificacion} />
      <InquilinosTable inquilinos={data.items} />
      {data.totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/inquilinos?${new URLSearchParams({ ...sp, page: String(p) }).toString()}`}
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
