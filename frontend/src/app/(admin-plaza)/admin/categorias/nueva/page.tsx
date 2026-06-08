import type { Metadata } from 'next';
import { CategoriaForm } from '@/components/client/categoria-form';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Nueva categoría' };

export default function NuevaCategoriaPage() {
  return (
    <div className="page narrow">
      <PageHeader
        title="Nueva categoría"
        subtitle="Las categorías agrupan subcategorías con responsable y supervisores."
        breadcrumb={[{ label: 'Categorías', href: '/admin/categorias' }, { label: 'Nueva' }]}
      />
      <CategoriaForm />
    </div>
  );
}
