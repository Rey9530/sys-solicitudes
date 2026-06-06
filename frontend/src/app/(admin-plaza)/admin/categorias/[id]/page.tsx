import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CategoriaDetailOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { CategoriaForm } from '@/components/client/categoria-form';

export const metadata: Metadata = { title: 'Detalle de categoría' };

/** Detalle de categoría + subcategorías activas (T-072). */
export default async function CategoriaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await apiFetch(`/categorias/${id}`);
  if (!res.ok) notFound();
  const categoria = (await res.json()) as CategoriaDetailOutput;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{categoria.nombre}</h1>
          <p className="text-sm text-gray-500">
            {categoria.activo ? 'Activa' : 'Inactiva'} · {categoria.subcategorias.length}{' '}
            subcategoría(s) activa(s)
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/categorias/${categoria.id}/subcategorias`}>
            Gestionar subcategorías
          </Link>
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Editar</h2>
        <CategoriaForm categoria={categoria} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Subcategorías activas</h2>
        {categoria.subcategorias.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
            Sin subcategorías activas.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-white">
            {categoria.subcategorias.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <span className="font-medium">{s.nombre}</span>
                  <span className="ml-2 text-gray-500">
                    Responsable: {s.responsable?.nombre ?? '—'} · Supervisores:{' '}
                    {s.supervisores.length}/5
                  </span>
                </div>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-semibold">
                  Prioridad {s.prioridad}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
