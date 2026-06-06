import type { Metadata } from 'next';
import type { PlazaOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { NuevaPlazaDialog } from '@/components/client/nueva-plaza-dialog';
import { PlazasTable } from '@/components/client/plazas-table';

export const metadata: Metadata = { title: 'Plazas' };

export default async function SuperadminPlazasPage() {
  // El rol superadmin ya está garantizado por el layout (admin-plataform).
  // El listado se obtiene con apiFetch directo (no vía Server Action, que solo
  // debe invocarse desde formularios/cliente).
  const res = await apiFetch('/plazas?page=1&pageSize=50');
  const data = res.ok
    ? ((await res.json()) as { items: PlazaOutput[] })
    : { items: [] };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plazas</h1>
          <p className="text-sm text-gray-500">Gestiona los tenants de la plataforma.</p>
        </div>
        <NuevaPlazaDialog />
      </div>
      <PlazasTable plazas={data.items} />
    </div>
  );
}
