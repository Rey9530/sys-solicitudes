import type { Metadata } from 'next';
import type { Configuracion, PlazaOutput } from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';
import { ConfiguracionForm } from '@/components/client/configuracion-form';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Configuración' };

/** T-145: configuración de la plaza (CU-PA-7..12, S-Branding). */
export default async function AdminConfiguracionPage() {
  const session = await auth();
  const plazaId = session?.user?.plazaId;
  if (!plazaId) {
    return (
      <div className="page wide">
        <div className="banner banner-danger">Esta pantalla requiere una plaza asignada.</div>
      </div>
    );
  }

  const [plazaRes, configRes] = await Promise.all([
    apiFetch(`/plazas/${plazaId}`),
    apiFetch('/configuracion'),
  ]);
  if (!plazaRes.ok || !configRes.ok) {
    return (
      <div className="page wide">
        <div className="banner banner-danger">No se pudo cargar la configuración.</div>
      </div>
    );
  }
  const plaza = (await plazaRes.json()) as PlazaOutput;
  const configuracion = (await configRes.json()) as Configuracion;

  return (
    <div className="page wide">
      <PageHeader
        title="Configuración"
        subtitle={`Datos generales, branding, SLA, adjuntos y calendario de ${plaza.nombreComercial}.`}
      />
      <ConfiguracionForm plaza={plaza} configuracion={configuracion} />
    </div>
  );
}
