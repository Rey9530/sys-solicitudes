'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { SolicitudDetailOutput } from '@app/contracts';
import {
  enviarSolicitudAction,
  cancelarSolicitudAction,
  subsanarSolicitudAction,
  duplicarSolicitudAction,
  addComentarioAction,
  subirAdjuntoSolicitudAction,
  descargarAdjuntoSolicitudAction,
  eliminarAdjuntoSolicitudAction,
} from '@/app/(inquilino)/inquilino/solicitudes/actions';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/client/tabs';
import { AdjuntoUploader } from '@/components/client/adjunto-uploader';
import { Avatar } from '@/components/ui/avatar';
import { Breadcrumb } from '@/components/ui/page-header';
import {
  SolicitudEstadoBadge,
  PrioridadBadge,
  SOLICITUD_ESTADO_LABEL,
} from '@/components/estado-badge';
import { formatDateInPlazaTz } from '@/lib/datetime';

/** MIME permitidos por defecto para adjuntos de solicitud (T-V06). */
const SOLICITUD_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/dwg',
];
const SOLICITUD_MAX_BYTES = 50 * 1024 * 1024;

const CAMPOS_EXTRA_LABEL: Record<string, string> = {
  area_afectada: 'Área afectada',
  requiere_ingreso_a_local: 'Requiere ingreso al local',
  asistentes_estimados: 'Asistentes estimados',
  requiere_corte_calle: 'Requiere corte de calle',
  requiere_amplificacion: 'Requiere amplificación',
  requiere_aprobacion_especial: 'Requiere aprobación especial',
  fecha_inicio_estimada: 'Fecha de inicio estimada',
  duracion_dias: 'Duración (días)',
  empresa_constructora: 'Empresa constructora',
  monto_presupuesto: 'Monto presupuesto',
  categoria_libre: 'Categoría libre',
  descripcion_larga: 'Descripción larga',
};

function formatValor(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  return String(v ?? '—');
}

const EVENTO_LABEL: Record<string, string> = {
  creada: 'Creada',
  enviada: 'Enviada',
  asignada: 'Auto-asignada',
  tomada: 'Tomada en revisión',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  subsanada: 'Subsanación solicitada',
  reasignada: 'Reasignada',
  cancelada: 'Cancelada',
  comentario: 'Comentario',
  adjunto_agregado: 'Adjunto agregado',
  prioridad_cambiada: 'Prioridad cambiada',
};

/** Detalle de solicitud del inquilino (T-089): tabs + acciones por estado. */
export function SolicitudDetailInquilino({ solicitud }: { solicitud: SolicitudDetailOutput }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [comentario, setComentario] = useState('');

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    setPending(true);
    const r = await fn();
    setPending(false);
    if (r.ok) {
      toast.success(okMsg);
      router.refresh();
    } else {
      toast.error(r.error ?? 'Error');
    }
  };

  const onDuplicar = async () => {
    setPending(true);
    const r = await duplicarSolicitudAction(solicitud.id);
    setPending(false);
    if (r.ok && r.data) {
      toast.success(`Duplicada como ${r.data.codigo}`);
      router.push(`/inquilino/solicitudes/${r.data.id}`);
    } else {
      toast.error(r.ok ? 'Error' : r.error);
    }
  };

  const onComentar = async () => {
    if (!comentario.trim()) return;
    setPending(true);
    const r = await addComentarioAction(solicitud.id, { cuerpo: comentario });
    setPending(false);
    if (r.ok) {
      setComentario('');
      toast.success('Comentario agregado');
      router.refresh();
    } else {
      toast.error(r.error);
    }
  };

  const estado = solicitud.estado;
  const esBorrador = estado === 'borrador';
  const esSubsanacion = estado === 'requerida_subsanacion';
  const esTerminal = ['aprobada', 'rechazada', 'cancelada'].includes(estado);
  const puedeAdjuntar = esBorrador || esSubsanacion;

  return (
    <div className="page wide">
      <Breadcrumb items={[{ label: 'Mis solicitudes', href: '/inquilino/solicitudes' }, { label: solicitud.codigo }]} />
      <div className="page-head">
        <div className="ph-main">
          <h1 className="page-title">
            <span className="mono">{solicitud.codigo}</span>
            <SolicitudEstadoBadge estado={estado} />
            <PrioridadBadge prioridad={solicitud.prioridad} />
          </h1>
          <p className="page-sub">
            {solicitud.titulo} · Local {solicitud.localCodigo ?? '—'}
            {solicitud.adminAsignado ? ` · Asignada a ${solicitud.adminAsignado.nombre}` : ''}
          </p>
        </div>
      </div>

      <div className="detail-grid">
        <div className="min-w-0">
          <Tabs
            tabs={[
              {
                key: 'detalle',
                label: 'Detalle',
                content: (
                  <div className="card card-pad">
                    <p className="whitespace-pre-wrap" style={{ color: 'var(--text-2)', marginBottom: 18 }}>
                      {solicitud.descripcion}
                    </p>
                    <dl className="dl c2">
                      <Dato dt="Categoría" dd={solicitud.categoriaNombre ?? '—'} />
                      <Dato dt="Subcategoría" dd={solicitud.subcategoriaNombre ?? '—'} />
                      <Dato dt="Creada" dd={formatDateInPlazaTz(solicitud.createdAt)} />
                      <Dato dt="Enviada" dd={solicitud.enviadaAt ? formatDateInPlazaTz(solicitud.enviadaAt) : '—'} />
                      <Dato dt="Decisión" dd={solicitud.decisionAt ? formatDateInPlazaTz(solicitud.decisionAt) : '—'} />
                      {solicitud.fechaEventoInicio && (
                        <div className="full">
                          <div className="dt">Fechas del evento</div>
                          <div className="dd">
                            {solicitud.fechaEventoInicio} → {solicitud.fechaEventoFin ?? '—'}{' '}
                            {solicitud.horaInicio ? `(${solicitud.horaInicio}–${solicitud.horaFin})` : ''}
                          </div>
                        </div>
                      )}
                      {Object.entries(solicitud.camposExtra).map(([k, v]) => (
                        <Dato key={k} dt={CAMPOS_EXTRA_LABEL[k] ?? k} dd={formatValor(v)} />
                      ))}
                    </dl>
                  </div>
                ),
              },
              {
                key: 'comentarios',
                label: 'Comentarios',
                count: solicitud.comentarios.length,
                content: (
                  <div className="stack" style={{ gap: 14 }}>
                    {solicitud.comentarios.length === 0 && <p className="muted text-sm">Sin comentarios.</p>}
                    {solicitud.comentarios.map((c) => (
                      <div key={c.id} className="card card-pad">
                        <div className="mb-2 flex items-center gap-2">
                          <Avatar name={c.usuario?.nombre ?? 'Sistema'} sm />
                          <b style={{ fontSize: 13 }}>{c.usuario?.nombre ?? 'Sistema'}</b>
                          {c.tipo !== 'general' && <span className="badge b-warn">{c.tipo}</span>}
                          <span className="tl-time ml-auto">{formatDateInPlazaTz(c.createdAt)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-2)' }}>
                          {c.cuerpo}
                        </p>
                      </div>
                    ))}
                    <div className="flex items-start gap-2">
                      <textarea
                        rows={2}
                        maxLength={4000}
                        placeholder="Escribe un comentario…"
                        className="textarea"
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                      />
                      <Button disabled={pending || !comentario.trim()} onClick={() => void onComentar()}>
                        Comentar
                      </Button>
                    </div>
                  </div>
                ),
              },
              {
                key: 'historial',
                label: 'Historial',
                count: solicitud.historial.length,
                content: (
                  <div className="card card-pad">
                    <div className="timeline">
                      {solicitud.historial.map((h) => (
                        <div key={h.id} className="tl-item">
                          <span className="tl-dot" />
                          <div className="tl-head">
                            <b>{EVENTO_LABEL[h.evento] ?? h.evento}</b>
                            {h.estadoNuevo && (
                              <span className="muted text-xs">→ {SOLICITUD_ESTADO_LABEL[h.estadoNuevo]}</span>
                            )}
                            <span className="tl-time">
                              {formatDateInPlazaTz(h.createdAt)} · {h.usuario?.nombre ?? 'Sistema'}
                            </span>
                          </div>
                          {h.comentario && <div className="tl-body">{h.comentario}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                key: 'adjuntos',
                label: 'Adjuntos',
                count: solicitud.adjuntos.length,
                content: (
                  <AdjuntoUploader
                    entidadTipo="solicitud"
                    adjuntosIniciales={solicitud.adjuntos}
                    mimeAllowlist={SOLICITUD_MIMES}
                    maxBytes={SOLICITUD_MAX_BYTES}
                    canDelete={puedeAdjuntar}
                    subirAction={(fd) => subirAdjuntoSolicitudAction(solicitud.id, fd)}
                    descargarAction={descargarAdjuntoSolicitudAction}
                    eliminarAction={(adjId) => eliminarAdjuntoSolicitudAction(adjId, solicitud.id)}
                  />
                ),
              },
            ]}
          />
        </div>

        {/* Panel lateral de estado + acciones del inquilino */}
        <div className="side-panel">
          <div className="card action-panel">
            <h4>Estado de la solicitud</h4>
            <p className="ap-sub">{SOLICITUD_ESTADO_LABEL[estado]}</p>

            <div className="action-stack">
              {esBorrador && (
                <>
                  <Link href={`/inquilino/solicitudes/${solicitud.id}/editar`} className="btn btn-secondary btn-block">
                    Editar
                  </Link>
                  <Button
                    size="block"
                    disabled={pending}
                    onClick={() =>
                      void run(() => enviarSolicitudAction(solicitud.id), 'Enviada: quedó en cola de asignación')
                    }
                  >
                    Enviar
                  </Button>
                </>
              )}
              {esSubsanacion && (
                <>
                  <Link href={`/inquilino/solicitudes/${solicitud.id}/editar`} className="btn btn-secondary btn-block">
                    Editar
                  </Link>
                  <Button
                    size="block"
                    disabled={pending}
                    onClick={() =>
                      void run(() => subsanarSolicitudAction(solicitud.id), 'Reenviada: volvió a la cola de asignación')
                    }
                  >
                    Reenviar subsanada
                  </Button>
                </>
              )}
              <Button variant="secondary" size="block" disabled={pending} onClick={() => void onDuplicar()}>
                Duplicar
              </Button>
              {!esTerminal && (
                <Button
                  variant="danger"
                  size="block"
                  disabled={pending}
                  onClick={() => {
                    const motivo = prompt('Motivo de cancelación (opcional):') ?? undefined;
                    void run(() => cancelarSolicitudAction(solicitud.id, motivo), 'Cancelada');
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dato({ dt, dd }: { dt: string; dd: string }) {
  return (
    <div>
      <div className="dt">{dt}</div>
      <div className="dd">{dd}</div>
    </div>
  );
}
