import type { Metadata } from 'next';
import type { DashboardChartsOutput, KpisOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { AutoRefresh } from '@/components/client/auto-refresh';
import { DashboardContenido } from '@/components/dashboard-kpis';

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
    return <p className="text-sm text-red-600">No se pudieron cargar los KPIs.</p>;
  }
  const kpis = (await kpisRes.json()) as KpisOutput;
  const charts = (await chartsRes.json()) as DashboardChartsOutput;

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={5 * 60_000} />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard global</h1>
        <p className="text-sm text-gray-500">Métricas agregadas de todas las plazas.</p>
      </div>
      <DashboardContenido kpis={kpis} charts={charts} detalleHref={null} />
    </div>
  );
}
