'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { LoginSchema, type LoginInput } from '@app/contracts';
import { loginAction } from '@/app/(public)/login/actions';
import { homeForRole } from '@/lib/home-redirect';

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
        router.push(homeForRole(result.rol));
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

      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="input"
          placeholder="••••••••"
        />
        {errors.password && <p className="err">{errors.password.message}</p>}
      </div>

      <button type="submit" disabled={submitting} className="btn btn-primary btn-block btn-lg">
        {submitting ? 'Iniciando…' : 'Iniciar sesión'}
      </button>

      <div className="text-center">
        <Link href="/reset-password" className="text-sm" style={{ color: 'var(--primary)' }}>
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
    </form>
  );
}
