'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  KeyRound,
  Power,
  UserX,
} from 'lucide-react';
import type { RolStaffOutput, UsuarioOutput } from '@app/contracts';
import {
  adminResetUsuarioPlazaAction,
  reactivateUsuarioPlazaAction,
} from '@/app/(admin-plaza)/admin/usuarios-plaza/actions';
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
import { EditarUsuarioPlazaDialog } from '@/components/client/editar-usuario-plaza-dialog';
import { DeshabilitarUsuarioPlazaDialog } from '@/components/client/deshabilitar-usuario-plaza-dialog';
import { Can } from '@/components/client/can';
import { confirmAction } from '@/lib/sweetalert';

type UsuarioRow = UsuarioOutput & {
  rolStaffActivo: boolean | null;
  rolStaffNombre: string | null;
};

/**
 * Tabla de usuarios `admin_plaza` de la plaza (T-059-ter). Permite al admin
 * gestionar a otros admins:
 *  - Editar nombre, teléfono y rol_staff
 *  - Disparar reset de contraseña por email
 *  - Deshabilitar con motivo obligatorio (RN-AU-5 protege al último admin)
 *  - Reactivar
 *
 * El Server Component padre materializa la lista con RSC; tras cada acción
 * se llama `router.refresh()` para re-fetchear.
 */
export function UsuariosPlazaTable({
  usuarios,
  rolesStaff,
}: {
  usuarios: UsuarioRow[];
  rolesStaff: RolStaffOutput[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onReset = async (u: UsuarioRow) => {
    const ok = await confirmAction({
      title: `¿Enviar email de reseteo de contraseña?`,
      text: `Se enviará a ${u.email} un enlace válido por 30 minutos para que fije una nueva contraseña.`,
      icon: 'question',
      confirmButtonText: 'Sí, enviar',
    });
    if (!ok) return;
    setPendingId(u.id);
    const result = await adminResetUsuarioPlazaAction(u.id);
    setPendingId(null);
    if (result.ok) {
      toast.success('Email de reseteo enviado al usuario');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const onReactivate = async (u: UsuarioRow) => {
    const ok = await confirmAction({
      title: `¿Reactivar a "${u.nombre}"?`,
      text: `${u.email}\n\nVolverá a poder iniciar sesión y tomar/decidir solicitudes.`,
      icon: 'question',
      confirmButtonText: 'Sí, reactivar',
    });
    if (!ok) return;
    setPendingId(u.id);
    const result = await reactivateUsuarioPlazaAction(u.id);
    setPendingId(null);
    if (result.ok) {
      toast.success('Usuario reactivado');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  if (usuarios.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={UserX}
          title="Sin usuarios admin_plaza"
          body="Crea el primero con «Nuevo usuario». Necesitarás al menos un rol de staff activo (pestaña «Roles de staff»)."
        />
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Rol de staff</TableHead>
            <TableHead>Último acceso</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="actions">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((u) => {
            const inactivo = u.deletedAt !== null;
            const rolStaffInactivo = u.rolStaffActivo === false;
            return (
              <TableRow key={u.id}>
                <TableCell className="lead">{u.nombre}</TableCell>
                <TableCell className="mono muted">{u.email}</TableCell>
                <TableCell className="muted">{u.telefono ?? '—'}</TableCell>
                <TableCell>
                  {u.rolStaffNombre ? (
                    rolStaffInactivo ? (
                      <span className="badge b-warn" title="El rol de staff está inactivo">
                        <span className="bdot" />
                        {u.rolStaffNombre} (inactivo)
                      </span>
                    ) : (
                      <span className="badge b-ok">
                        <span className="bdot" />
                        {u.rolStaffNombre}
                      </span>
                    )
                  ) : (
                    <span className="muted">—</span>
                  )}
                </TableCell>
                <TableCell className="muted">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Nunca'}
                </TableCell>
                <TableCell>
                  {inactivo ? (
                    <span className="badge b-neutral">
                      <span className="bdot" />
                      Inactivo
                    </span>
                  ) : u.emailInvalido ? (
                    <span className="badge b-warn">
                      <span className="bdot" />
                      Email inválido
                    </span>
                  ) : (
                    <span className="badge b-ok">
                      <span className="bdot" />
                      Activo
                    </span>
                  )}
                </TableCell>
                <TableCell className="actions">
                  {inactivo ? (
                    <Can permiso="usuarios_plaza.reactivar">
                      <Button
                        variant="success"
                        size="sm"
                        disabled={pendingId === u.id}
                        onClick={() => onReactivate(u)}
                      >
                        <Power />
                        {pendingId === u.id ? 'Reactivando…' : 'Reactivar'}
                      </Button>
                    </Can>
                  ) : (
                    <div className="inline-flex items-center gap-1">
                      <Can permiso="usuarios_plaza.editar">
                        <EditarUsuarioPlazaDialog
                          usuarioId={u.id}
                          nombreInicial={u.nombre}
                          telefonoInicial={u.telefono}
                          email={u.email}
                          rolStaffIdInicial={u.rolStaffId}
                          rolesStaff={rolesStaff}
                        />
                      </Can>
                      <Can permiso="usuarios_plaza.resetear_clave">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingId === u.id}
                          onClick={() => onReset(u)}
                        >
                          <KeyRound />
                          {pendingId === u.id ? 'Enviando…' : 'Resetear clave'}
                        </Button>
                      </Can>
                      <Can permiso="usuarios_plaza.deshabilitar">
                        <DeshabilitarUsuarioPlazaDialog
                          usuarioId={u.id}
                          nombre={u.nombre}
                          email={u.email}
                          onDisabled={() => router.refresh()}
                        />
                      </Can>
                    </div>
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
