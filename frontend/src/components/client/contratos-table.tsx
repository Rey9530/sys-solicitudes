'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import type { ContratoListItem } from '@app/contracts';
import { ContratoEstadoBadge } from '@/components/estado-badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ResponsiveDataView,
  type ResponsiveColumn,
} from '@/components/client/responsive/responsive-data-view';

export function ContratosTable({ contratos }: { contratos: ContratoListItem[] }) {
  if (contratos.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Sin contratos"
          body="No hay contratos que coincidan con esos criterios."
        />
      </Card>
    );
  }

  const columns: ResponsiveColumn<ContratoListItem>[] = [
    {
      key: 'local',
      header: 'Local',
      cardLabel: 'Local',
      primary: true,
      cell: (c) => (
        <Link href={`/admin/contratos/${c.id}`} className="cellcode">
          {c.localCodigo ?? c.localId.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: 'inquilino',
      header: 'Inquilino',
      cardLabel: 'Inquilino',
      className: 'lead',
      cell: (c) => c.inquilinoRazonSocial ?? '—',
    },
    {
      key: 'inicio',
      header: 'Inicio',
      cardLabel: 'Inicio',
      className: 'muted',
      cell: (c) => c.fechaInicio,
    },
    {
      key: 'fin',
      header: 'Fin',
      cardLabel: 'Fin',
      className: 'muted',
      cell: (c) => c.fechaFin ?? 'Indefinido',
    },
    {
      // T-V14+: canon arrendamiento (Excel W) si está poblado; fallback a montoMensual.
      key: 'canon',
      header: 'Canon',
      cardLabel: 'Canon',
      className: 'num muted',
      cell: (c) =>
        c.cuotaArrendamiento !== null
          ? `${c.moneda} ${c.cuotaArrendamiento.toFixed(2)}`
          : c.montoMensual !== null
            ? `${c.moneda} ${c.montoMensual}`
            : '—',
    },
    {
      key: 'estado',
      header: 'Estado',
      cardLabel: 'Estado',
      cell: (c) => <ContratoEstadoBadge estado={c.estado} />,
    },
  ];

  return (
    <Card>
      <ResponsiveDataView rows={contratos} columns={columns} rowKey={(c) => c.id} />
    </Card>
  );
}
