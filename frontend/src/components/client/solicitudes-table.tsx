'use client';

import Link from 'next/link';
import type { SolicitudListItem } from '@app/contracts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SolicitudEstadoBadge, PrioridadBadge, SlaSemaforo } from '@/components/estado-badge';
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
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">
        No hay solicitudes con esos criterios.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-white">
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
              <TableCell className="font-medium">
                <Link href={`${baseHref}/${s.id}`} className="text-primary hover:underline">
                  {s.codigo}
                </Link>
              </TableCell>
              <TableCell className="text-gray-600">{TIPO_LABEL[s.tipo] ?? s.tipo}</TableCell>
              <TableCell className="max-w-xs truncate">{s.titulo}</TableCell>
              <TableCell className="text-gray-500">{s.localCodigo ?? '—'}</TableCell>
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
                <TableCell className="text-gray-500">{s.adminAsignado?.nombre ?? '—'}</TableCell>
              )}
              <TableCell className="text-gray-500">
                {s.enviadaAt ? formatDateInPlazaTz(s.enviadaAt) : '—'}
              </TableCell>
              <TableCell className="text-gray-500">
                {s.decisionAt ? formatDateInPlazaTz(s.decisionAt) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
