import type { Metadata } from 'next';
import { ResetRequestForm } from '@/components/client/reset-request-form';

export const metadata: Metadata = { title: 'Restablecer contraseña' };

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-primary">Plazapp</h1>
          <p className="mt-1 text-sm text-gray-500">Restablecer contraseña</p>
        </div>
        <ResetRequestForm />
      </div>
    </main>
  );
}
