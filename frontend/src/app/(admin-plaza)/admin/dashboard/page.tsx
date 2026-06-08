import type { Metadata } from 'next';
import { RefreshCw } from 'lucide-react';
import type { DashboardChartsOutput, KpisOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { AutoRefresh } from '@/components/client/auto-refresh';
import { DashboardContenido } from '@/components/dashboard-kpis';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Dashboard' };

/** T-143: dashboard del admin de plaza (refresco cada 5 min). */
export default async function AdminDashboardPage() {
  const [kpisRes, chartsRes] = await Promise.all([
    apiFetch('/reportes/kpis'),
    apiFetch('/reportes/dashboard'),
  ]);
  if (!kpisRes.ok || !chartsRes.ok) {
    return (
      <div className="page wide">
        <div className="banner banner-danger">No se pudieron cargar los KPIs.</div>
      </div>
    );
  }
  const kpis = (await kpisRes.json()) as KpisOutput;
  const charts = (await chartsRes.json()) as DashboardChartsOutput;

  return (
    <div className="page wide">
      <AutoRefresh intervalMs={5 * 60_000} />
      <PageHeader
        title="Dashboard"
        subtitle="Estado operativo de la plaza."
        actions={
          <span className="badge b-neutral">
            <RefreshCw className="h-3 w-3" />
            Auto-refresh 5 min
          </span>
        }
      />
      <DashboardContenido kpis={kpis} charts={charts} detalleHref="/admin/solicitudes" />
    </div>
  );
}
