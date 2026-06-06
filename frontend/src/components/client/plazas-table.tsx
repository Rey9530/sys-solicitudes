'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { PlazaOutput } from '@app/contracts';
import { deactivatePlazaAction } from '@/app/(admin-plataform)/superadmin/plazas/actions';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateInPlazaTz } from '@/lib/datetime';

export function PlazasTable({ plazas }: { plazas: PlazaOutput[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onDeactivate = async (plaza: PlazaOutput) => {
    if (!confirm(`¿Desactivar la plaza "${plaza.nombreComercial}"?`)) return;
    setPendingId(plaza.id);
    const result = await deactivatePlazaAction(plaza.id);
    setPendingId(null);
    if (result.ok) {
      toast.success('Plaza desactivada');
      router.refresh();
    } else {
      toast.error('No se pudo desactivar la plaza');
    }
  };

  if (plazas.length === 0) {
    return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">No hay plazas todavía.</p>;
  }

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plaza</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Creada</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plazas.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: p.colorPrimario }}
                  />
                  {p.nombreComercial}
                </span>
              </TableCell>
              <TableCell className="text-gray-500">{p.slug}</TableCell>
              <TableCell className="text-gray-500">{p.emailContacto ?? '—'}</TableCell>
              <TableCell className="text-gray-500">{formatDateInPlazaTz(p.createdAt)}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  disabled={pendingId === p.id}
                  onClick={() => onDeactivate(p)}
                >
                  {pendingId === p.id ? 'Desactivando…' : 'Desactivar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
