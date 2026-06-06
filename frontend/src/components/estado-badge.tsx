import type { LocalEstado, ContratoEstado } from '@app/contracts';

/** Badges de estado de local y contrato (módulo 04). Presentacional puro. */

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
