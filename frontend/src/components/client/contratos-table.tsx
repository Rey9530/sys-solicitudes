'use client';

import Link from 'next/link';
import type { ContratoListItem } from '@app/contracts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ContratoEstadoBadge } from '@/components/estado-badge';

export function ContratosTable({ contratos }: { contratos: ContratoListItem[] }) {
  if (contratos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">
        No hay contratos con esos criterios.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Local</TableHead>
            <TableHead>Inquilino</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead>Fin</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contratos.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">
                <Link href={`/admin/contratos/${c.id}`} className="text-primary hover:underline">
                  {c.localCodigo ?? c.localId.slice(0, 8)}
                </Link>
              </TableCell>
              <TableCell>{c.inquilinoRazonSocial ?? '—'}</TableCell>
              <TableCell className="text-gray-500">{c.fechaInicio}</TableCell>
              <TableCell className="text-gray-500">{c.fechaFin ?? 'Indefinido'}</TableCell>
              <TableCell className="text-gray-500">
                {c.montoMensual !== null ? `${c.moneda} ${c.montoMensual}` : '—'}
              </TableCell>
              <TableCell>
                <ContratoEstadoBadge estado={c.estado} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
