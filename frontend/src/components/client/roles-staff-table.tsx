'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PowerOff, ShieldX } from 'lucide-react';
import type { RolStaffOutput } from '@app/contracts';
import { disableRolStaffAction } from '@/app/(admin-plaza)/admin/usuarios-plaza/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { RolStaffFormDialog } from '@/components/client/rol-staff-form-dialog';
import { Can } from '@/components/client/can';
import { confirmAction } from '@/lib/sweetalert';
import {
  ResponsiveDataView,
  type ResponsiveColumn,
} from '@/components/client/responsive/responsive-data-view';

export function RolesStaffTable({
  roles,
  usuariosAsignadosPorRol,
}: {
  roles: RolStaffOutput[];
  usuariosAsignadosPorRol: Record<string, number>;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onDisable = async (rol: RolStaffOutput) => {
    const asignados = usuariosAsignadosPorRol[rol.id] ?? 0;
    const warning =
      asignados > 0
        ? `\n\n⚠️ Hay ${asignados} usuario(s) con este rol asignado. Quedarán con el rol inactivo visible en la UI.`
        : '';
    const ok = await confirmAction({
      title: `¿Desactivar el rol "${rol.nombre}"?`,
      text: `${rol.codigo}${warning}`,
      icon: 'warning',
      confirmButtonText: 'Sí, desactivar',
    });
    if (!ok) return;
    setPendingId(rol.id);
    const result = await disableRolStaffAction(rol.id);
    setPendingId(null);
    if (result.ok) {
      toast.success('Rol desactivado');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  if (roles.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ShieldX}
          title="Sin roles de staff"
          body="Crea el primer rol (técnico, supervisor, etc.) con «Nuevo rol»."
        />
      </Card>
    );
  }

  const columns: ResponsiveColumn<RolStaffOutput>[] = [
    { key: 'codigo', header: 'Código', cardLabel: 'Código', primary: true, className: 'mono', cell: (r) => r.codigo },
    { key: 'nombre', header: 'Nombre', cardLabel: 'Nombre', className: 'lead', cell: (r) => r.nombre },
    { key: 'descripcion', header: 'Descripción', cardLabel: 'Descripción', className: 'muted', cell: (r) => r.descripcion ?? '—' },
    {
      key: 'usuarios',
      header: 'Usuarios asignados',
      cardLabel: 'Usuarios asignados',
      cell: (r) => {
        const asignados = usuariosAsignadosPorRol[r.id] ?? 0;
        return asignados > 0 ? (
          <span className="badge b-info">
            <span className="bdot" />
            {asignados}
          </span>
        ) : (
          <span className="muted">0</span>
        );
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      cardLabel: 'Estado',
      cell: (r) =>
        r.activo ? (
          <span className="badge b-ok">
            <span className="bdot" />
            Activo
          </span>
        ) : (
          <span className="badge b-neutral">
            <span className="bdot" />
            Inactivo
          </span>
        ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      className: 'actions',
      cell: (r) => (
        <div className="inline-flex gap-1">
          <Can permiso="roles_staff.editar">
            <RolStaffFormDialog
              mode="edit"
              rol={{
                id: r.id,
                codigo: r.codigo,
                nombre: r.nombre,
                descripcion: r.descripcion,
                activo: r.activo,
              }}
            />
          </Can>
          {r.activo && (
            <Can permiso="roles_staff.deshabilitar">
              <Button
                variant="danger"
                size="sm"
                disabled={pendingId === r.id}
                onClick={() => onDisable(r)}
              >
                <PowerOff />
                {pendingId === r.id ? 'Desactivando…' : 'Desactivar'}
              </Button>
            </Can>
          )}
        </div>
      ),
      actions: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.activo && (
            <Can permiso="roles_staff.deshabilitar">
              <Button
                variant="danger"
                size="sm"
                disabled={pendingId === r.id}
                onClick={() => onDisable(r)}
              >
                <PowerOff />
                Desactivar
              </Button>
            </Can>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card>
      <ResponsiveDataView rows={roles} columns={columns} rowKey={(r) => r.id} />
    </Card>
  );
}
