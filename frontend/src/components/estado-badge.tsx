import type {
  LocalEstado,
  ContratoEstado,
  SolicitudEstado,
  SolicitudPrioridad,
  SlaStatus,
} from '@app/contracts';

/**
 * Badges de estado (módulos 04 y 06). Presentacional puro. Usa el set unificado
 * del sistema de diseño (handoff): pill `.badge .b-*` con punto, chip `.prio` y
 * semáforo `.sla`. Es la pieza central del lenguaje visual de estados.
 */

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`badge ${tone}`}>
      <span className="bdot" />
      {children}
    </span>
  );
}

const LOCAL_ESTADO_TONE: Record<LocalEstado, string> = {
  disponible: 'b-ok',
  alquilado: 'b-info',
  en_mantenimiento: 'b-warn',
  fuera_de_servicio: 'b-neutral',
};

const LOCAL_ESTADO_LABEL: Record<LocalEstado, string> = {
  disponible: 'Disponible',
  alquilado: 'Alquilado',
  en_mantenimiento: 'En mantenimiento',
  fuera_de_servicio: 'Fuera de servicio',
};

const CONTRATO_ESTADO_TONE: Record<ContratoEstado, string> = {
  vigente: 'b-ok',
  finalizado: 'b-neutral',
  cancelado: 'b-danger',
};

const CONTRATO_ESTADO_LABEL: Record<ContratoEstado, string> = {
  vigente: 'Vigente',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export function LocalEstadoBadge({ estado }: { estado: LocalEstado }) {
  return <Badge tone={LOCAL_ESTADO_TONE[estado]}>{LOCAL_ESTADO_LABEL[estado]}</Badge>;
}

export function ContratoEstadoBadge({ estado }: { estado: ContratoEstado }) {
  return <Badge tone={CONTRATO_ESTADO_TONE[estado]}>{CONTRATO_ESTADO_LABEL[estado]}</Badge>;
}

// ── Solicitudes (módulo 06, flujo T-V03) ──────────────────────────────────────

const SOLICITUD_ESTADO_TONE: Record<SolicitudEstado, string> = {
  borrador: 'b-neutral',
  enviada: 'b-info',
  asignado: 'b-indigo',
  en_revision: 'b-warn',
  requerida_subsanacion: 'b-orange',
  pausada: 'b-cyan', // T-091d-pausar: estado congelado, distintivo de los demás.
  aprobada: 'b-ok',
  rechazada: 'b-danger',
  cancelada: 'b-neutral',
};

export const SOLICITUD_ESTADO_LABEL: Record<SolicitudEstado, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  asignado: 'Asignada',
  en_revision: 'En revisión',
  requerida_subsanacion: 'Requiere subsanación',
  pausada: 'Pausada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

export function SolicitudEstadoBadge({ estado }: { estado: SolicitudEstado }) {
  return <Badge tone={SOLICITUD_ESTADO_TONE[estado]}>{SOLICITUD_ESTADO_LABEL[estado]}</Badge>;
}

/** Chip de prioridad cuadrado (A–F). */
export function PrioridadBadge({ prioridad }: { prioridad: SolicitudPrioridad }) {
  return <span className={`prio prio-${prioridad}`}>{prioridad}</span>;
}

/** Semáforo SLA (S-SLA): punto de color con halo; null = no aplica. */
export function SlaSemaforo({ status }: { status: SlaStatus }) {
  if (!status) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const tone = status === 'verde' ? 'sla-green' : status === 'amarillo' ? 'sla-amber' : 'sla-red';
  return (
    <span className={`sla ${tone}`}>
      <span className="slap" />
      <span className="capitalize">{status}</span>
    </span>
  );
}
