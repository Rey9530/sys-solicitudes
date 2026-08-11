'use client';

import type { DashboardChartsOutput } from '@app/contracts';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const ESTADO_COLORES: Record<string, string> = {
  borrador: '#9ca3af',
  enviada: '#3b82f6',
  asignado: '#06b6d4',
  en_revision: '#f59e0b',
  requerida_subsanacion: '#f97316',
  // T-091d-pausar: cian claro, distinguible del resto de activos.
  pausada: '#22d3ee',
  aprobada: '#10b981',
  // T-091e-cerrar: violeta, distinto del verde de aprobada (terminal positivo).
  cerrada: '#8b5cf6',
  rechazada: '#ef4444',
  cancelada: '#6b7280',
};
const PRIORIDAD_COLORES: Record<string, string> = {
  A: '#e0463a',
  B: '#e8852c',
  C: '#d6a811',
  D: '#3f9e5a',
  F: '#7a8499',
};

// Chrome de los gráficos vía tokens (reacciona a claro/oscuro).
const AXIS_TICK = { fill: 'var(--text-3)', fontSize: 12 };
const GRID_STROKE = 'var(--border)';
const TOOLTIP_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text)',
  boxShadow: 'var(--shadow-md)',
};

/** T-143: gráficos del dashboard con recharts 3.8 (Client Component). */
export function DashboardCharts({ data }: { data: DashboardChartsOutput }) {
  const estados = [
    ...new Set(data.tendenciaMensual.flatMap((m) => Object.keys(m).filter((k) => k !== 'mes'))),
  ];

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card">
        <div className="card-head">
          <h3>Tendencia mensual por estado (últimos 6 meses)</h3>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.tendenciaMensual}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="mes" tick={AXIS_TICK} stroke={GRID_STROKE} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} stroke={GRID_STROKE} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {estados.map((estado) => (
                <Line
                  key={estado}
                  type="monotone"
                  dataKey={estado}
                  stroke={ESTADO_COLORES[estado] ?? '#6b7280'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-two">
        <div className="card">
          <div className="card-head">
            <h3>Solicitudes por tipo</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.porTipo}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="tipo" tick={AXIS_TICK} stroke={GRID_STROKE} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} stroke={GRID_STROKE} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--surface-3)' }} />
                <Bar dataKey="total" fill="var(--primary)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Distribución por prioridad</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.porPrioridad}
                  dataKey="total"
                  nameKey="prioridad"
                  cx="50%"
                  cy="50%"
                  innerRadius="40%"
                  outerRadius="70%"
                  label={(entry) => `${String(entry.name)}: ${String(entry.value)}`}
                >
                  {data.porPrioridad.map((p) => (
                    <Cell key={p.prioridad} fill={PRIORIDAD_COLORES[p.prioridad] ?? '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
