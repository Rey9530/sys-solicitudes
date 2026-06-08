'use client';

import Link from 'next/link';
import { Inbox } from 'lucide-react';
import type { SolicitudListItem } from '@app/contracts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SolicitudEstadoBadge, PrioridadBadge, SlaSemaforo } from '@/components/estado-badge';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateInPlazaTz } from '@/lib/datetime';

const TIPO_LABEL: Record<string, string> = {
  mantenimiento: 'Mantenimiento',
  evento: 'Evento',
  remodelacion: 'Remodelación',
  otro: 'Otro',
};

/** Tabla compartida de solicitudes (T-087 inquilino / T-106 admin). */
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

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Local</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Prioridad</TableHead>
            {showSla && <TableHead>SLA</TableHead>}
            {showAsignado && <TableHead>Asignada a</TableHead>}
            <TableHead>Enviada</TableHead>
            <TableHead>Decisión</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {solicitudes.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <Link href={`${baseHref}/${s.id}`} className="cellcode">
                  {s.codigo}
                </Link>
              </TableCell>
              <TableCell>
                <span className="badge b-neutral">{TIPO_LABEL[s.tipo] ?? s.tipo}</span>
              </TableCell>
              <TableCell className="lead max-w-xs truncate">{s.titulo}</TableCell>
              <TableCell>
                <span className="mono">{s.localCodigo ?? '—'}</span>
              </TableCell>
              <TableCell>
                <SolicitudEstadoBadge estado={s.estado} />
              </TableCell>
              <TableCell>
                <PrioridadBadge prioridad={s.prioridad} />
              </TableCell>
              {showSla && (
                <TableCell>
                  <SlaSemaforo status={s.slaStatus} />
                </TableCell>
              )}
              {showAsignado && (
                <TableCell>
                  {s.adminAsignado?.nombre ? (
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={s.adminAsignado.nombre} sm />
                      <span style={{ color: 'var(--text-2)' }}>{s.adminAsignado.nombre}</span>
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </TableCell>
              )}
              <TableCell className="muted">
                {s.enviadaAt ? formatDateInPlazaTz(s.enviadaAt) : '—'}
              </TableCell>
              <TableCell className="muted">
                {s.decisionAt ? formatDateInPlazaTz(s.decisionAt) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
