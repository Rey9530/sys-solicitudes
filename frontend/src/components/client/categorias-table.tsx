'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Tags } from 'lucide-react';
import type { CategoriaOutput } from '@app/contracts';
import { deleteCategoriaAction } from '@/app/(admin-plaza)/admin/categorias/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Can } from '@/components/client/can';
import { confirmAction } from '@/lib/sweetalert';
import {
  ResponsiveDataView,
  type ResponsiveColumn,
} from '@/components/client/responsive/responsive-data-view';

export function CategoriasTable({ categorias }: { categorias: CategoriaOutput[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onDelete = async (categoria: CategoriaOutput) => {
    const ok = await confirmAction({
      title: `¿Desactivar la categoría "${categoria.nombre}"?`,
      icon: 'warning',
      confirmButtonText: 'Sí, desactivar',
    });
    if (!ok) return;
    setPendingId(categoria.id);
    const result = await deleteCategoriaAction(categoria.id);
    setPendingId(null);
    if (result.ok) {
      toast.success('Categoría desactivada');
      router.refresh();
    } else {
      // RN-CA-2: si tiene subcategorías activas el backend bloquea con 400.
      toast.error(result.error);
    }
  };

  if (categorias.length === 0) {
    return (
      <Card>
        <EmptyState icon={Tags} title="Sin categorías" body="No hay categorías con esos criterios." />
      </Card>
    );
  }

  const columns: ResponsiveColumn<CategoriaOutput>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      cardLabel: 'Nombre',
      primary: true,
      cell: (c) => (
        <Link href={`/admin/categorias/${c.id}`} className="lead" style={{ color: 'var(--text)' }}>
          {c.nombre}
        </Link>
      ),
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      cardLabel: 'Descripción',
      className: 'muted max-w-sm truncate',
      cell: (c) => c.descripcion ?? '—',
    },
    {
      key: 'estado',
      header: 'Estado',
      cardLabel: 'Estado',
      cell: (c) => (
        <span className={`badge ${c.activo ? 'b-ok' : 'b-neutral'}`}>
          <span className="bdot" />
          {c.activo ? 'Activa' : 'Inactiva'}
        </span>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      className: 'actions',
      cell: (c) => (
        <div className="flex justify-end gap-2">
          <Link href={`/admin/categorias/${c.id}/subcategorias`} className="btn btn-ghost btn-sm">
            Subcategorías
          </Link>
          {c.activo && (
            <Can permiso="categorias.deshabilitar">
              <Button
                variant="danger"
                size="sm"
                disabled={pendingId === c.id}
                onClick={() => onDelete(c)}
              >
                Desactivar
              </Button>
            </Can>
          )}
        </div>
      ),
      actions: (c) => (
        <div className="flex flex-wrap gap-1">
          <Link href={`/admin/categorias/${c.id}/subcategorias`} className="btn btn-ghost btn-sm">
            Subcategorías
          </Link>
          {c.activo && (
            <Can permiso="categorias.deshabilitar">
              <Button
                variant="danger"
                size="sm"
                disabled={pendingId === c.id}
                onClick={() => onDelete(c)}
              >
                Desactivar
              </Button>
            </Can>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card>
      <ResponsiveDataView rows={categorias} columns={columns} rowKey={(c) => c.id} />
    </Card>
  );
}
