'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { LocalOutput } from '@app/contracts';
import { deleteLocalAction } from '@/app/(admin-plaza)/admin/locales/actions';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LocalEstadoBadge } from '@/components/estado-badge';

export function LocalesTable({ locales }: { locales: LocalOutput[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onDelete = async (local: LocalOutput) => {
    if (!confirm(`¿Desactivar el local "${local.codigo}"?`)) return;
    setPendingId(local.id);
    const result = await deleteLocalAction(local.id);
    setPendingId(null);
    if (result.ok) {
      toast.success('Local desactivado');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  if (locales.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">
        No hay locales con esos criterios.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Piso</TableHead>
            <TableHead>Sector</TableHead>
            <TableHead>m²</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {locales.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="font-medium">
                <Link href={`/admin/locales/${l.id}`} className="text-primary hover:underline">
                  {l.codigo}
                </Link>
              </TableCell>
              <TableCell>{l.nombre ?? '—'}</TableCell>
              <TableCell className="text-gray-500">{l.piso ?? '—'}</TableCell>
              <TableCell className="text-gray-500">{l.sector ?? '—'}</TableCell>
              <TableCell className="text-gray-500">{l.metrajeM2 ?? '—'}</TableCell>
              <TableCell>
                <LocalEstadoBadge estado={l.estado} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  disabled={pendingId === l.id}
                  onClick={() => onDelete(l)}
                >
                  {pendingId === l.id ? 'Desactivando…' : 'Desactivar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
