import type { Metadata } from 'next';
import Link from 'next/link';
import type { CategoriaOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { CategoriasTable } from '@/components/client/categorias-table';

export const metadata: Metadata = { title: 'Categorías' };

interface Paginated {
  items: CategoriaOutput[];
  total: number;
  page: number;
  totalPages: number;
}

/** Pantalla admin de categorías (T-072). */
export default async function AdminCategoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ activo?: string; search?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ page: sp.page ?? '1', pageSize: '20' });
  if (sp.activo) qs.set('activo', sp.activo);
  if (sp.search) qs.set('search', sp.search);

  const res = await apiFetch(`/categorias?${qs.toString()}`);
  const data: Paginated = res.ok
    ? ((await res.json()) as Paginated)
    : { items: [], total: 0, page: 1, totalPages: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-sm text-gray-500">
            {data.total} categorías · clasifican las solicitudes de los inquilinos.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/categorias/nueva">Nueva categoría</Link>
        </Button>
      </div>

      <form className="flex gap-2" action="/admin/categorias">
        <input
          type="search"
          name="search"
          defaultValue={sp.search}
          placeholder="Buscar por nombre…"
          className="h-9 w-64 rounded-md border border-input bg-white px-3 text-sm"
        />
        <select
          name="activo"
          defaultValue={sp.activo ?? ''}
          className="h-9 rounded-md border border-input bg-white px-2 text-sm"
        >
          <option value="">Todas</option>
          <option value="true">Activas</option>
          <option value="false">Inactivas</option>
        </select>
        <Button type="submit" variant="outline" size="sm" className="h-9">
          Filtrar
        </Button>
      </form>

      <CategoriasTable categorias={data.items} />

      {data.totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/categorias?${new URLSearchParams({ ...sp, page: String(p) }).toString()}`}
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
