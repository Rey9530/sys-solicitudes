'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { LoginSchema, type LoginInput } from '@app/contracts';
import { loginAction } from '@/app/(public)/login/actions';

/** Destino post-login por rol. Los dashboards llegan en módulos posteriores;
 *  por ahora todos van a la home autenticada. */
function redirectTarget(_rol: string): string {
  return '/';
}

export function LoginForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginInput) => {
    setSubmitting(true);
    try {
      const result = await loginAction(values);
      if (result.ok) {
        toast.success('Sesión iniciada');
        router.push(redirectTarget(result.rol));
        router.refresh();
        return;
      }
      if (result.error === 'locked') {
        toast.error('Cuenta bloqueada temporalmente por varios intentos fallidos. Intenta más tarde.');
      } else if (result.error === 'invalid') {
        toast.error('Email o contraseña incorrectos');
      } else {
        toast.error('No se pudo iniciar sesión. Intenta de nuevo.');
      }
    } catch {
      toast.error('No se pudo iniciar sesión. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

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

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-gray-700">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          placeholder="••••••••"
        />
        {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Iniciando…' : 'Iniciar sesión'}
      </button>

      <div className="text-center">
        <Link href="/reset-password" className="text-sm text-primary hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
    </form>
  );
}
