'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UsersRound } from 'lucide-react';
import type { InquilinoOutput } from '@app/contracts';
import { deleteInquilinoAction } from '@/app/(admin-plaza)/admin/inquilinos/actions';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { confirmAction } from '@/lib/sweetalert';

export function InquilinosTable({ inquilinos }: { inquilinos: InquilinoOutput[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onDelete = async (inquilino: InquilinoOutput) => {
    const ok = await confirmAction({
      title: `¿Desactivar a "${inquilino.razonSocial}"?`,
      icon: 'warning',
      confirmButtonText: 'Sí, desactivar',
    });
    if (!ok) return;
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
      <Card>
        <EmptyState
          icon={UsersRound}
          title="Sin inquilinos"
          body="No hay inquilinos que coincidan con esos criterios."
        />
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Razón social</TableHead>
            <TableHead>Identificación</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="actions">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inquilinos.map((i) => (
            <TableRow key={i.id}>
              <TableCell>
                <Link href={`/admin/inquilinos/${i.id}`} className="lead" style={{ color: 'var(--text)' }}>
                  {i.razonSocial}
                </Link>
              </TableCell>
              <TableCell className="mono muted">{i.identificacion ?? '—'}</TableCell>
              <TableCell className="muted">{i.contactoNombre ?? '—'}</TableCell>
              <TableCell className="muted">{i.contactoEmail ?? '—'}</TableCell>
              <TableCell className="actions">
                <Button
                  variant="danger"
                  size="sm"
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
    </Card>
  );
}
