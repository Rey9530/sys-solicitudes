import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CategoriaOutput, SubcategoriaDetailOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
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
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">
          <Link href="/admin/categorias" className="hover:underline">
            Categorías
          </Link>{' '}
          /{' '}
          <Link href={`/admin/categorias/${categoria.id}`} className="hover:underline">
            {categoria.nombre}
          </Link>
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Subcategorías de {categoria.nombre}</h1>
        <p className="text-sm text-gray-500">
          {subs.total} subcategoría(s) · cada una con 1 responsable y hasta 5 supervisores.
        </p>
      </div>
      <SubcategoriasManager
        categoriaId={categoria.id}
        subcategorias={subs.items}
        staffOptions={staff}
      />
    </div>
  );
}
