/**
 * Builder del contexto de email para solicitudes (T-127-bis).
 *
 * Transforma una `SolicitudConRelaciones` (recuperada con `SOLICITUD_INCLUDE`)
 * en un objeto plano listo para `sendEmail({ variables: ... })` → Handlebars.
 *
 * Decisiones:
 *  - **Sin queries**: pura transformación. Toda la info viaja en la `solicitud`.
 *  - **Sin DI**: utility estático, como `RESULTADO_CIERRE_LABEL`. Quien quiera
 *    DI lo envuelve en un `@Injectable()` en su módulo.
 *  - **Descripción saneada y truncada**: la descripción puede llegar con HTML
 *    del editor (sanitizado en backend) y medir hasta 4000 chars. En email va
 *    CON formato (HTML saneado) y truncada a 600 chars con elipsis.
 *  - **`camposExtra` formateado**: por tipo (`mantenimiento`/`evento`/
///    `remodelacion`/`otro`) → lista `{etiqueta, valor}[]` para `{{#each}}`.
 *  - **Ids y códigos se mantienen tal cual**: el estado y la prioridad pasan
 *    como su enum canónico (`'A'`, `'en_revision'`) además de la etiqueta
 *    legible (`'Alta'`, `'En revisión'`).
 */

import type { SolicitudTipo, SolicitudEstado } from '@app/contracts';
import { sanitizeHtml } from '../../common/sanitizers/html-sanitizer';
import {
  SOLICITUD_TIPO_LABEL,
  SOLICITUD_ESTADO_LABEL,
  SOLICITUD_PRIORIDAD_LABEL,
  SOLICITUD_PRIORIDAD_COLOR,
} from '../solicitudes/labels';
import type { SolicitudConRelaciones } from '../solicitudes/solicitud.mapper';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

/** Etiqueta-valor para la tabla de `campos_extra` en el email. */
export interface CampoExtraItem {
  etiqueta: string;
  valor: string;
}

/** Bloque de `campos_extra` formateado por tipo, listo para templates. */
export interface CamposExtraFormateados {
  /** Etiqueta humana del tipo (ej. "Remodelación"). */
  tipoLabel: string;
  /** Filas etiqueta→valor para la tabla del email. */
  items: CampoExtraItem[];
}

/**
 * Objeto plano que se pasa a las plantillas como `variables`. Mantener
 * PRIMITIVOS (string|number|boolean|null) y objetos anidados shallow:
 * Handlebars no soporta funciones, Dates ni Maps.
 */
export interface SolicitudEmailContext {
  // Identidad
  solicitudCodigo: string;
  solicitudTitulo: string;
  tipo: SolicitudTipo;
  tipoLabel: string;
  prioridad: 'A' | 'B' | 'C' | 'D' | 'F';
  prioridadLabel: string;
  prioridadColor: string;

  // Relaciones (pueden ser null si la solicitud es huérfana)
  categoriaNombre: string | null;
  subcategoriaNombre: string | null;
  localCodigo: string | null;
  localModulo: string | null;
  localLabel: string | null; // "L-001 — Módulo A" o null
  inquilinoRazonSocial: string | null;

  // Personas
  usuarioCreadorNombre: string | null;
  usuarioCreadorEmail: string | null;
  adminAsignadoNombre: string | null;
  adminAsignadoEmail: string | null;

  // Estado
  estado: SolicitudEstado;
  estadoLabel: string;

  // Descripción (HTML saneado, truncado a 600 chars)
  descripcion: string;
  descripcionCompleta: boolean;
  descripcionResto: string | null; // lo que sobra tras el corte (tras `…`)

  // Rango del evento
  fechaEventoInicio: string | null; // YYYY-MM-DD
  fechaEventoFin: string | null;
  horaInicio: string | null; // HH:MM
  horaFin: string | null;
  rangoEvento: string | null; // "2026-08-15 14:00 → 2026-08-15 18:00 (UTC-6)"

  // Empresa ejecutante
  empresaNombre: string | null;
  empresaResponsable: string | null;
  empresaTelefono: string | null;
  empresaEmail: string | null;

  // Emergencia
  esEmergencia: boolean;
  emergenciaContacto: string | null;
  emergenciaTelefono: string | null;

  // Dinámico por tipo
  camposExtra: CamposExtraFormateados | null;

  // Tiempos (ISO 8601)
  creadaAt: string;
  enviadaAt: string | null;
  asignadaAt: string | null;
  decisionAt: string | null;
  cerradaAt: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

/** Límite duro de la descripción en el email (T-127-bis). */
const DESCRIPCION_MAX_CHARS = 600;

/** TZ fija de El Salvador (UTC-6, sin DST). El proyecto usa esta TZ en todos
 *  los formateos de fecha (ver `solicitud-state.service.ts::combinar`). */
const TZ_SV = 'UTC-6';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de formateo
// ─────────────────────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' (UTC, sin shift). Mismo criterio que `solicitud.mapper::toIsoDate`. */
function toIsoDateOnly(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Date → ISO 8601 completo. */
function toIsoFull(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/**
 * Trunca `s` a `max` chars sin cortar a mitad de palabra cuando es posible.
 * Si cortó, agrega '…' y deja el resto en un campo aparte.
 */
function truncate(s: string, max: number): { visible: string; resto: string | null } {
  if (s.length <= max) return { visible: s, resto: null };
  // Cortamos en el último espacio antes de `max - 1` para no romper palabras.
  const corte = s.slice(0, max - 1);
  const ultimoEspacio = corte.lastIndexOf(' ');
  const visible = (ultimoEspacio > max * 0.6 ? corte.slice(0, ultimoEspacio) : corte).trimEnd() + '…';
  return { visible, resto: s.slice(visible.length - 1).trimStart() };
}

/**
 * Formatea un `campos_extra` JSONB a una lista etiqueta→valor legible, leyendo
 * solo las claves conocidas por tipo (`packages/contracts/src/solicitudes`).
 * - `mantenimiento`: area_afectada, requiere_ingreso_a_local, asistentes.
 * - `evento`: asistentes_estimados, asistentes.
 * - `remodelacion`: fecha_inicio_estimada, duracion_dias, empresa_constructora,
 *   monto_presupuesto, asistentes.
 * - `otro`: solo asistentes.
 *
 * Claves desconocidas se IGNORAN (no se fitean). Devuelve `null` si tras el
 * filtro no queda nada para mostrar.
 */
export function formatCamposExtraPorTipo(
  tipo: SolicitudTipo,
  raw: Record<string, unknown> | null | undefined,
): CamposExtraFormateados | null {
  if (!raw || typeof raw !== 'object') return null;
  const items: CampoExtraItem[] = [];

  const val = (k: string): unknown => raw[k];

  // Mantenimiento
  if (tipo === 'mantenimiento') {
    const area = val('area_afectada');
    if (typeof area === 'string' && area.trim()) {
      items.push({ etiqueta: 'Área afectada', valor: area.trim() });
    }
    const req = val('requiere_ingreso_a_local');
    if (typeof req === 'boolean') {
      items.push({
        etiqueta: 'Requiere ingreso al local',
        valor: req ? 'Sí' : 'No',
      });
    }
  }

  // Remodelación
  if (tipo === 'remodelacion') {
    const fecha = val('fecha_inicio_estimada');
    if (typeof fecha === 'string' && fecha.trim()) {
      items.push({ etiqueta: 'Inicio estimado', valor: fecha.trim() });
    }
    const dias = val('duracion_dias');
    if (typeof dias === 'number' && dias > 0) {
      items.push({ etiqueta: 'Duración estimada', valor: `${dias} día${dias === 1 ? '' : 's'}` });
    }
    const constructora = val('empresa_constructora');
    if (typeof constructora === 'string' && constructora.trim()) {
      items.push({ etiqueta: 'Empresa constructora', valor: constructora.trim() });
    }
    const monto = val('monto_presupuesto');
    if (typeof monto === 'number' && monto > 0) {
      items.push({
        etiqueta: 'Presupuesto',
        valor: new Intl.NumberFormat('es-SV', {
          style: 'currency',
          currency: 'USD',
        }).format(monto),
      });
    }
  }

  // Asistentes (transversal a los 4 tipos)
  const est = val('asistentes_estimados');
  const lista = val('asistentes');
  if (typeof est === 'number') {
    if (Array.isArray(lista) && lista.length > 0) {
      items.push({
        etiqueta: 'Asistentes',
        valor: `${est} estimado${est === 1 ? '' : 's'} (${lista.length} registrado${lista.length === 1 ? '' : 's'})`,
      });
    } else {
      items.push({
        etiqueta: 'Asistentes estimados',
        valor: `${est}`,
      });
    }
  } else if (Array.isArray(lista) && lista.length > 0) {
    items.push({ etiqueta: 'Asistentes', valor: `${lista.length} registrado${lista.length === 1 ? '' : 's'}` });
  }

  if (items.length === 0) return null;
  return { tipoLabel: SOLICITUD_TIPO_LABEL[tipo], items };
}

/**
 * "2026-08-15 14:00 → 2026-08-15 18:00 (UTC-6)" o variantes según lo que esté.
 */
function formatearRangoEvento(
  fechaInicio: string | null,
  fechaFin: string | null,
  horaInicio: string | null,
  horaFin: string | null,
): string | null {
  if (!fechaInicio && !fechaFin) return null;
  const ini = fechaInicio ?? '?';
  const fin = fechaFin ?? ini;
  const partes: string[] = [ini];
  if (horaInicio) partes.push(horaInicio);
  if (fechaFin && fechaFin !== fechaInicio) {
    partes.push('→');
    partes.push(fin);
    if (horaFin) partes.push(horaFin);
  } else if (horaFin && horaFin !== horaInicio) {
    partes.push('→');
    partes.push(horaFin);
  }
  partes.push(`(${TZ_SV})`);
  return partes.join(' ');
}

/** Construye el label compuesto del local: "L-001 — Módulo A" o solo código. */
function formatearLocalLabel(
  local: { codigo: string; modulo: string | null } | null | undefined,
): string | null {
  if (!local) return null;
  const codigo = local.codigo?.trim();
  const modulo = local.modulo?.trim();
  if (codigo && modulo && codigo !== modulo) return `${codigo} — Módulo ${modulo}`;
  return codigo || (modulo ? `Módulo ${modulo}` : null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Función pública
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Traduce una `solicitud` con relaciones a un `SolicitudEmailContext` listo
 * para `EmailService.sendEmail({ variables })`. Construye también el HTML
 * pre-renderizado del bloque "Detalles de la solicitud" (`detallesHtml`),
 * que se inyecta en los templates con `{{{detallesHtml}}}` (triple mustache).
 *
 * NO hace queries. NO instancia nada. Pura.
 *
 * @param solicitud  Solicitud hidratada con `SOLICITUD_INCLUDE`
 *                   (local, inquilino, categoria, subcategoria, usuario_creador,
 *                   admin_asignado).
 */
export function buildSolicitudEmailContext(solicitud: SolicitudConRelaciones): SolicitudEmailContext {
  // Descripción: viene ya saneada del backend (sanitizeHtml en create/update).
  // Re-pasamos sanitizeHtml por defensa (es idempotente) y truncamos.
  const descripcionRaw = sanitizeHtml(solicitud.descripcion ?? '');
  const { visible, resto } = truncate(descripcionRaw, DESCRIPCION_MAX_CHARS);

  const fechaIni = toIsoDateOnly(solicitud.fecha_evento_inicio);
  const fechaFin = toIsoDateOnly(solicitud.fecha_evento_fin);

  // campos_extra viene como JSONB (Prisma `Json`). Prisma lo tipa como
  // `Prisma.JsonValue`; en runtime es un objeto plano. Cast explícito.
  const camposExtraRaw = (solicitud.campos_extra ?? null) as Record<string, unknown> | null;

  const camposExtra = formatCamposExtraPorTipo(solicitud.tipo, camposExtraRaw);

  const ctx: Omit<SolicitudEmailContext, 'detallesHtml'> = {
    solicitudCodigo: solicitud.codigo,
    solicitudTitulo: solicitud.titulo,
    tipo: solicitud.tipo,
    tipoLabel: SOLICITUD_TIPO_LABEL[solicitud.tipo],
    prioridad: solicitud.prioridad,
    prioridadLabel: SOLICITUD_PRIORIDAD_LABEL[solicitud.prioridad],
    prioridadColor: SOLICITUD_PRIORIDAD_COLOR[solicitud.prioridad],

    categoriaNombre: solicitud.categoria?.nombre ?? null,
    subcategoriaNombre: solicitud.subcategoria?.nombre ?? null,
    localCodigo: solicitud.local?.codigo ?? null,
    localModulo: solicitud.local?.modulo ?? null,
    localLabel: formatearLocalLabel(solicitud.local),
    inquilinoRazonSocial: solicitud.inquilino?.razon_social ?? null,

    usuarioCreadorNombre: solicitud.usuario_creador?.nombre ?? null,
    usuarioCreadorEmail: solicitud.usuario_creador?.email ?? null,
    adminAsignadoNombre: solicitud.admin_asignado?.nombre ?? null,
    adminAsignadoEmail: solicitud.admin_asignado?.email ?? null,

    estado: solicitud.estado,
    estadoLabel: SOLICITUD_ESTADO_LABEL[solicitud.estado],

    descripcion: visible,
    descripcionCompleta: resto !== null,
    descripcionResto: resto,

    fechaEventoInicio: fechaIni,
    fechaEventoFin: fechaFin,
    horaInicio: solicitud.hora_inicio ?? null,
    horaFin: solicitud.hora_fin ?? null,
    rangoEvento: formatearRangoEvento(fechaIni, fechaFin, solicitud.hora_inicio, solicitud.hora_fin),

    empresaNombre: solicitud.empresa_nombre?.trim() || null,
    empresaResponsable: solicitud.empresa_responsable?.trim() || null,
    empresaTelefono: solicitud.empresa_telefono?.trim() || null,
    empresaEmail: solicitud.empresa_email?.trim() || null,

    esEmergencia: solicitud.es_emergencia,
    emergenciaContacto: solicitud.emergencia_contacto?.trim() || null,
    emergenciaTelefono: solicitud.emergencia_telefono?.trim() || null,

    camposExtra,

    creadaAt: toIsoFull(solicitud.created_at) ?? '',
    enviadaAt: toIsoFull(solicitud.enviada_at),
    asignadaAt: toIsoFull(solicitud.asignada_at),
    decisionAt: toIsoFull(solicitud.decision_at),
    cerradaAt: toIsoFull(solicitud.cerrada_at),
  };

  return { ...ctx };
}
