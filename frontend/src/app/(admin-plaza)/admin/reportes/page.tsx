import type { Metadata } from 'next';
import type { InquilinoOutput, LocalOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { ReportesGenerator } from '@/components/client/reportes-generator';

export const metadata: Metadata = { title: 'Reportes' };

/** T-144: generación y descarga de reportes (solo admin, S-RE-A). */
export default async function AdminReportesPage() {
  const [localesRes, inquilinosRes] = await Promise.all([
    apiFetch('/locales?page=1&pageSize=100'),
    apiFetch('/inquilinos?page=1&pageSize=100'),
  ]);
  const locales = localesRes.ok
    ? ((await localesRes.json()) as { items: LocalOutput[] }).items
    : [];
  const inquilinos = inquilinosRes.ok
    ? ((await inquilinosRes.json()) as { items: InquilinoOutput[] }).items
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500">
          Exporta solicitudes, locales e inquilinos a CSV, XLSX o PDF. Rango máximo: 12 meses.
        </p>
      </div>
      <ReportesGenerator
        locales={locales.map((l) => ({ id: l.id, label: l.codigo }))}
        inquilinos={inquilinos.map((i) => ({ id: i.id, label: i.razonSocial }))}
      />
    </div>
  );
}
