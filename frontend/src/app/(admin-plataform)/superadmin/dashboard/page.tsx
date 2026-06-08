import type { Metadata } from 'next';
import type { DashboardChartsOutput, KpisOutput } from '@app/contracts';
import { RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { AutoRefresh } from '@/components/client/auto-refresh';
import { DashboardContenido } from '@/components/dashboard-kpis';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Dashboard global' };

/**
 * T-143: dashboard GLOBAL del superadmin — métricas agregadas de todas las
 * plazas (el backend usa el admin client, bypass RLS documentado en T-038).
 * Sin links de detalle: las solicitudes viven en el panel de cada plaza.
 */
export default async function SuperadminDashboardPage() {
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
        title="Dashboard global"
        subtitle="Métricas agregadas de todas las plazas."
        actions={
          <span className="badge b-neutral">
            <RefreshCw className="h-3 w-3" />
            Auto-refresh 5 min
          </span>
        }
      />
      <DashboardContenido kpis={kpis} charts={charts} detalleHref={null} />
    </div>
  );
}
