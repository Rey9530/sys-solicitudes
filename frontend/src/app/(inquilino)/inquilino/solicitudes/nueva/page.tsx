import type { Metadata } from 'next';
import { loadCategorias, loadLocales } from '@/lib/solicitudes-data';
import { SolicitudWizard } from '@/components/client/solicitud-wizard';

export const metadata: Metadata = { title: 'Nueva solicitud' };

/** Wizard de nueva solicitud (T-088, sin recurrencia — T-V05). */
export default async function NuevaSolicitudPage() {
  const [categorias, locales] = await Promise.all([loadCategorias(), loadLocales()]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva solicitud</h1>
        <p className="text-sm text-gray-500">
          Se guarda como borrador hasta que la envíes; al enviarla entra a la cola de asignación.
        </p>
      </div>
      <SolicitudWizard categorias={categorias} locales={locales} />
    </div>
  );
}
