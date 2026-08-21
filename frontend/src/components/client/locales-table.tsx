'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Store } from 'lucide-react';
import type { LocalOutput } from '@app/contracts';
import { deleteLocalAction } from '@/app/(admin-plaza)/admin/locales/actions';
import { Button } from '@/components/ui/button';
import { LocalEstadoBadge } from '@/components/estado-badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Can } from '@/components/client/can';
import { confirmAction } from '@/lib/sweetalert';
import {
  ResponsiveDataView,
  type ResponsiveColumn,
} from '@/components/client/responsive/responsive-data-view';

export function LocalesTable({ locales }: { locales: LocalOutput[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onDelete = async (local: LocalOutput) => {
    const ok = await confirmAction({
      title: `¿Desactivar el local "${local.codigo}"?`,
      icon: 'warning',
      confirmButtonText: 'Sí, desactivar',
    });
    if (!ok) return;
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

  const columns: ResponsiveColumn<LocalOutput>[] = [
    { key: 'modulo', header: 'Módulo', cardLabel: 'Módulo', className: 'muted', cell: (l) => l.modulo ?? '—' },
    { key: 'nivel', header: 'Nivel', cardLabel: 'Nivel', className: 'muted', cell: (l) => l.nivel ?? '—' },
    {
      key: 'codigo',
      header: 'Local',
      cardLabel: 'Local',
      primary: true,
      cell: (l) => (
        <Link href={`/admin/locales/${l.id}`} className="cellcode">
          {l.codigo}
        </Link>
      ),
    },
    {
      key: 'area',
      header: 'Área (m²)',
      cardLabel: 'Área',
      className: 'num muted',
      cell: (l) => l.areaM2 ?? '—',
    },
    {
      key: 'medidorE',
      header: 'Med. energía',
      cardLabel: 'Med. energía',
      className: 'mono muted',
      cell: (l) => l.medidorEnergia ?? '—',
    },
    {
      key: 'medidorA',
      header: 'Med. agua',
      cardLabel: 'Med. agua',
      className: 'mono muted',
      cell: (l) => l.medidorAgua ?? '—',
    },
    {
      key: 'estado',
      header: 'Estado',
      cardLabel: 'Estado',
      cell: (l) => <LocalEstadoBadge estado={l.estado} />,
    },
    {
      key: 'acciones',
      header: 'Acciones',
      className: 'actions',
      cell: (l) => (
        <Can permiso="locales.deshabilitar">
          <Button
            variant="danger"
            size="sm"
            disabled={pendingId === l.id}
            onClick={() => onDelete(l)}
          >
            {pendingId === l.id ? 'Desactivando…' : 'Desactivar'}
          </Button>
        </Can>
      ),
      actions: (l) => (
        <Can permiso="locales.deshabilitar">
          <Button
            variant="danger"
            size="sm"
            disabled={pendingId === l.id}
            onClick={() => onDelete(l)}
          >
            {pendingId === l.id ? 'Desactivando…' : 'Desactivar'}
          </Button>
        </Can>
      ),
    },
  ];

  return (
    <Card>
      <ResponsiveDataView
        rows={locales}
        columns={columns}
        rowKey={(l) => l.id}
      />
    </Card>
  );
}
