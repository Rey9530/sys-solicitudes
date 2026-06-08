import type { Metadata } from 'next';
import type { PlazaOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { NuevaPlazaDialog } from '@/components/client/nueva-plaza-dialog';
import { PlazasTable } from '@/components/client/plazas-table';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Plazas' };

export default async function SuperadminPlazasPage() {
  // El rol superadmin ya está garantizado por el layout (admin-plataform).
  const res = await apiFetch('/plazas?page=1&pageSize=50');
  const data = res.ok ? ((await res.json()) as { items: PlazaOutput[] }) : { items: [] };

  return (
    <div className="page wide">
      <PageHeader
        title="Plazas"
        subtitle="Gestiona los tenants de la plataforma."
        actions={<NuevaPlazaDialog />}
      />
      <PlazasTable plazas={data.items} />
    </div>
  );
}
