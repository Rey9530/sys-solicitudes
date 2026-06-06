'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { InquilinoOutput } from '@app/contracts';
import { deleteInquilinoAction } from '@/app/(admin-plaza)/admin/inquilinos/actions';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function InquilinosTable({ inquilinos }: { inquilinos: InquilinoOutput[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onDelete = async (inquilino: InquilinoOutput) => {
    if (!confirm(`¿Desactivar a "${inquilino.razonSocial}"?`)) return;
    setPendingId(inquilino.id);
    const result = await deleteInquilinoAction(inquilino.id);
    setPendingId(null);
    if (result.ok) {
      toast.success('Inquilino desactivado');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  if (inquilinos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">
        No hay inquilinos con esos criterios.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Razón social</TableHead>
            <TableHead>Identificación</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inquilinos.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">
                <Link href={`/admin/inquilinos/${i.id}`} className="text-primary hover:underline">
                  {i.razonSocial}
                </Link>
              </TableCell>
              <TableCell className="text-gray-500">{i.identificacion ?? '—'}</TableCell>
              <TableCell className="text-gray-500">{i.contactoNombre ?? '—'}</TableCell>
              <TableCell className="text-gray-500">{i.contactoEmail ?? '—'}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  disabled={pendingId === i.id}
                  onClick={() => onDelete(i)}
                >
                  {pendingId === i.id ? 'Desactivando…' : 'Desactivar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
