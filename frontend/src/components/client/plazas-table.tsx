'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { PlazaOutput } from '@app/contracts';
import { deactivatePlazaAction } from '@/app/(admin-plataform)/superadmin/plazas/actions';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateInPlazaTz } from '@/lib/datetime';

export function PlazasTable({ plazas }: { plazas: PlazaOutput[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onDeactivate = async (plaza: PlazaOutput) => {
    if (!confirm(`¿Desactivar la plaza "${plaza.nombreComercial}"?`)) return;
    setPendingId(plaza.id);
    const result = await deactivatePlazaAction(plaza.id);
    setPendingId(null);
    if (result.ok) {
      toast.success('Plaza desactivada');
      router.refresh();
    } else {
      toast.error('No se pudo desactivar la plaza');
    }
  };

  if (plazas.length === 0) {
    return (
      <Card>
        <EmptyState icon={Building2} title="Sin plazas" body="Aún no hay plazas registradas." />
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plaza</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Creada</TableHead>
            <TableHead className="actions">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plazas.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="lead">
                <span className="rowdot">
                  <span className="dot" style={{ backgroundColor: p.colorPrimario }} />
                  {p.nombreComercial}
                </span>
              </TableCell>
              <TableCell className="mono muted">{p.slug}</TableCell>
              <TableCell className="muted">{p.emailContacto ?? '—'}</TableCell>
              <TableCell className="muted">{formatDateInPlazaTz(p.createdAt)}</TableCell>
              <TableCell className="actions">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={pendingId === p.id}
                  onClick={() => onDeactivate(p)}
                >
                  {pendingId === p.id ? 'Desactivando…' : 'Desactivar'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
