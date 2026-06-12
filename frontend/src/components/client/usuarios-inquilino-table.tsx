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
import { EditarUsuarioInquilinoDialog } from '@/components/client/editar-usuario-inquilino-dialog';
import { confirmAction } from '@/lib/sweetalert';

type UsuarioRow = UsuarioOutput & {
  rolStaffActivo: boolean | null;
  rolStaffNombre: string | null;
};

/**
 * Tabla de usuarios asociados a un inquilino (T-059-bis). Muestra los usuarios
 * (rol `inquilino` por defecto) y permite al admin gestionarlos:
 *  - Editar nombre y teléfono
 *  - Disparar reset de contraseña por email
 *  - Deshabilitar (soft delete)
 *  - Reactivar un usuario deshabilitado
 *
 * El server component padre (`page.tsx`) hace el fetch con RSC y pasa la lista
 * ya materializada para evitar waterfalls desde el cliente. Tras cada acción
 * se llama `router.refresh()` para que el padre re-fetchee con la nueva lista.
 *
 * Convenciones UI: todas las decisiones destructivas (deshabilitar, resetear)
 * usan `confirmAction` (SweetAlert2) — NUNCA `window.confirm` nativo. Ver
 * `lib/sweetalert.ts` y `docs/02-stack-tecnologico.md` §UI.
 */
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

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Rol staff</TableHead>
            <TableHead>Último acceso</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="actions">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {usuarios.map((u) => {
            const inactivo = u.deletedAt !== null;
            return (
              <TableRow key={u.id}>
                <TableCell className="lead">{u.nombre}</TableCell>
                <TableCell className="mono muted">{u.email}</TableCell>
                <TableCell className="muted">{u.telefono ?? '—'}</TableCell>
                <TableCell className="muted">{u.rolStaffNombre ?? '—'}</TableCell>
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
                    <Button
                      variant="success"
                      size="sm"
                      disabled={pendingId === u.id}
                      onClick={() => onReactivate(u)}
                    >
                      <Power />
                      {pendingId === u.id ? 'Reactivando…' : 'Reactivar'}
                    </Button>
                  ) : (
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
