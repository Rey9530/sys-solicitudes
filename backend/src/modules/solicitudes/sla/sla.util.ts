import type { SlaStatus, SolicitudPrioridad, SolicitudTipo } from '@app/contracts';

interface SolicitudSla {
  tipo: SolicitudTipo;
  prioridad: SolicitudPrioridad;
  estado: string;
  enviada_at: Date | null;
}

interface ConfiguracionSla {
  sla_dias_por_tipo: unknown;
  sla_multiplicador_por_prioridad: unknown;
}

const TERMINALES = ['aprobada', 'rechazada', 'cancelada'];

/**
 * Semáforo SLA (T-100, S-SLA / S-SLA-Prioridad, revisado T-V03):
 *   sla_dias = sla_dias_por_tipo[tipo] * sla_multiplicador_por_prioridad[prioridad]
 *   porcentaje = días desde `enviada_at` / sla_dias   ← el timer corre desde el ENVÍO
 *   < 0.5 verde · 0.5–1.0 amarillo · >= 1.0 rojo · terminal o sin enviar → null
 */
export function calcularSlaStatus(
  solicitud: SolicitudSla,
  configuracion: ConfiguracionSla | null,
  ahora: Date = new Date(),
): SlaStatus {
  if (TERMINALES.includes(solicitud.estado) || !solicitud.enviada_at) return null;

  const dias = (configuracion?.sla_dias_por_tipo ?? {}) as Record<string, number>;
  const mult = (configuracion?.sla_multiplicador_por_prioridad ?? {}) as Record<string, number>;
  const slaDias = Number(dias[solicitud.tipo] ?? 0) * Number(mult[solicitud.prioridad] ?? 1);
  if (!slaDias || slaDias <= 0) return null;

  const transcurridoDias = (ahora.getTime() - solicitud.enviada_at.getTime()) / 86_400_000;
  const porcentaje = transcurridoDias / slaDias;
  if (porcentaje < 0.5) return 'verde';
  if (porcentaje < 1.0) return 'amarillo';
  return 'rojo';
}
