'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { PlazaOutput } from '@app/contracts';
import { deactivatePlazaAction, selectPlazaAction } from '@/app/(admin-plataform)/superadmin/plazas/actions';
import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateInPlazaTz } from '@/lib/datetime';
import { confirmAction } from '@/lib/sweetalert';
import {
  ResponsiveDataView,
  type ResponsiveColumn,
} from '@/components/client/responsive/responsive-data-view';

export function PlazasTable({ plazas }: { plazas: PlazaOutput[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onDeactivate = async (plaza: PlazaOutput) => {
    const ok = await confirmAction({
      title: `¿Desactivar la plaza "${plaza.nombreComercial}"?`,
      text: 'Ningún usuario de la plaza podrá iniciar sesión. Los datos y el historial se conservan.',
      icon: 'warning',
      confirmButtonText: 'Sí, desactivar',
    });
    if (!ok) return;
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

  const onEntrar = async (plaza: PlazaOutput) => {
    await selectPlazaAction(plaza.id);
    router.push('/admin/dashboard');
    router.refresh();
  };

  if (plazas.length === 0) {
    return (
      <Card>
        <EmptyState icon={Building2} title="Sin plazas" body="Aún no hay plazas registradas." />
      </Card>
    );
  }

  const columns: ResponsiveColumn<PlazaOutput>[] = [
    {
      key: 'plaza',
      header: 'Plaza',
      cardLabel: 'Plaza',
      primary: true,
      className: 'lead',
      cell: (p) => (
        <span className="rowdot">
          <span className="dot" style={{ backgroundColor: p.colorPrimario }} />
          {p.nombreComercial}
        </span>
      ),
    },
    { key: 'slug', header: 'Slug', cardLabel: 'Slug', className: 'mono muted', cell: (p) => p.slug },
    {
      key: 'contacto',
      header: 'Contacto',
      cardLabel: 'Contacto',
      className: 'muted',
      cell: (p) => p.emailContacto ?? '—',
    },
    {
      key: 'creada',
      header: 'Creada',
      cardLabel: 'Creada',
      className: 'muted',
      cell: (p) => formatDateInPlazaTz(p.createdAt),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      className: 'actions',
      cell: (p) => (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onEntrar(p)}>
            Entrar
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={pendingId === p.id}
            onClick={() => onDeactivate(p)}
          >
            {pendingId === p.id ? 'Desactivando…' : 'Desactivar'}
          </Button>
        </div>
      ),
      actions: (p) => (
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => onEntrar(p)}>
            Entrar
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={pendingId === p.id}
            onClick={() => onDeactivate(p)}
          >
            {pendingId === p.id ? 'Desactivando…' : 'Desactivar'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <ResponsiveDataView rows={plazas} columns={columns} rowKey={(p) => p.id} />
    </Card>
  );
}
