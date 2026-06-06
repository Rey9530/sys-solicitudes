import type { Metadata } from 'next';
import Link from 'next/link';
import type { LocalOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LocalesTable } from '@/components/client/locales-table';
import { LocalesFiltros } from '@/components/client/locales-filtros';

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
  searchParams: Promise<{ estado?: string; piso?: string; sector?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ page: sp.page ?? '1', pageSize: '20' });
  if (sp.estado) qs.set('estado', sp.estado);
  if (sp.piso) qs.set('piso', sp.piso);
  if (sp.sector) qs.set('sector', sp.sector);

  const res = await apiFetch(`/locales?${qs.toString()}`);
  const data: Paginated = res.ok
    ? ((await res.json()) as Paginated)
    : { items: [], total: 0, page: 1, totalPages: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locales</h1>
          <p className="text-sm text-gray-500">
            {data.total} locales · gestiona las unidades de la plaza.
          </p>
        </div>
        {/* Sin botón "Importar CSV": descartado por T-V07 */}
        <Button asChild>
          <Link href="/admin/locales/nuevo">Nuevo local</Link>
        </Button>
      </div>
      <LocalesFiltros estado={sp.estado} piso={sp.piso} sector={sp.sector} />
      <LocalesTable locales={data.items} />
      {data.totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/locales?${new URLSearchParams({ ...sp, page: String(p) }).toString()}`}
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
