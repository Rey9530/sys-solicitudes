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
  aprobada: '#10b981',
  rechazada: '#ef4444',
  cancelada: '#6b7280',
};
const PRIORIDAD_COLORES: Record<string, string> = {
  A: '#ef4444',
  B: '#f59e0b',
  C: '#3b82f6',
  D: '#10b981',
  F: '#6b7280',
};

/** T-143: gráficos del dashboard con recharts 3.8 (Client Component). */
export function DashboardCharts({ data }: { data: DashboardChartsOutput }) {
  const estados = [
    ...new Set(data.tendenciaMensual.flatMap((m) => Object.keys(m).filter((k) => k !== 'mes'))),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border bg-white p-4 lg:col-span-2">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">
          Tendencia mensual por estado (últimos 6 meses)
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.tendenciaMensual}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="mes" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Legend />
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

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Solicitudes por tipo</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.porTipo}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="tipo" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Distribución por prioridad</h3>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data.porPrioridad}
              dataKey="total"
              nameKey="prioridad"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={(entry) => `${String(entry.name)}: ${String(entry.value)}`}
            >
              {data.porPrioridad.map((p) => (
                <Cell key={p.prioridad} fill={PRIORIDAD_COLORES[p.prioridad] ?? '#6b7280'} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
