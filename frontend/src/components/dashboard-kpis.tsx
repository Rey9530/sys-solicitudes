import Link from 'next/link';
import { CalendarCheck, CheckCircle2, FileClock, Inbox, XCircle } from 'lucide-react';
import type { DashboardChartsOutput, KpisOutput } from '@app/contracts';
import { DashboardCharts } from '@/components/client/dashboard-charts';
import { Card, CardBody, CardHead } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';

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
  const tasaPct = kpis.tasaAprobacion !== null ? Math.round(kpis.tasaAprobacion * 100) : null;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="kpi-grid">
        <KpiCard label="Pendientes" value={kpis.pendientes} icon={Inbox} tint="warn" />
        <KpiCard label="Aprobadas hoy" value={kpis.aprobadasHoy} icon={CheckCircle2} tint="ok" />
        <KpiCard label="Rechazadas hoy" value={kpis.rechazadasHoy} icon={XCircle} tint="danger" />
        <KpiCard
          label="Eventos próximos (7d)"
          value={kpis.eventosProximos7d}
          icon={CalendarCheck}
          tint="info"
        />
        <KpiCard
          label="Contratos por vencer (30d)"
          value={kpis.contratosPorVencer30d}
          icon={FileClock}
          tint="violet"
        />
      </div>

      <div className="kpi-grid c3">
        <Card pad>
          <p className="kpi-label">Tasa de aprobación</p>
          <p className="kpi-val" style={{ fontSize: 26, marginTop: 8 }}>
            {tasaPct !== null ? `${tasaPct}%` : '—'}
          </p>
          {tasaPct !== null && (
            <div
              style={{
                marginTop: 12,
                height: 7,
                borderRadius: 999,
                background: 'var(--surface-3)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${tasaPct}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: 'var(--ok-fg)',
                }}
              />
            </div>
          )}
        </Card>
        <Card pad>
          <p className="kpi-label">Tiempo medio de respuesta</p>
          <p className="kpi-val" style={{ fontSize: 26, marginTop: 8 }}>
            {kpis.tiempoMedioRespuestaHoras !== null ? `${kpis.tiempoMedioRespuestaHoras} h` : '—'}
          </p>
        </Card>
        <Card pad>
          <p className="kpi-label">Solicitudes con subsanación</p>
          <p className="kpi-val" style={{ fontSize: 26, marginTop: 8 }}>
            {kpis.solicitudesConSubsanacion}
          </p>
        </Card>
      </div>

      <DashboardCharts data={charts} />

      <div className="grid-two">
        <Card>
          <CardHead>
            <h3>Top 5 por antigüedad</h3>
          </CardHead>
          <CardBody style={{ paddingTop: 4, paddingBottom: 4 }}>
            {kpis.top5Antiguedad.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, padding: '8px 0' }}>
                Sin solicitudes pendientes.
              </p>
            ) : (
              kpis.top5Antiguedad.map((s) => (
                <div className="list-row" key={s.id}>
                  <div className="flex-1 min-w-0">
                    {detalleHref ? (
                      <Link href={`${detalleHref}/${s.id}`} className="cellcode">
                        {s.codigo}
                      </Link>
                    ) : (
                      <span className="cellcode">{s.codigo}</span>
                    )}{' '}
                    <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{s.titulo}</span>
                  </div>
                  <span className="tl-time">{s.enviadaAt.slice(0, 10)}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead>
            <h3>Actividad reciente</h3>
          </CardHead>
          <CardBody style={{ paddingTop: 4, paddingBottom: 4 }}>
            {charts.actividadReciente.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, padding: '8px 0' }}>
                Sin actividad registrada.
              </p>
            ) : (
              charts.actividadReciente.map((a) => (
                <div className="list-row" key={a.id}>
                  <div className="flex-1 min-w-0" style={{ fontSize: 13 }}>
                    <span className="cellcode">{a.solicitudCodigo}</span>{' '}
                    <span style={{ color: 'var(--text-2)' }}>{a.evento.replace(/_/g, ' ')}</span>
                    {a.usuario && <span className="muted"> · {a.usuario}</span>}
                  </div>
                  <span className="tl-time">{a.createdAt.slice(0, 16).replace('T', ' ')}</span>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
