import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { CategoriaOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { CategoriasTable } from '@/components/client/categorias-table';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Pager } from '@/components/ui/pager';

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

  const hrefFor = (page: number) =>
    `/admin/categorias?${new URLSearchParams({ ...sp, page: String(page) }).toString()}`;

  return (
    <div className="page wide">
      <PageHeader
        title="Categorías"
        subtitle={`${data.total} categorías · clasifican las solicitudes de los inquilinos.`}
        actions={
          <Link href="/admin/categorias/nueva" className="btn btn-primary">
            Nueva categoría
          </Link>
        }
      />

      <Card className="mb-4">
        <form className="filters" action="/admin/categorias">
          <div className="field">
            <label htmlFor="cat-search">Buscar</label>
            <div className="inline-icon">
              <Search />
              <input
                id="cat-search"
                type="search"
                name="search"
                defaultValue={sp.search}
                placeholder="Buscar por nombre…"
                className="input"
                style={{ width: 256 }}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="cat-activo">Estado</label>
            <select id="cat-activo" name="activo" defaultValue={sp.activo ?? ''} className="select">
              <option value="">Todas</option>
              <option value="true">Activas</option>
              <option value="false">Inactivas</option>
            </select>
          </div>
          <button type="submit" className="btn btn-secondary btn-sm">
            Filtrar
          </button>
        </form>
      </Card>

      <CategoriasTable categorias={data.items} />

      <div className="mt-4">
        <Pager page={data.page} totalPages={data.totalPages} hrefFor={hrefFor} />
      </div>
    </div>
  );
}
