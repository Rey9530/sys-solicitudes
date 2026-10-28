import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { CategoriaOutput, SubcategoriaDetailOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { SubcategoriasManager, type StaffOption } from '@/components/client/subcategorias-manager';

export const metadata: Metadata = { title: 'Subcategorías' };

interface PaginatedSubs {
  items: SubcategoriaDetailOutput[];
  total: number;
}

interface PaginatedUsuarios {
  items: Array<{
    id: string;
    nombre: string;
    email: string;
    rolStaffActivo: boolean | null;
    rolStaffNombre: string | null;
  }>;
}

/** Gestión de subcategorías de una categoría (T-073). */
export default async function SubcategoriasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [catRes, subsRes, staffRes] = await Promise.all([
    apiFetch(`/categorias/${id}`),
    apiFetch(`/categorias/${id}/subcategorias?page=1&pageSize=100`),
    apiFetch('/usuarios?rol=admin_plaza&page=1&pageSize=100'),
  ]);
  if (!catRes.ok) notFound();
  const categoria = (await catRes.json()) as CategoriaOutput;
  const subs: PaginatedSubs = subsRes.ok
    ? ((await subsRes.json()) as PaginatedSubs)
    : { items: [], total: 0 };
  // SC-6: solo admin_plaza con rol_staff ACTIVO son elegibles.
  const staff: StaffOption[] = staffRes.ok
    ? ((await staffRes.json()) as PaginatedUsuarios).items
        .filter((u) => u.rolStaffActivo === true)
        .map((u) => ({ id: u.id, nombre: u.nombre, email: u.email }))
    : [];

  return (
    <div className="page wide">
      <PageHeader
        breadcrumb={[
          { label: 'Categorías', href: '/admin/categorias' },
          { label: categoria.nombre, href: `/admin/categorias/${categoria.id}` },
          { label: 'Subcategorías' },
        ]}
        title={`Subcategorías de ${categoria.nombre}`}
        subtitle={`${subs.total} subcategoría(s) · cada una con 1 responsable y hasta 5 supervisores.`}
      />
      <SubcategoriasManager
        categoriaId={categoria.id}
        subcategorias={subs.items}
        staffOptions={staff}
      />
    </div>
  );
}
