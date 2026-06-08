import type { Metadata } from 'next';
import { NuevoLocalForm } from '@/components/client/nuevo-local-form';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Nuevo local' };

export default function NuevoLocalPage() {
  return (
    <div className="page narrow">
      <PageHeader
        title="Nuevo local"
        subtitle="Se crea en estado «disponible»."
        breadcrumb={[{ label: 'Locales', href: '/admin/locales' }, { label: 'Nuevo' }]}
      />
      <NuevoLocalForm />
    </div>
  );
}
