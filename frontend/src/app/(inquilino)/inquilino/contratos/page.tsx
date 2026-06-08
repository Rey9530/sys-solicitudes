import type { Metadata } from 'next';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import type { ContratoListItem } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ContratoEstadoBadge } from '@/components/estado-badge';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Mis contratos' };

export default async function InquilinoContratosPage() {
  // El backend filtra por el inquilino_id del JWT (nunca del query).
  const res = await apiFetch('/contratos?page=1&pageSize=50');
  const data = res.ok
    ? ((await res.json()) as { items: ContratoListItem[]; total: number })
    : { items: [], total: 0 };

  return (
    <div className="page wide">
      <PageHeader title="Mis contratos" subtitle={`${data.total} contratos asociados a tu cuenta.`} />
      {data.items.length === 0 ? (
        <Card>
          <EmptyState icon={FileText} title="Sin contratos" body="No tienes contratos registrados." />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Local</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead className="num">Monto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/inquilino/contratos/${c.id}`} className="cellcode">
                      {c.localCodigo ?? c.localId.slice(0, 8)}
                    </Link>
                  </TableCell>
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
      )}
    </div>
  );
}
