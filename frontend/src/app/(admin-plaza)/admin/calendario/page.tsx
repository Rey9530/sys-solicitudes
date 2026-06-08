import type { Metadata } from 'next';
import type { Configuracion, InquilinoOutput, LocalOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { CalendarioView } from '@/components/client/calendario/calendario-view';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Calendario' };

/** T-133: calendario del admin (Server Component que hidrata el Client). */
export default async function AdminCalendarioPage() {
  const [localesRes, inquilinosRes, configRes] = await Promise.all([
    apiFetch('/locales?page=1&pageSize=100'),
    apiFetch('/inquilinos?page=1&pageSize=100'),
    apiFetch('/configuracion'),
  ]);
  const locales = localesRes.ok
    ? ((await localesRes.json()) as { items: LocalOutput[] }).items
    : [];
  const inquilinos = inquilinosRes.ok
    ? ((await inquilinosRes.json()) as { items: InquilinoOutput[] }).items
    : [];
  const config = configRes.ok ? ((await configRes.json()) as Configuracion) : null;

  return (
    <div className="page wide">
      <PageHeader
        title="Calendario"
        subtitle="Eventos aprobados, mantenimientos programados e hitos contractuales de la plaza."
      />
      <CalendarioView
        rol="admin"
        locales={locales.map((l) => ({ id: l.id, label: l.codigo }))}
        inquilinos={inquilinos.map((i) => ({ id: i.id, label: i.razonSocial }))}
        mostrarHitosConfig={config?.calendarMostrarHitosContrato ?? true}
      />
    </div>
  );
}
