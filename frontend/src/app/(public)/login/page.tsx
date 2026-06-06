import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { LoginForm } from '@/components/client/login-form';

export const metadata: Metadata = { title: 'Iniciar sesión' };

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          {/* Branding básico; el logo/color por plaza llega con T-042 (módulo 03). */}
          <h1 className="text-2xl font-bold text-primary">Plazapp</h1>
          <p className="mt-1 text-sm text-gray-500">Inicia sesión para continuar</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
