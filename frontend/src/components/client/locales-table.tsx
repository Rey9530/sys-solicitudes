'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Store } from 'lucide-react';
import type { LocalOutput } from '@app/contracts';
import { deleteLocalAction } from '@/app/(admin-plaza)/admin/locales/actions';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LocalEstadoBadge } from '@/components/estado-badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

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
      <Card>
        <EmptyState
          icon={Store}
          title="Sin locales"
          body="No hay locales que coincidan con esos criterios."
        />
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Piso</TableHead>
            <TableHead>Sector</TableHead>
            <TableHead className="num">m²</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="actions">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {locales.map((l) => (
            <TableRow key={l.id}>
              <TableCell>
                <Link href={`/admin/locales/${l.id}`} className="cellcode">
                  {l.codigo}
                </Link>
              </TableCell>
              <TableCell className="lead">{l.nombre ?? '—'}</TableCell>
              <TableCell className="muted">{l.piso ?? '—'}</TableCell>
              <TableCell className="muted">{l.sector ?? '—'}</TableCell>
              <TableCell className="num muted">{l.metrajeM2 ?? '—'}</TableCell>
              <TableCell>
                <LocalEstadoBadge estado={l.estado} />
              </TableCell>
              <TableCell className="actions">
                <Button
                  variant="danger"
                  size="sm"
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
    </Card>
  );
}
