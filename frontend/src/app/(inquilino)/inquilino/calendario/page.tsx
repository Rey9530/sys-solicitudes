import type { Metadata } from 'next';
import { loadLocales } from '@/lib/solicitudes-data';
import { CalendarioView } from '@/components/client/calendario/calendario-view';

export const metadata: Metadata = { title: 'Calendario' };

/**
 * T-133: calendario del inquilino — solo SUS eventos/mantenimientos/hitos
 * (el scope lo aplica el backend por inquilino_id del JWT). El flag de hitos
 * lo valida el feed server-side (GET /configuracion es admin-only).
 */
export default async function InquilinoCalendarioPage() {
  const locales = await loadLocales();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
        <p className="text-sm text-gray-500">
          Tus eventos aprobados, mantenimientos e hitos de contrato. Haz click en un slot vacío
          para solicitar un evento.
        </p>
      </div>
      <CalendarioView
        rol="inquilino"
        locales={locales.map((l) => ({ id: l.id, label: l.codigo }))}
        mostrarHitosConfig
      />
    </div>
  );
}
