'use client';

import Link from 'next/link';
import { Inbox } from 'lucide-react';
import type { SolicitudListItem } from '@app/contracts';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SolicitudEstadoBadge, PrioridadBadge, SlaSemaforo } from '@/components/estado-badge';
import { Avatar } from '@/components/ui/avatar';
import { formatDateInPlazaTz } from '@/lib/datetime';
import {
  ResponsiveDataView,
  type ResponsiveColumn,
} from '@/components/client/responsive/responsive-data-view';

const TIPO_LABEL: Record<string, string> = {
  mantenimiento: 'Mantenimiento',
  evento: 'Evento',
  remodelacion: 'Remodelación',
  otro: 'Otro',
};

/** Tabla compartida de solicitudes (T-087 inquilino / T-106 admin).
 *  En móvil cada registro se muestra como una tarjeta. */
export function SolicitudesTable({
  solicitudes,
  baseHref,
  showSla = false,
  showAsignado = false,
}: {
  solicitudes: SolicitudListItem[];
  baseHref: string;
  showSla?: boolean;
  showAsignado?: boolean;
}) {
  if (solicitudes.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Inbox}
          title="Sin solicitudes"
          body="No hay solicitudes que coincidan con esos criterios."
        />
      </Card>
    );
  }

  const columns: ResponsiveColumn<SolicitudListItem>[] = [
    {
      key: 'codigo',
      header: 'Código',
      cardLabel: 'Código',
      primary: true,
      cell: (s) => (
        <Link href={`${baseHref}/${s.id}`} className="cellcode">
          {s.codigo}
        </Link>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      cardLabel: 'Tipo',
      cell: (s) => <span className="badge b-neutral">{TIPO_LABEL[s.tipo] ?? s.tipo}</span>,
    },
    {
      key: 'titulo',
      header: 'Título',
      cardLabel: 'Título',
      className: 'lead max-w-xs truncate',
      cell: (s) => s.titulo,
    },
    {
      key: 'local',
      header: 'Local',
      cardLabel: 'Local',
      cell: (s) => <span className="mono">{s.localCodigo ?? '—'}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      cardLabel: 'Estado',
      cell: (s) => <SolicitudEstadoBadge estado={s.estado} />,
    },
    {
      key: 'prioridad',
      header: 'Prioridad',
      cardLabel: 'Prioridad',
      cell: (s) => <PrioridadBadge prioridad={s.prioridad} />,
    },
    ...(showSla
      ? [
          {
            key: 'sla' as const,
            header: 'SLA',
            cardLabel: 'SLA',
            cell: (s: SolicitudListItem) => <SlaSemaforo status={s.slaStatus} />,
          },
        ]
      : []),
    ...(showAsignado
      ? [
          {
            key: 'asignado' as const,
            header: 'Asignada a',
            cardLabel: 'Asignada a',
            cell: (s: SolicitudListItem) =>
              s.adminAsignado?.nombre ? (
                <span className="inline-flex items-center gap-2">
                  <Avatar name={s.adminAsignado.nombre} sm />
                  <span style={{ color: 'var(--text-2)' }}>{s.adminAsignado.nombre}</span>
                </span>
              ) : (
                <span className="muted">—</span>
              ),
          },
        ]
      : []),
    {
      key: 'enviada',
      header: 'Enviada',
      cardLabel: 'Enviada',
      className: 'muted',
      cell: (s) => (s.enviadaAt ? formatDateInPlazaTz(s.enviadaAt) : '—'),
    },
    {
      key: 'decision',
      header: 'Decisión',
      cardLabel: 'Decisión',
      className: 'muted',
      cell: (s) => (s.decisionAt ? formatDateInPlazaTz(s.decisionAt) : '—'),
    },
  ];

  return (
    <Card>
      <ResponsiveDataView rows={solicitudes} columns={columns} rowKey={(s) => s.id} />
    </Card>
  );
}
