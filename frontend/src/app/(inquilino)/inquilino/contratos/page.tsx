import type { Metadata } from 'next';
import Link from 'next/link';
import type { ContratoListItem } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ContratoEstadoBadge } from '@/components/estado-badge';

export const metadata: Metadata = { title: 'Mis contratos' };

export default async function InquilinoContratosPage() {
  // El backend filtra por el inquilino_id del JWT (nunca del query).
  const res = await apiFetch('/contratos?page=1&pageSize=50');
  const data = res.ok
    ? ((await res.json()) as { items: ContratoListItem[]; total: number })
    : { items: [], total: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis contratos</h1>
        <p className="text-sm text-gray-500">{data.total} contratos asociados a tu cuenta.</p>
      </div>
      {data.items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">
          No tienes contratos registrados.
        </p>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Local</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/inquilino/contratos/${c.id}`}
                      className="text-primary hover:underline"
                    >
                      {c.localCodigo ?? c.localId.slice(0, 8)}
                    </Link>
                  </TableCell>
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
      )}
    </div>
  );
}
