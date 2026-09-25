'use client';

import { useState } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { ChangePasswordFormSchema, type ChangePasswordFormInput } from '@app/contracts';
import { changePasswordAction } from '@/app/change-password-action';
import { logoutAndRedirect } from '@/app/logout-action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const EMPTY: ChangePasswordFormInput = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

/**
 * Cambio de contraseña del usuario autenticado (cualquier rol). Al confirmarse,
 * el backend revoca todas las sesiones, así que cerramos la sesión local y
 * redirigimos a `/login?password_changed=1`.
 */
export function CambiarPasswordDialog() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordFormInput>({
    resolver: zodResolver(ChangePasswordFormSchema),
    defaultValues: EMPTY,
  });

  const onSubmit = async (values: ChangePasswordFormInput) => {
    setSubmitting(true);
    const result = await changePasswordAction({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    if (!result.ok) {
      setSubmitting(false);
      if (result.field) {
        setError(result.field, { message: result.error }, { shouldFocus: true });
      } else {
        toast.error(result.error);
      }
      return;
    }
    await logoutAndRedirect('/login?password_changed=1');
  };

  const onOpenChange = (next: boolean) => {
    if (submitting) return;
    setOpen(next);
    if (next) reset(EMPTY);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="icon-btn"
          aria-label="Cambiar contraseña"
          title="Cambiar contraseña"
        >
          <KeyRound />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            Por seguridad, al guardar se cerrará tu sesión en todos los dispositivos y tendrás que
            volver a iniciar sesión.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
          <PasswordField
            id="chpw-actual"
            label="Contraseña actual"
            autoComplete="current-password"
            registration={register('currentPassword')}
            error={errors.currentPassword?.message}
          />
          <PasswordField
            id="chpw-nueva"
            label="Nueva contraseña"
            autoComplete="new-password"
            registration={register('newPassword')}
            error={errors.newPassword?.message}
            hint="Mínimo 8 caracteres, con mayúscula, minúscula y dígito."
          />
          <PasswordField
            id="chpw-confirmar"
            label="Confirmar nueva contraseña"
            autoComplete="new-password"
            registration={register('confirmPassword')}
            error={errors.confirmPassword?.message}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  registration,
  error,
  hint,
}: {
  id: string;
  label: string;
  autoComplete: 'current-password' | 'new-password';
  registration: UseFormRegisterReturn;
  error?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          className="pr-10"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...registration}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-[var(--text-3)] hover:text-[var(--text)]"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-[var(--text-3)]">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
