import type { Metadata } from 'next';
import { ResetConfirmForm } from '@/components/client/reset-confirm-form';

export const metadata: Metadata = { title: 'Nueva contraseña' };

export default async function ResetConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-primary">Plazapp</h1>
          <p className="mt-1 text-sm text-gray-500">Elige una nueva contraseña</p>
        </div>
        <ResetConfirmForm token={token} />
      </div>
    </main>
  );
}
