'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UsersRound } from 'lucide-react';
import type { InquilinoOutput } from '@app/contracts';
import { deleteInquilinoAction } from '@/app/(admin-plaza)/admin/inquilinos/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Can } from '@/components/client/can';
import { confirmAction } from '@/lib/sweetalert';
import {
  ResponsiveDataView,
  type ResponsiveColumn,
} from '@/components/client/responsive/responsive-data-view';

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

  const columns: ResponsiveColumn<InquilinoOutput>[] = [
    {
      key: 'razon',
      header: 'Razón social',
      cardLabel: 'Razón social',
      primary: true,
      cell: (i) => (
        <Link href={`/admin/inquilinos/${i.id}`} className="lead" style={{ color: 'var(--text)' }}>
          {i.razonSocial}
        </Link>
      ),
    },
    {
      key: 'identificacion',
      header: 'Identificación',
      cardLabel: 'Identificación',
      className: 'mono muted',
      cell: (i) => i.identificacion ?? '—',
    },
    {
      key: 'contacto',
      header: 'Contacto',
      cardLabel: 'Contacto',
      className: 'muted',
      cell: (i) => i.contactoNombre ?? '—',
    },
    {
      key: 'email',
      header: 'Email',
      cardLabel: 'Email',
      className: 'muted',
      cell: (i) => i.contactoEmail ?? '—',
    },
    {
      key: 'acciones',
      header: 'Acciones',
      className: 'actions',
      cell: (i) => (
        <Can permiso="inquilinos.deshabilitar">
          <Button
            variant="danger"
            size="sm"
            disabled={pendingId === i.id}
            onClick={() => onDelete(i)}
          >
            {pendingId === i.id ? 'Desactivando…' : 'Desactivar'}
          </Button>
        </Can>
      ),
      actions: (i) => (
        <Can permiso="inquilinos.deshabilitar">
          <Button
            variant="danger"
            size="sm"
            disabled={pendingId === i.id}
            onClick={() => onDelete(i)}
          >
            {pendingId === i.id ? 'Desactivando…' : 'Desactivar'}
          </Button>
        </Can>
      ),
    },
  ];

  return (
    <Card>
      <ResponsiveDataView rows={inquilinos} columns={columns} rowKey={(i) => i.id} />
    </Card>
  );
}
