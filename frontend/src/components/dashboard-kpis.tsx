import Link from 'next/link';
import type { DashboardChartsOutput, KpisOutput } from '@app/contracts';
import { DashboardCharts } from '@/components/client/dashboard-charts';

/**
 * T-143: contenido compartido del dashboard (Server Component) — lo usan
 * /admin/dashboard (plaza) y /superadmin/dashboard (global).
 */
export function DashboardContenido({
  kpis,
  charts,
  detalleHref,
}: {
  kpis: KpisOutput;
  charts: DashboardChartsOutput;
  detalleHref: string | null;
}) {
  const cards = [
    { label: 'Pendientes', valor: kpis.pendientes, color: 'text-amber-600' },
    { label: 'Aprobadas hoy', valor: kpis.aprobadasHoy, color: 'text-green-600' },
    { label: 'Rechazadas hoy', valor: kpis.rechazadasHoy, color: 'text-red-600' },
    { label: 'Eventos próximos (7d)', valor: kpis.eventosProximos7d, color: 'text-blue-600' },
    {
      label: 'Contratos por vencer (30d)',
      valor: kpis.contratosPorVencer30d,
      color: 'text-violet-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-white p-4">
            <p className={`text-3xl font-bold ${c.color}`}>{c.valor}</p>
            <p className="text-xs text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-2xl font-semibold">
            {kpis.tasaAprobacion !== null ? `${Math.round(kpis.tasaAprobacion * 100)}%` : '—'}
          </p>
          <p className="text-xs text-gray-500">Tasa de aprobación</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-2xl font-semibold">
            {kpis.tiempoMedioRespuestaHoras !== null ? `${kpis.tiempoMedioRespuestaHoras} h` : '—'}
          </p>
          <p className="text-xs text-gray-500">Tiempo medio de respuesta</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-2xl font-semibold">{kpis.solicitudesConSubsanacion}</p>
          <p className="text-xs text-gray-500">Solicitudes con subsanación</p>
        </div>
      </div>

      <DashboardCharts data={charts} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Top 5 por antigüedad</h3>
          {kpis.top5Antiguedad.length === 0 ? (
            <p className="text-sm text-gray-500">Sin solicitudes pendientes.</p>
          ) : (
            <ul className="divide-y text-sm">
              {kpis.top5Antiguedad.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <span>
                    {detalleHref ? (
                      <Link href={`${detalleHref}/${s.id}`} className="text-primary hover:underline">
                        {s.codigo}
                      </Link>
                    ) : (
                      <span className="font-medium">{s.codigo}</span>
                    )}{' '}
                    <span className="text-gray-600">{s.titulo}</span>
                  </span>
                  <span className="text-xs text-gray-400">{s.enviadaAt.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Actividad reciente</h3>
          {charts.actividadReciente.length === 0 ? (
            <p className="text-sm text-gray-500">Sin actividad registrada.</p>
          ) : (
            <ul className="divide-y text-sm">
              {charts.actividadReciente.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <span>
                    <span className="font-medium">{a.solicitudCodigo}</span>{' '}
                    <span className="text-gray-600">{a.evento.replace(/_/g, ' ')}</span>
                    {a.usuario && <span className="text-gray-400"> · {a.usuario}</span>}
                  </span>
                  <span className="text-xs text-gray-400">
                    {a.createdAt.slice(0, 16).replace('T', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
