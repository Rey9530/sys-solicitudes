import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { LoginForm } from '@/components/client/login-form';
import { AuthLayout } from '@/components/shell/auth-layout';

export const metadata: Metadata = { title: 'Iniciar sesión' };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/');
  }

  return (
    <AuthLayout title="Inicia sesión" subtitle="Accede a la consola de tu plaza.">
      <LoginForm />
    </AuthLayout>
  );
}
