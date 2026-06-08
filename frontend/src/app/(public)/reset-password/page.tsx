import type { Metadata } from 'next';
import { ResetRequestForm } from '@/components/client/reset-request-form';
import { AuthLayout } from '@/components/shell/auth-layout';

export const metadata: Metadata = { title: 'Restablecer contraseña' };

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Restablecer contraseña"
      subtitle="Te enviaremos un enlace para crear una nueva."
    >
      <ResetRequestForm />
    </AuthLayout>
  );
}
