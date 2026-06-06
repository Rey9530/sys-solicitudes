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
        <p className="text-sm text-gray-600">El enlace es inválido o ha expirado.</p>
        <Link href="/reset-password" className="inline-block text-sm text-primary hover:underline">
          Solicitar un enlace nuevo
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
          Nueva contraseña
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          {...register('newPassword')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          placeholder="••••••••"
        />
        {errors.newPassword && <p className="text-xs text-red-600">{errors.newPassword.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
          Confirmar contraseña
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          placeholder="••••••••"
        />
        {errors.confirmPassword && (
          <p className="text-xs text-red-600">{errors.confirmPassword.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? 'Guardando…' : 'Restablecer contraseña'}
      </button>
    </form>
  );
}
