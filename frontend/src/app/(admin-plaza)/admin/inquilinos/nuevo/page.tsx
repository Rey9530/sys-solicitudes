import type { Metadata } from 'next';
import { NuevoInquilinoForm } from '@/components/client/nuevo-inquilino-form';

export const metadata: Metadata = { title: 'Nuevo inquilino' };

export default function NuevoInquilinoPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo inquilino</h1>
        <p className="text-sm text-gray-500">
          Razón social e identificación son inmutables tras crear.
        </p>
      </div>
      <NuevoInquilinoForm />
    </div>
  );
}
