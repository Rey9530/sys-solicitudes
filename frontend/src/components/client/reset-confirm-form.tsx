'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { PasswordSchema } from '@app/contracts';
import { confirmResetAction } from '@/app/(public)/reset-password/actions';

/** Schema del formulario: añade confirmación de contraseña a PasswordSchema. */
const ConfirmFormSchema = z
  .object({
    newPassword: PasswordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type ConfirmFormValues = z.infer<typeof ConfirmFormSchema>;

export function ResetConfirmForm({ token }: { token: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConfirmFormValues>({
    resolver: zodResolver(ConfirmFormSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: ConfirmFormValues) => {
    setSubmitting(true);
    const result = await confirmResetAction({ token, newPassword: values.newPassword });
    setSubmitting(false);
    if (result.ok) {
      toast.success('Contraseña actualizada');
      router.push('/login');
      return;
    }
    if (result.error === 'token') {
      setInvalidToken(true);
    } else {
      toast.error('Revisa los datos del formulario.');
    }
  };

  if (invalidToken) {
    return (
      <div className="space-y-4 text-center">
        <div className="banner banner-danger">El enlace es inválido o ha expirado.</div>
        <Link href="/reset-password" className="inline-block text-sm" style={{ color: 'var(--primary)' }}>
          Solicitar un enlace nuevo
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <div className="field">
        <label htmlFor="newPassword">Nueva contraseña</label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          {...register('newPassword')}
          className="input"
          placeholder="••••••••"
        />
        {errors.newPassword && <p className="err">{errors.newPassword.message}</p>}
      </div>

      <div className="field">
        <label htmlFor="confirmPassword">Confirmar contraseña</label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          className="input"
          placeholder="••••••••"
        />
        {errors.confirmPassword && <p className="err">{errors.confirmPassword.message}</p>}
      </div>

      <button type="submit" disabled={submitting} className="btn btn-primary btn-block btn-lg">
        {submitting ? 'Guardando…' : 'Restablecer contraseña'}
      </button>
    </form>
  );
}
