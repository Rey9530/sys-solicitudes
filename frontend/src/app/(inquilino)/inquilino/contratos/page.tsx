import type { Metadata } from 'next';
import type { ContratoListItem } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { ContratosTable } from '@/components/client/contratos-table';

export const metadata: Metadata = { title: 'Mis contratos' };

export default async function InquilinoContratosPage() {
  // El backend filtra por el inquilino_id del JWT (nunca del query).
  const res = await apiFetch('/contratos?page=1&pageSize=50');
  const data = res.ok
    ? ((await res.json()) as { items: ContratoListItem[]; total: number })
    : { items: [], total: 0 };

  return (
    <div className="page wide">
      <PageHeader title="Mis contratos" subtitle={`${data.total} contratos asociados a tu cuenta.`} />
      <ContratosTable
        contratos={data.items}
        detalleBasePath="/inquilino/contratos"
        mostrarInquilino={false}
      />
    </div>
  );
}
