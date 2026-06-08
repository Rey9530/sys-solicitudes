import type { Metadata } from 'next';
import { ResetConfirmForm } from '@/components/client/reset-confirm-form';
import { AuthLayout } from '@/components/shell/auth-layout';

export const metadata: Metadata = { title: 'Nueva contraseña' };

export default async function ResetConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <AuthLayout title="Elige una nueva contraseña" subtitle="Debe tener al menos 8 caracteres.">
      <ResetConfirmForm token={token} />
    </AuthLayout>
  );
}
