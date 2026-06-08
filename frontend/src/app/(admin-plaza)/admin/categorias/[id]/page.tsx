import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CategoriaDetailOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { CategoriaForm } from '@/components/client/categoria-form';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardBody } from '@/components/ui/card';

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
    <div className="page">
      <PageHeader
        breadcrumb={[{ label: 'Categorías', href: '/admin/categorias' }, { label: categoria.nombre }]}
        title={categoria.nombre}
        subtitle={`${categoria.activo ? 'Activa' : 'Inactiva'} · ${categoria.subcategorias.length} subcategoría(s) activa(s)`}
        actions={
          <Link href={`/admin/categorias/${categoria.id}/subcategorias`} className="btn btn-secondary">
            Gestionar subcategorías
          </Link>
        }
      />

      <div className="grid-split">
        <div>
          <h2 className="mb-3 text-[15px] font-semibold">Editar</h2>
          <CategoriaForm categoria={categoria} />
        </div>

        <div>
          <h2 className="mb-3 text-[15px] font-semibold">Subcategorías activas</h2>
          {categoria.subcategorias.length === 0 ? (
            <Card pad>
              <p className="muted text-sm">Sin subcategorías activas.</p>
            </Card>
          ) : (
            <Card>
              <CardBody style={{ padding: 0 }}>
                {categoria.subcategorias.map((s) => (
                  <div key={s.id} className="list-row" style={{ padding: '12px 16px' }}>
                    <div className="flex-1 min-w-0">
                      <b style={{ fontSize: 13 }}>{s.nombre}</b>
                      <div className="muted" style={{ fontSize: 12 }}>
                        Responsable: {s.responsable?.nombre ?? '—'} · Supervisores: {s.supervisores.length}/5
                      </div>
                    </div>
                    <span className={`prio prio-${s.prioridad}`}>{s.prioridad}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
