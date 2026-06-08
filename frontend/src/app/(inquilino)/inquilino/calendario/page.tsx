import type { Metadata } from 'next';
import { loadLocales } from '@/lib/solicitudes-data';
import { CalendarioView } from '@/components/client/calendario/calendario-view';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Calendario' };

/**
 * T-133: calendario del inquilino — solo SUS eventos/mantenimientos/hitos
 * (el scope lo aplica el backend por inquilino_id del JWT). El flag de hitos
 * lo valida el feed server-side (GET /configuracion es admin-only).
 */
export default async function InquilinoCalendarioPage() {
  const locales = await loadLocales();

  return (
    <div className="page wide">
      <PageHeader
        title="Calendario"
        subtitle="Tus eventos aprobados, mantenimientos e hitos de contrato. Haz click en un slot vacío para solicitar un evento."
      />
      <CalendarioView
        rol="inquilino"
        locales={locales.map((l) => ({ id: l.id, label: l.codigo }))}
        mostrarHitosConfig
      />
    </div>
  );
}
