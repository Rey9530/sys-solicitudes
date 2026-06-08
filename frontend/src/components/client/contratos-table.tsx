'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import type { ContratoListItem } from '@app/contracts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ContratoEstadoBadge } from '@/components/estado-badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

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

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Local</TableHead>
            <TableHead>Inquilino</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead>Fin</TableHead>
            <TableHead className="num">Monto</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contratos.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/admin/contratos/${c.id}`} className="cellcode">
                  {c.localCodigo ?? c.localId.slice(0, 8)}
                </Link>
              </TableCell>
              <TableCell className="lead">{c.inquilinoRazonSocial ?? '—'}</TableCell>
              <TableCell className="muted">{c.fechaInicio}</TableCell>
              <TableCell className="muted">{c.fechaFin ?? 'Indefinido'}</TableCell>
              <TableCell className="num muted">
                {c.montoMensual !== null ? `${c.moneda} ${c.montoMensual}` : '—'}
              </TableCell>
              <TableCell>
                <ContratoEstadoBadge estado={c.estado} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
