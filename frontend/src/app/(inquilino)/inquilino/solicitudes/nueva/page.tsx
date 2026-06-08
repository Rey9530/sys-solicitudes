import type { Metadata } from 'next';
import { SolicitudTipoSchema } from '@app/contracts';
import { loadCategorias, loadLocales } from '@/lib/solicitudes-data';
import { SolicitudWizard, type WizardPrefill } from '@/components/client/solicitud-wizard';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Nueva solicitud' };

/**
 * Wizard de nueva solicitud (T-088, sin recurrencia — T-V05).
 * T-132: acepta prefill por query params desde el calendario
 * (`?tipo=evento&fecha=YYYY-MM-DD&hora=HH:MM&localId=`).
 */
export default async function NuevaSolicitudPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; fecha?: string; hora?: string; localId?: string }>;
}) {
  const sp = await searchParams;
  const [categorias, locales] = await Promise.all([loadCategorias(), loadLocales()]);

  const tipoParsed = SolicitudTipoSchema.safeParse(sp.tipo);
  const prefill: WizardPrefill = {
    tipo: tipoParsed.success ? tipoParsed.data : undefined,
    fecha: sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : undefined,
    hora: sp.hora && /^([01]\d|2[0-3]):[0-5]\d$/.test(sp.hora) ? sp.hora : undefined,
    localId: sp.localId && locales.some((l) => l.id === sp.localId) ? sp.localId : undefined,
  };

  return (
    <div className="page narrow">
      <PageHeader
        title="Nueva solicitud"
        subtitle="Se guarda como borrador hasta que la envíes; al enviarla entra a la cola de asignación."
        breadcrumb={[{ label: 'Mis solicitudes', href: '/inquilino/solicitudes' }, { label: 'Nueva' }]}
      />
      <SolicitudWizard categorias={categorias} locales={locales} prefill={prefill} />
    </div>
  );
}
