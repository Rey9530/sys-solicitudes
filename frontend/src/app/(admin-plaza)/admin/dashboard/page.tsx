import type { Metadata } from 'next';
import type { DashboardChartsOutput, KpisOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { AutoRefresh } from '@/components/client/auto-refresh';
import { DashboardContenido } from '@/components/dashboard-kpis';

export const metadata: Metadata = { title: 'Dashboard' };

/** T-143: dashboard del admin de plaza (refresco cada 5 min). */
export default async function AdminDashboardPage() {
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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Estado operativo de la plaza.</p>
      </div>
      <DashboardContenido kpis={kpis} charts={charts} detalleHref="/admin/solicitudes" />
    </div>
  );
}
