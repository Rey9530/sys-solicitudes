'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { KeyRound, Power, PowerOff, UserX } from 'lucide-react';
import type { UsuarioOutput } from '@app/contracts';
import {
  adminResetUsuarioPasswordAction,
  disableUsuarioInquilinoAction,
  reactivateUsuarioInquilinoAction,
} from '@/app/(admin-plaza)/admin/inquilinos/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { EditarUsuarioInquilinoDialog } from '@/components/client/editar-usuario-inquilino-dialog';
import { confirmAction } from '@/lib/sweetalert';
import {
  ResponsiveDataView,
  type ResponsiveColumn,
} from '@/components/client/responsive/responsive-data-view';

type UsuarioRow = UsuarioOutput & {
  rolStaffActivo: boolean | null;
  rolStaffNombre: string | null;
};

export function UsuariosInquilinoTable({ usuarios }: { usuarios: UsuarioRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onDisable = async (u: UsuarioRow) => {
    const ok = await confirmAction({
      title: `¿Deshabilitar a "${u.nombre}"?`,
      text: `${u.email}\n\nEl usuario no podrá iniciar sesión. Sus datos se conservan y puedes reactivarlo después.`,
      icon: 'warning',
      confirmButtonText: 'Sí, deshabilitar',
    });
    if (!ok) return;
    setPendingId(u.id);
    const result = await disableUsuarioInquilinoAction(u.id);
    setPendingId(null);
    if (result.ok) {
      toast.success('Usuario deshabilitado');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const onReactivate = async (u: UsuarioRow) => {
    const ok = await confirmAction({
      title: `¿Reactivar a "${u.nombre}"?`,
      text: `${u.email}\n\nVolverá a poder iniciar sesión.`,
      icon: 'question',
      confirmButtonText: 'Sí, reactivar',
    });
    if (!ok) return;
    setPendingId(u.id);
    const result = await reactivateUsuarioInquilinoAction(u.id);
    setPendingId(null);
    if (result.ok) {
      toast.success('Usuario reactivado');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const onReset = async (u: UsuarioRow) => {
    const ok = await confirmAction({
      title: `¿Enviar email de reseteo de contraseña?`,
      text: `Se enviará a ${u.email} un enlace válido por 30 minutos para que fije una nueva contraseña.`,
      icon: 'question',
      confirmButtonText: 'Sí, enviar',
    });
    if (!ok) return;
    setPendingId(u.id);
    const result = await adminResetUsuarioPasswordAction(u.id);
    setPendingId(null);
    if (result.ok) {
      toast.success('Email de reseteo enviado al usuario');
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
          title="Sin usuarios"
          body="Este inquilino aún no tiene accesos al portal. Usa «Alta rápida de usuario» en la esquina superior derecha para crear el primero."
        />
      </Card>
    );
  }

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
    { key: 'rol', header: 'Rol staff', cardLabel: 'Rol staff', className: 'muted', cell: (u) => u.rolStaffNombre ?? '—' },
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
            <Button
              variant="success"
              size="sm"
              disabled={pendingId === u.id}
              onClick={() => onReactivate(u)}
            >
              <Power />
              {pendingId === u.id ? 'Reactivando…' : 'Reactivar'}
            </Button>
          );
        }
        return (
          <div className="inline-flex items-center gap-1">
            <EditarUsuarioInquilinoDialog
              usuarioId={u.id}
              nombreInicial={u.nombre}
              telefonoInicial={u.telefono}
              email={u.email}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={pendingId === u.id}
              onClick={() => onReset(u)}
            >
              <KeyRound />
              {pendingId === u.id ? 'Enviando…' : 'Resetear clave'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={pendingId === u.id}
              onClick={() => onDisable(u)}
            >
              <PowerOff />
              {pendingId === u.id ? 'Deshabilitando…' : 'Deshabilitar'}
            </Button>
          </div>
        );
      },
      actions: (u) => {
        if (u.deletedAt !== null) {
          return (
            <Button
              variant="success"
              size="sm"
              disabled={pendingId === u.id}
              onClick={() => onReactivate(u)}
            >
              <Power />
              {pendingId === u.id ? 'Reactivando…' : 'Reactivar'}
            </Button>
          );
        }
        return (
          <div className="flex flex-wrap gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pendingId === u.id}
              onClick={() => onReset(u)}
            >
              <KeyRound />
              Resetear
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={pendingId === u.id}
              onClick={() => onDisable(u)}
            >
              <PowerOff />
              Deshabilitar
            </Button>
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
