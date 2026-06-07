import type {
  LocalEstado,
  ContratoEstado,
  SolicitudEstado,
  SolicitudPrioridad,
  SlaStatus,
} from '@app/contracts';

/** Badges de estado (módulos 04 y 06). Presentacional puro. */

const LOCAL_ESTADO_STYLE: Record<LocalEstado, string> = {
  disponible: 'bg-green-50 text-green-700 ring-green-600/20',
  alquilado: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  en_mantenimiento: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  fuera_de_servicio: 'bg-gray-100 text-gray-600 ring-gray-500/20',
};

const LOCAL_ESTADO_LABEL: Record<LocalEstado, string> = {
  disponible: 'Disponible',
  alquilado: 'Alquilado',
  en_mantenimiento: 'En mantenimiento',
  fuera_de_servicio: 'Fuera de servicio',
};

const CONTRATO_ESTADO_STYLE: Record<ContratoEstado, string> = {
  vigente: 'bg-green-50 text-green-700 ring-green-600/20',
  finalizado: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  cancelado: 'bg-red-50 text-red-700 ring-red-600/20',
};

const CONTRATO_ESTADO_LABEL: Record<ContratoEstado, string> = {
  vigente: 'Vigente',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

export function LocalEstadoBadge({ estado }: { estado: LocalEstado }) {
  return <Badge className={LOCAL_ESTADO_STYLE[estado]}>{LOCAL_ESTADO_LABEL[estado]}</Badge>;
}

export function ContratoEstadoBadge({ estado }: { estado: ContratoEstado }) {
  return <Badge className={CONTRATO_ESTADO_STYLE[estado]}>{CONTRATO_ESTADO_LABEL[estado]}</Badge>;
}

// ── Solicitudes (módulo 06, flujo T-V03) ──────────────────────────────────────

const SOLICITUD_ESTADO_STYLE: Record<SolicitudEstado, string> = {
  borrador: 'bg-gray-100 text-gray-600 ring-gray-500/20',
  enviada: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  asignado: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  en_revision: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  requerida_subsanacion: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  aprobada: 'bg-green-50 text-green-700 ring-green-600/20',
  rechazada: 'bg-red-50 text-red-700 ring-red-600/20',
  cancelada: 'bg-gray-100 text-gray-500 ring-gray-400/20',
};

export const SOLICITUD_ESTADO_LABEL: Record<SolicitudEstado, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  asignado: 'Asignada',
  en_revision: 'En revisión',
  requerida_subsanacion: 'Requiere subsanación',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

export function SolicitudEstadoBadge({ estado }: { estado: SolicitudEstado }) {
  return (
    <Badge className={SOLICITUD_ESTADO_STYLE[estado]}>{SOLICITUD_ESTADO_LABEL[estado]}</Badge>
  );
}

const PRIORIDAD_STYLE: Record<SolicitudPrioridad, string> = {
  A: 'bg-red-50 text-red-700 ring-red-600/20',
  B: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  C: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  D: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  F: 'bg-gray-100 text-gray-600 ring-gray-500/20',
};

export function PrioridadBadge({ prioridad }: { prioridad: SolicitudPrioridad }) {
  return <Badge className={PRIORIDAD_STYLE[prioridad]}>{prioridad}</Badge>;
}

/** Semáforo SLA (S-SLA): punto de color; null = no aplica. */
export function SlaSemaforo({ status }: { status: SlaStatus }) {
  if (!status) return <span className="text-gray-300">—</span>;
  const color =
    status === 'verde' ? 'bg-green-500' : status === 'amarillo' ? 'bg-amber-400' : 'bg-red-500';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-xs capitalize text-gray-500">{status}</span>
    </span>
  );
}
