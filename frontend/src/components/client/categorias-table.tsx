'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Tags } from 'lucide-react';
import type { CategoriaOutput } from '@app/contracts';
import { deleteCategoriaAction } from '@/app/(admin-plaza)/admin/categorias/actions';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { confirmAction } from '@/lib/sweetalert';

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

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="actions">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categorias.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/admin/categorias/${c.id}`} className="lead" style={{ color: 'var(--text)' }}>
                  {c.nombre}
                </Link>
              </TableCell>
              <TableCell className="muted max-w-sm truncate">{c.descripcion ?? '—'}</TableCell>
              <TableCell>
                <span className={`badge ${c.activo ? 'b-ok' : 'b-neutral'}`}>
                  <span className="bdot" />
                  {c.activo ? 'Activa' : 'Inactiva'}
                </span>
              </TableCell>
              <TableCell className="actions">
                <div className="flex justify-end gap-2">
                  <Link href={`/admin/categorias/${c.id}/subcategorias`} className="btn btn-ghost btn-sm">
                    Subcategorías
                  </Link>
                  {c.activo && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={pendingId === c.id}
                      onClick={() => onDelete(c)}
                    >
                      Desactivar
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
