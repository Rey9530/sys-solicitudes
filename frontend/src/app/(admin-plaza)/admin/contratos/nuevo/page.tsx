import type { Metadata } from 'next';
import type { LocalOutput, InquilinoOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { NuevoContratoForm } from '@/components/client/nuevo-contrato-form';

export const metadata: Metadata = { title: 'Nuevo contrato' };

export default async function NuevoContratoPage() {
  // Solo locales disponibles (T-060) e inquilinos activos.
  const [localesRes, inquilinosRes] = await Promise.all([
    apiFetch('/locales?estado=disponible&page=1&pageSize=100'),
    apiFetch('/inquilinos?page=1&pageSize=100'),
  ]);
  const locales = localesRes.ok
    ? ((await localesRes.json()) as { items: LocalOutput[] }).items
    : [];
  const inquilinos = inquilinosRes.ok
    ? ((await inquilinosRes.json()) as { items: InquilinoOutput[] }).items
    : [];

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo contrato</h1>
        <p className="text-sm text-gray-500">
          El local pasa a «alquilado» automáticamente. Sin fecha de fin = indefinido.
        </p>
      </div>
      <NuevoContratoForm
        locales={locales.map((l) => ({ id: l.id, codigo: l.codigo, nombre: l.nombre }))}
        inquilinos={inquilinos.map((i) => ({ id: i.id, razonSocial: i.razonSocial }))}
      />
    </div>
  );
}
