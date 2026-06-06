'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { CategoriaOutput } from '@app/contracts';
import { deleteCategoriaAction } from '@/app/(admin-plaza)/admin/categorias/actions';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function CategoriasTable({ categorias }: { categorias: CategoriaOutput[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onDelete = async (categoria: CategoriaOutput) => {
    if (!confirm(`¿Desactivar la categoría "${categoria.nombre}"?`)) return;
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
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">
        No hay categorías con esos criterios.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categorias.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">
                <Link href={`/admin/categorias/${c.id}`} className="text-primary hover:underline">
                  {c.nombre}
                </Link>
              </TableCell>
              <TableCell className="max-w-sm truncate text-gray-500">
                {c.descripcion ?? '—'}
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {c.activo ? 'Activa' : 'Inactiva'}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/categorias/${c.id}/subcategorias`}>Subcategorías</Link>
                  </Button>
                  {c.activo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
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
    </div>
  );
}
