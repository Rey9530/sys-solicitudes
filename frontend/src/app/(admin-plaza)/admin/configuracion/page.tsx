import type { Metadata } from 'next';
import type { Configuracion, PlazaOutput } from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';
import { ConfiguracionForm } from '@/components/client/configuracion-form';

export const metadata: Metadata = { title: 'Configuración' };

/** T-145: configuración de la plaza (CU-PA-7..12, S-Branding). */
export default async function AdminConfiguracionPage() {
  const session = await auth();
  const plazaId = session?.user?.plazaId;
  if (!plazaId) {
    return <p className="text-sm text-red-600">Esta pantalla requiere una plaza asignada.</p>;
  }

  const [plazaRes, configRes] = await Promise.all([
    apiFetch(`/plazas/${plazaId}`),
    apiFetch('/configuracion'),
  ]);
  if (!plazaRes.ok || !configRes.ok) {
    return <p className="text-sm text-red-600">No se pudo cargar la configuración.</p>;
  }
  const plaza = (await plazaRes.json()) as PlazaOutput;
  const configuracion = (await configRes.json()) as Configuracion;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500">
          Datos generales, branding, SLA, adjuntos y calendario de {plaza.nombreComercial}.
        </p>
      </div>
      <ConfiguracionForm plaza={plaza} configuracion={configuracion} />
    </div>
  );
}
