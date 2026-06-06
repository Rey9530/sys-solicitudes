import type { Metadata } from 'next';
import { CategoriaForm } from '@/components/client/categoria-form';

export const metadata: Metadata = { title: 'Nueva categoría' };

export default function NuevaCategoriaPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva categoría</h1>
        <p className="text-sm text-gray-500">
          Las categorías agrupan subcategorías con responsable y supervisores.
        </p>
      </div>
      <CategoriaForm />
    </div>
  );
}
