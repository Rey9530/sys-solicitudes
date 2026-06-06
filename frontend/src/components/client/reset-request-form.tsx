'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ResetPasswordRequestSchema, type ResetPasswordRequest } from '@app/contracts';
import { requestResetAction } from '@/app/(public)/reset-password/actions';

export function ResetRequestForm() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordRequest>({
    resolver: zodResolver(ResetPasswordRequestSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ResetPasswordRequest) => {
    setSubmitting(true);
    await requestResetAction(values);
    setSubmitting(false);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-gray-600">
          Si el email existe, recibirás un enlace para restablecer tu contraseña.
          El enlace expira en 30 minutos.
        </p>
        <Link href="/login" className="inline-block text-sm text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register('email')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          placeholder="tucorreo@plazapp.com"
        />
        {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? 'Enviando…' : 'Enviar enlace'}
      </button>

      <div className="text-center">
        <Link href="/login" className="text-sm text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    </form>
  );
}
