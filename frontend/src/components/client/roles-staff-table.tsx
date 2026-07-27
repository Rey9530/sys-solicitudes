'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PowerOff, ShieldX } from 'lucide-react';
import type { RolStaffOutput } from '@app/contracts';
import { disableRolStaffAction } from '@/app/(admin-plaza)/admin/usuarios-plaza/actions';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { RolStaffFormDialog } from '@/components/client/rol-staff-form-dialog';
import { Can } from '@/components/client/can';
import { confirmAction } from '@/lib/sweetalert';

/**
 * Catálogo de `rol_staff` de la plaza (T-035). Cada fila expone:
 *  - nombre, código, descripción, estado (activo/inactivo)
 *  - badge con nº de usuarios asignados (RN-RS-3)
 *  - acciones: editar (reabre el form) y desactivar (soft delete)
 *
 * Si un rol desactivado tiene usuarios asignados, el backend devuelve
 * `usuariosAsignados > 0` y el FE lo refleja con un warning explícito.
 */
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

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Usuarios asignados</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="actions">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((r) => {
            const asignados = usuariosAsignadosPorRol[r.id] ?? 0;
            return (
              <TableRow key={r.id}>
                <TableCell className="mono">{r.codigo}</TableCell>
                <TableCell className="lead">{r.nombre}</TableCell>
                <TableCell className="muted">{r.descripcion ?? '—'}</TableCell>
                <TableCell>
                  {asignados > 0 ? (
                    <span className="badge b-info">
                      <span className="bdot" />
                      {asignados}
                    </span>
                  ) : (
                    <span className="muted">0</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.activo ? (
                    <span className="badge b-ok">
                      <span className="bdot" />
                      Activo
                    </span>
                  ) : (
                    <span className="badge b-neutral">
                      <span className="bdot" />
                      Inactivo
                    </span>
                  )}
                </TableCell>
                <TableCell className="actions">
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
