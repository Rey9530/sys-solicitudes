'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound, Power, UserX } from 'lucide-react';
import type { RolStaffOutput, UsuarioOutput } from '@app/contracts';
import {
  adminResetUsuarioPlazaAction,
  reactivateUsuarioPlazaAction,
} from '@/app/(admin-plaza)/admin/usuarios-plaza/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { EditarUsuarioPlazaDialog } from '@/components/client/editar-usuario-plaza-dialog';
import { DeshabilitarUsuarioPlazaDialog } from '@/components/client/deshabilitar-usuario-plaza-dialog';
import { Can } from '@/components/client/can';
import { confirmAction } from '@/lib/sweetalert';
import {
  ResponsiveDataView,
  type ResponsiveColumn,
} from '@/components/client/responsive/responsive-data-view';

type UsuarioRow = UsuarioOutput & {
  rolStaffActivo: boolean | null;
  rolStaffNombre: string | null;
};

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

  const renderRolStaff = (u: UsuarioRow) => {
    if (!u.rolStaffNombre) {
      return <span className="muted">—</span>;
    }
    if (u.rolStaffActivo === false) {
      return (
        <span className="badge b-warn" title="El rol de staff está inactivo">
          <span className="bdot" />
          {u.rolStaffNombre} (inactivo)
        </span>
      );
    }
    return (
      <span className="badge b-ok">
        <span className="bdot" />
        {u.rolStaffNombre}
      </span>
    );
  };

  const renderEstado = (inactivo: boolean, emailInvalido: boolean | null | undefined) => {
    if (inactivo) {
      return (
        <span className="badge b-neutral">
          <span className="bdot" />
          Inactivo
        </span>
      );
    }
    if (emailInvalido) {
      return (
        <span className="badge b-warn">
          <span className="bdot" />
          Email inválido
        </span>
      );
    }
    return (
      <span className="badge b-ok">
        <span className="bdot" />
        Activo
      </span>
    );
  };

  const columns: ResponsiveColumn<UsuarioRow>[] = [
    { key: 'nombre', header: 'Nombre', cardLabel: 'Nombre', primary: true, className: 'lead', cell: (u) => u.nombre },
    { key: 'email', header: 'Email', cardLabel: 'Email', className: 'mono muted', cell: (u) => u.email },
    { key: 'telefono', header: 'Teléfono', cardLabel: 'Teléfono', className: 'muted', cell: (u) => u.telefono ?? '—' },
    { key: 'rol', header: 'Rol de staff', cardLabel: 'Rol de staff', cell: (u) => renderRolStaff(u) },
    {
      key: 'ultimo',
      header: 'Último acceso',
      cardLabel: 'Último acceso',
      className: 'muted',
      cell: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Nunca'),
    },
    {
      key: 'estado',
      header: 'Estado',
      cardLabel: 'Estado',
      cell: (u) => renderEstado(u.deletedAt !== null, u.emailInvalido),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      className: 'actions',
      cell: (u) => {
        if (u.deletedAt !== null) {
          return (
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
          );
        }
        return (
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
        );
      },
      actions: (u) => {
        if (u.deletedAt !== null) {
          return (
            <Can permiso="usuarios_plaza.reactivar">
              <Button
                variant="success"
                size="sm"
                disabled={pendingId === u.id}
                onClick={() => onReactivate(u)}
              >
                <Power />
                Reactivar
              </Button>
            </Can>
          );
        }
        return (
          <div className="flex flex-wrap gap-1">
            <Can permiso="usuarios_plaza.resetear_clave">
              <Button
                variant="outline"
                size="sm"
                disabled={pendingId === u.id}
                onClick={() => onReset(u)}
              >
                <KeyRound />
                Resetear
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
        );
      },
    },
  ];

  return (
    <Card>
      <ResponsiveDataView rows={usuarios} columns={columns} rowKey={(u) => u.id} />
    </Card>
  );
}
