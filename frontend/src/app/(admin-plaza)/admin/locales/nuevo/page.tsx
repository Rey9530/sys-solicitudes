import type { Metadata } from 'next';
import { NuevoLocalForm } from '@/components/client/nuevo-local-form';

export const metadata: Metadata = { title: 'Nuevo local' };

export default function NuevoLocalPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo local</h1>
        <p className="text-sm text-gray-500">Se crea en estado «disponible».</p>
      </div>
      <NuevoLocalForm />
    </div>
  );
}
