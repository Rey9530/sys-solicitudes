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

export function ContratosTable({
  contratos,
  detalleBasePath = '/admin/contratos',
  mostrarInquilino = true,
}: {
  contratos: ContratoListItem[];
  /** Ruta base del detalle (el portal del inquilino usa `/inquilino/contratos`). */
  detalleBasePath?: string;
  /** El inquilino solo ve sus propios contratos: la columna sobra. */
  mostrarInquilino?: boolean;
}) {
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

  const todas: ResponsiveColumn<ContratoListItem>[] = [
    {
      key: 'local',
      header: 'Local',
      cardLabel: 'Local',
      primary: true,
      cell: (c) => (
        <Link href={`${detalleBasePath}/${c.id}`} className="cellcode">
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
      className: 'muted whitespace-nowrap',
      cell: (c) => c.fechaInicio,
    },
    {
      key: 'fin',
      header: 'Fin',
      cardLabel: 'Fin',
      className: 'muted whitespace-nowrap',
      cell: (c) => c.fechaFin ?? 'Indefinido',
    },
    {
      // T-V14+: canon arrendamiento (Excel W) si está poblado; fallback a montoMensual.
      key: 'canon',
      header: 'Canon',
      cardLabel: 'Canon',
      className: 'num muted whitespace-nowrap',
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
  const columns = todas.filter((col) => mostrarInquilino || col.key !== 'inquilino');

  return (
    <Card>
      <ResponsiveDataView rows={contratos} columns={columns} rowKey={(c) => c.id} />
    </Card>
  );
}
