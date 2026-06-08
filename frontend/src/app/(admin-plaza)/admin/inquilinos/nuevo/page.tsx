import type { Metadata } from 'next';
import { NuevoInquilinoForm } from '@/components/client/nuevo-inquilino-form';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Nuevo inquilino' };

export default function NuevoInquilinoPage() {
  return (
    <div className="page narrow">
      <PageHeader
        title="Nuevo inquilino"
        subtitle="Razón social e identificación son inmutables tras crear."
        breadcrumb={[{ label: 'Inquilinos', href: '/admin/inquilinos' }, { label: 'Nuevo' }]}
      />
      <NuevoInquilinoForm />
    </div>
  );
}
