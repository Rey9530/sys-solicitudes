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
        <div className="banner banner-ok">
          Si el email existe, recibirás un enlace para restablecer tu contraseña. Expira en 30
          minutos.
        </div>
        <Link href="/login" className="inline-block text-sm" style={{ color: 'var(--primary)' }}>
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register('email')}
          className="input"
          placeholder="tucorreo@plazapp.com"
        />
        {errors.email && <p className="err">{errors.email.message}</p>}
      </div>

      <button type="submit" disabled={submitting} className="btn btn-primary btn-block btn-lg">
        {submitting ? 'Enviando…' : 'Enviar enlace'}
      </button>

      <div className="text-center">
        <Link href="/login" className="text-sm" style={{ color: 'var(--primary)' }}>
          Volver a iniciar sesión
        </Link>
      </div>
    </form>
  );
}
