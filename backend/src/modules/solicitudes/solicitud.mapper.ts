import type {
  solicitud as SolicitudModel,
  solicitud_historial as HistorialModel,
  comentario as ComentarioModel,
} from '@prisma/client';
import type {
  SolicitudOutput,
  SolicitudListItem,
  SolicitudHistorialOutput,
  ComentarioOutput,
  UsuarioRef,
  SlaStatus,
} from '@app/contracts';

interface UsuarioRefRow {
  id: string;
  nombre: string;
  email: string;
}

export type SolicitudConRelaciones = SolicitudModel & {
  local?: { codigo: string } | null;
  inquilino?: { razon_social: string } | null;
  categoria?: { nombre: string } | null;
  subcategoria?: { nombre: string } | null;
  usuario_creador?: UsuarioRefRow | null;
  admin_asignado?: UsuarioRefRow | null;
};

export type HistorialConUsuario = HistorialModel & { usuario?: UsuarioRefRow | null };
export type ComentarioConUsuario = ComentarioModel & { usuario?: UsuarioRefRow | null };

/** Include estándar de relaciones para listado/detalle. */
export const SOLICITUD_INCLUDE = {
  local: { select: { codigo: true } },
  inquilino: { select: { razon_social: true } },
  categoria: { select: { nombre: true } },
  subcategoria: { select: { nombre: true } },
  usuario_creador: { select: { id: true, nombre: true, email: true } },
  admin_asignado: { select: { id: true, nombre: true, email: true } },
} as const;

function toRef(u: UsuarioRefRow | null | undefined): UsuarioRef | null {
  return u ? { id: u.id, nombre: u.nombre, email: u.email } : null;
}

/** DATE de PG → 'YYYY-MM-DD' (sin TZ shift: el Date llega en UTC midnight). */
export function toIsoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

export function solicitudToOutput(s: SolicitudModel): SolicitudOutput {
  return {
    id: s.id,
    plazaId: s.plaza_id,
    localId: s.local_id,
    inquilinoId: s.inquilino_id,
    usuarioCreadorId: s.usuario_creador_id,
    adminAsignadoId: s.admin_asignado_id,
    categoriaId: s.categoria_id,
    subcategoriaId: s.subcategoria_id,
    codigo: s.codigo,
    tipo: s.tipo,
    prioridad: s.prioridad,
    titulo: s.titulo,
    descripcion: s.descripcion,
    estado: s.estado,
    camposExtra: (s.campos_extra ?? {}) as Record<string, unknown>,
    fechaEventoInicio: toIsoDate(s.fecha_evento_inicio),
    fechaEventoFin: toIsoDate(s.fecha_evento_fin),
    horaInicio: s.hora_inicio,
    horaFin: s.hora_fin,
    // T-V22: bloque transversal empresa ejecutante + modo emergencia.
    empresaNombre: s.empresa_nombre,
    empresaResponsable: s.empresa_responsable,
    empresaTelefono: s.empresa_telefono,
    empresaEmail: s.empresa_email,
    emergenciaContacto: s.emergencia_contacto,
    emergenciaTelefono: s.emergencia_telefono,
    esEmergencia: s.es_emergencia,
    enviadaAt: s.enviada_at?.toISOString() ?? null,
    asignadaAt: s.asignada_at?.toISOString() ?? null,
    decisionAt: s.decision_at?.toISOString() ?? null,
    createdAt: s.created_at.toISOString(),
    updatedAt: s.updated_at.toISOString(),
  };
}

export function solicitudToListItem(
  s: SolicitudConRelaciones,
  slaStatus: SlaStatus = null,
): SolicitudListItem {
  return {
    ...solicitudToOutput(s),
    localCodigo: s.local?.codigo ?? null,
    categoriaNombre: s.categoria?.nombre ?? null,
    subcategoriaNombre: s.subcategoria?.nombre ?? null,
    adminAsignado: toRef(s.admin_asignado),
    slaStatus,
  };
}

export function historialToOutput(h: HistorialConUsuario): SolicitudHistorialOutput {
  return {
    id: h.id,
    solicitudId: h.solicitud_id,
    usuario: toRef(h.usuario),
    evento: h.evento,
    estadoAnterior: h.estado_anterior,
    estadoNuevo: h.estado_nuevo,
    comentario: h.comentario,
    createdAt: h.created_at.toISOString(),
  };
}

export function comentarioToOutput(c: ComentarioConUsuario): ComentarioOutput {
  return {
    id: c.id,
    solicitudId: c.solicitud_id,
    usuario: toRef(c.usuario),
    tipo: c.tipo,
    cuerpo: c.cuerpo,
    createdAt: c.created_at.toISOString(),
  };
}
