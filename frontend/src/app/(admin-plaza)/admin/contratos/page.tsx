import type { Metadata } from 'next';
import Link from 'next/link';
import type { ContratoListItem, LocalOutput, InquilinoOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ContratosTable } from '@/components/client/contratos-table';
import { ContratosFiltros } from '@/components/client/contratos-filtros';

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="text-sm text-gray-500">{data.total} contratos.</p>
        </div>
        <Button asChild>
          <Link href="/admin/contratos/nuevo">Nuevo contrato</Link>
        </Button>
      </div>
      <ContratosFiltros
        locales={locales.map((l) => ({ id: l.id, codigo: l.codigo }))}
        inquilinos={inquilinos.map((i) => ({ id: i.id, razonSocial: i.razonSocial }))}
        localId={sp.localId}
        inquilinoId={sp.inquilinoId}
        estado={sp.estado}
      />
      <ContratosTable contratos={data.items} />
      {data.totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/contratos?${new URLSearchParams({ ...sp, page: String(p) }).toString()}`}
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
