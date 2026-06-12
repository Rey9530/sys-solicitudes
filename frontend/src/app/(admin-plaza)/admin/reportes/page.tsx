import type { Metadata } from 'next';
import type { InquilinoOutput, LocalOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { loadTiposSolicitud } from '@/lib/solicitudes-data';
import { ReportesGenerator } from '@/components/client/reportes-generator';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Reportes' };

/** T-144: generación y descarga de reportes (solo admin, S-RE-A).
 *  T-V20: el filtro de tipo se rellena con la config por plaza. */
export default async function AdminReportesPage() {
  const [localesRes, inquilinosRes, tiposConfig] = await Promise.all([
    apiFetch('/locales?page=1&pageSize=100'),
    apiFetch('/inquilinos?page=1&pageSize=100'),
    loadTiposSolicitud(),
  ]);
  const locales = localesRes.ok
    ? ((await localesRes.json()) as { items: LocalOutput[] }).items
    : [];
  const inquilinos = inquilinosRes.ok
    ? ((await inquilinosRes.json()) as { items: InquilinoOutput[] }).items
    : [];

  return (
    <div className="page wide">
      <PageHeader
        title="Reportes"
        subtitle="Exporta solicitudes, locales e inquilinos a CSV, XLSX o PDF. Rango máximo: 12 meses."
      />
      <ReportesGenerator
        locales={locales.map((l) => ({ id: l.id, label: l.codigo }))}
        inquilinos={inquilinos.map((i) => ({ id: i.id, label: i.razonSocial }))}
        tipos={tiposConfig.map((t) => ({ codigo: t.codigo, etiqueta: t.etiqueta }))}
      />
    </div>
  );
}
