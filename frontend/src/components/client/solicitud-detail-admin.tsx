'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { SolicitudDetailOutput, SolicitudResultadoCierre } from '@app/contracts';
import { esEstadoTerminal } from '@app/contracts';
import {
  tomarAction,
  liberarAction,
  aprobarAction,
  cerrarAction,
  rechazarAction,
  pedirSubsanacionAction,
  reasignarAction,
  pausarAction,
  reanudarAction,
  cancelarAdminAction,
  cambiarPrioridadAction,
  comentarAdminAction,
  descargarAdjuntoAdminAction,
  subirAdjuntoAdminAction,
  eliminarAdjuntoAdminAction,
} from '@/app/(admin-plaza)/admin/solicitudes/actions';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/client/tabs';
import { AdjuntoUploader } from '@/components/client/adjunto-uploader';
import { Can } from '@/components/client/can';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Banner } from '@/components/ui/banner';
import { Avatar } from '@/components/ui/avatar';
import { Breadcrumb } from '@/components/ui/page-header';
import {
  SolicitudEstadoBadge,
  PrioridadBadge,
  SlaSemaforo,
  SOLICITUD_ESTADO_LABEL,
  ResultadoCierreBadge,
} from '@/components/estado-badge';
import { formatDateInPlazaTz } from '@/lib/datetime';

export interface AdminOption {
  id: string;
  nombre: string;
  email: string;
}

/** MIME permitidos por defecto para adjuntos de solicitud (T-V06, configurable por plaza). */
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
const SOLICITUD_MAX_BYTES = 50 * 1024 * 1024; // 50 MB (T-V06)

const CAMPOS_EXTRA_LABEL: Record<string, string> = {
  area_afectada: 'Área afectada',
  requiere_ingreso_a_local: 'Requiere ingreso al local',
  asistentes_estimados: 'Asistentes estimados',
  asistentes: 'Asistentes',
  requiere_aprobacion_especial: 'Requiere aprobación especial',
  fecha_inicio_estimada: 'Fecha de inicio estimada',
  duracion_dias: 'Duración (días)',
  empresa_constructora: 'Empresa constructora',
  monto_presupuesto: 'Monto presupuesto',
};

const EVENTO_LABEL: Record<string, string> = {
  creada: 'Creada',
  enviada: 'Enviada',
  asignada: 'Auto-asignada',
  tomada: 'Tomada en revisión',
  aprobada: 'Aprobada',
  cerrada: 'Cerrada',
  rechazada: 'Rechazada',
  subsanada: 'Subsanación solicitada',
  reasignada: 'Reasignada',
  cancelada: 'Cancelada',
  comentario: 'Comentario',
  adjunto_agregado: 'Adjunto agregado',
  prioridad_cambiada: 'Prioridad cambiada',
  pausada: 'Pausada',
  reanudada: 'Reanudada',
};

/**
 * Detalle de solicitud del admin (T-107) con panel de decisión lateral sticky.
 * Acciones contextuales según estado/rol (SC-4: el creador no decide).
 */
export function SolicitudDetailAdmin({
  solicitud,
  admins,
  miUsuarioId,
}: {
  solicitud: SolicitudDetailOutput;
  admins: AdminOption[];
  miUsuarioId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [comentario, setComentario] = useState('');
  const [motivoPausa, setMotivoPausa] = useState('');
  const [cerrarResultado, setCerrarResultado] = useState<SolicitudResultadoCierre | ''>('');
  const [cerrarComentario, setCerrarComentario] = useState('');
  const [modal, setModal] = useState<
    'aprobar' | 'rechazar' | 'subsanar' | 'reasignar' | 'pausar' | 'cerrar' | null
  >(null);

  const estado = solicitud.estado;
  const soyAsignado = solicitud.adminAsignadoId === miUsuarioId;
  const soyCreador = solicitud.usuarioCreadorId === miUsuarioId; // SC-4
  // T-091e-cerrar: `aprobada` YA NO es terminal — queda pendiente de cierre.
  const esTerminal = esEstadoTerminal(estado);
  const esAprobadaPendienteCierre = estado === 'aprobada';
  // T-091d-pausar: `pausada` NO es terminal (es reversible), pero tampoco
  // admite las acciones de decisión (aprobar/rechazar/pedir subsanación).
  const esPausada = estado === 'pausada';

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => {
    setPending(true);
    const r = await fn();
    setPending(false);
    if (r.ok) {
      toast.success(okMsg);
      setModal(null);
      router.refresh();
    } else {
      toast.error(r.error ?? 'Error');
    }
  };

  return (
    <div className="page wide">
      <Breadcrumb items={[{ label: 'Solicitudes', href: '/admin/solicitudes' }, { label: solicitud.codigo }]} />
      <div className="page-head">
        <div className="ph-main">
          <h1 className="page-title">
            <span className="mono">{solicitud.codigo}</span>
            <SolicitudEstadoBadge estado={estado} />
            <PrioridadBadge prioridad={solicitud.prioridad} />
            <SlaSemaforo status={solicitud.slaStatus} />
          </h1>
          <p className="page-sub">
            {solicitud.titulo} · Local {solicitud.localCodigo ?? '—'} ·{' '}
            {solicitud.inquilinoRazonSocial ?? '—'}
            {solicitud.adminAsignado ? ` · Asignada a ${solicitud.adminAsignado.nombre}` : ''}
          </p>
        </div>
        <div className="ph-actions">
          <Button asChild variant="outline" size="sm">
            <a href={`/api/solicitudes/${solicitud.id}/permiso-pdf`} target="_blank" rel="noopener">
              Descargar permiso (PDF)
            </a>
          </Button>
        </div>
      </div>

      {soyCreador && !esTerminal && (
        <div className="mb-4">
          <Banner tone="danger">
            <b>SC-4:</b> creaste esta solicitud, por lo que no puedes aprobarla ni rechazarla.
          </Banner>
        </div>
      )}

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
                      <div>
                        <div className="dt">Solicitante</div>
                        <div className="dd">
                          {solicitud.usuarioCreador?.nombre ?? '—'} ({solicitud.inquilinoRazonSocial ?? '—'})
                        </div>
                      </div>
                      <div>
                        <div className="dt">Categoría / Subcategoría</div>
                        <div className="dd">
                          {solicitud.categoriaNombre ?? '—'} / {solicitud.subcategoriaNombre ?? '—'}
                        </div>
                      </div>
                      <div>
                        <div className="dt">Enviada</div>
                        <div className="dd">
                          {solicitud.enviadaAt ? formatDateInPlazaTz(solicitud.enviadaAt) : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="dt">Decisión</div>
                        <div className="dd">
                          {solicitud.decisionAt ? formatDateInPlazaTz(solicitud.decisionAt) : '—'}
                        </div>
                      </div>
                      {/* T-V22: fechas del permiso siempre visibles (no condicionales). */}
                      <div className="full">
                        <div className="dt">Fechas del permiso</div>
                        <div className="dd">
                          {solicitud.fechaEventoInicio} → {solicitud.fechaEventoFin ?? '—'}{' '}
                          {solicitud.horaInicio ? `(${solicitud.horaInicio}–${solicitud.horaFin})` : ''}
                        </div>
                      </div>
                    </dl>

                    {/* T-V22: bloque transversal empresa ejecutante + emergencia. */}
                    <div className="mt-6 grid gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Empresa ejecutante
                      </h4>
                      <dl className="dl c2">
                        <div>
                          <div className="dt">Empresa</div>
                          <div className="dd">{solicitud.empresaNombre || '—'}</div>
                        </div>
                        <div>
                          <div className="dt">Responsable</div>
                          <div className="dd">{solicitud.empresaResponsable || '—'}</div>
                        </div>
                        <div>
                          <div className="dt">Tel. empresa</div>
                          <div className="dd">{solicitud.empresaTelefono || '—'}</div>
                        </div>
                        <div>
                          <div className="dt">Email empresa</div>
                          <div className="dd">{solicitud.empresaEmail || '—'}</div>
                        </div>
                      </dl>
                    </div>

                    <div className="mt-6 grid gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Contacto de emergencia
                      </h4>
                      <dl className="dl c2">
                        <div>
                          <div className="dt">Contacto</div>
                          <div className="dd">{solicitud.emergenciaContacto || '—'}</div>
                        </div>
                        <div>
                          <div className="dt">Tel. emerg.</div>
                          <div className="dd">{solicitud.emergenciaTelefono || '—'}</div>
                        </div>
                        <div>
                          <div className="dt">Modo emerg.</div>
                          <div className="dd">
                            {solicitud.esEmergencia ? (
                              <span className="badge b-danger">Sí · máx. 3/mes</span>
                            ) : (
                              <span className="badge">No</span>
                            )}
                          </div>
                        </div>
                      </dl>
                    </div>

                    {/* T-V22: campos extra + asistentes_estimados como campo individual. */}
                    <div className="mt-6 grid gap-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Datos específicos
                      </h4>
                      <dl className="dl c2">
                        {Object.entries(solicitud.camposExtra)
                          .filter(([k]) => k !== 'asistentes_estimados')
                          .map(([k, v]) => (
                            <CampoExtra key={k} k={k} v={v} />
                          ))}
                      </dl>
                    </div>
                  </div>
                ),
              },
              {
                key: 'comentarios',
                label: 'Comentarios',
                count: solicitud.comentarios.length,
                content: (
                  <div className="stack" style={{ gap: 14 }}>
                    {solicitud.comentarios.length === 0 && (
                      <p className="muted text-sm">Sin comentarios.</p>
                    )}
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
                        placeholder="Comentario para el inquilino…"
                        className="textarea"
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                      />
                      <Can permiso="solicitudes.comentar">
                        <Button
                          disabled={pending || !comentario.trim()}
                          onClick={() =>
                            void run(async () => {
                              const r = await comentarAdminAction(solicitud.id, { cuerpo: comentario });
                              if (r.ok) setComentario('');
                              return r;
                            }, 'Comentario agregado')
                          }
                        >
                          Comentar
                        </Button>
                      </Can>
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
                    canDelete
                    subirAction={(fd) => subirAdjuntoAdminAction(solicitud.id, fd)}
                    descargarAction={descargarAdjuntoAdminAction}
                    eliminarAction={(adjId) => eliminarAdjuntoAdminAction(solicitud.id, adjId)}
                  />
                ),
              },
            ]}
          />
        </div>

        {/* Panel de decisión lateral (sticky) */}
        <div className="side-panel">
          <div className="card action-panel">
            <h4>Panel de decisión</h4>
            <p className="ap-sub">Acciones del flujo según el estado actual.</p>

            <div className="action-stack">
              {estado === 'enviada' && (
                <Can permiso="solicitudes.tomar">
                  <Button
                    size="block"
                    disabled={pending}
                    onClick={() => void run(() => tomarAction(solicitud.id), 'Tomada: en revisión')}
                  >
                    Tomar
                  </Button>
                </Can>
              )}
              {estado === 'asignado' && soyAsignado && (
                <Can permiso="solicitudes.tomar">
                  <Button
                    size="block"
                    disabled={pending}
                    onClick={() => void run(() => tomarAction(solicitud.id), 'En revisión')}
                  >
                    Tomar (revisar)
                  </Button>
                </Can>
              )}
              {estado === 'en_revision' && soyAsignado && !soyCreador && (
                <>
                  <Can permiso="solicitudes.aprobar">
                    <Button variant="success" size="block" disabled={pending} onClick={() => setModal('aprobar')}>
                      Aprobar
                    </Button>
                  </Can>
                  <Can permiso="solicitudes.rechazar">
                    <Button variant="danger" size="block" disabled={pending} onClick={() => setModal('rechazar')}>
                      Rechazar
                    </Button>
                  </Can>
                  <Can permiso="solicitudes.pedir_subsanacion">
                    <Button variant="secondary" size="block" disabled={pending} onClick={() => setModal('subsanar')}>
                      Pedir subsanación
                    </Button>
                  </Can>
                </>
              )}
              {(estado === 'asignado' || estado === 'en_revision') && !esTerminal && (
                <Can permiso="solicitudes.pausar">
                  <Button variant="outline" size="block" disabled={pending} onClick={() => setModal('pausar')}>
                    Pausar
                  </Button>
                </Can>
              )}
              {esPausada && (
                <Can permiso="solicitudes.reanudar">
                  <Button variant="success" size="block" disabled={pending} onClick={() => void run(() => reanudarAction(solicitud.id), 'Reanudada')}>
                    Reanudar
                  </Button>
                </Can>
              )}
              {esPausada && (
                <p className="muted text-sm">
                  Solicitud pausada
                  {solicitud.adminAsignado?.nombre ? ` por ${solicitud.adminAsignado.nombre}` : ''}. Cualquier
                  admin de la plaza puede reanudarla.
                </p>
              )}
              {/* T-091e-cerrar: aprobada → cerrada. Solo el admin asignado. */}
              {esAprobadaPendienteCierre && soyAsignado && (
                <Can permiso="solicitudes.cerrar">
                  <Button variant="success" size="block" disabled={pending} onClick={() => setModal('cerrar')}>
                    Cerrar solicitud
                  </Button>
                </Can>
              )}
              {esAprobadaPendienteCierre && !soyAsignado && (
                <p className="muted text-sm">
                  Aprobada, pendiente de cierre
                  {solicitud.adminAsignado?.nombre ? ` por ${solicitud.adminAsignado.nombre}` : ''}. Solo el
                  administrador asignado puede cerrarla.
                </p>
              )}
              {estado === 'cerrada' && (
                <div className="text-sm">
                  <p className="muted">
                    Solicitud cerrada
                    {solicitud.cerradaAt ? ` el ${formatDateInPlazaTz(solicitud.cerradaAt)}` : ''}.
                  </p>
                  {solicitud.resultadoCierre && (
                    <p style={{ marginTop: 6 }}>
                      <ResultadoCierreBadge resultado={solicitud.resultadoCierre} />
                    </p>
                  )}
                  {solicitud.cierreComentario && (
                    <p style={{ marginTop: 6 }}>{solicitud.cierreComentario}</p>
                  )}
                </div>
              )}
              {esTerminal && estado !== 'cerrada' && (
                <p className="muted text-sm">
                  Solicitud {SOLICITUD_ESTADO_LABEL[estado].toLowerCase()}. No hay acciones pendientes.
                </p>
              )}
            </div>

            <div className="divider" />

            <div className="kv">
              <div className="kv-row">
                <span className="kv-k">Prioridad</span>
                <span className="kv-v inline-flex items-center gap-2">
                  <PrioridadBadge prioridad={solicitud.prioridad} />
                  {!esTerminal && (
                    <Can permiso="solicitudes.cambiar_prioridad">
                      <select
                        className="select"
                        style={{ height: 30, width: 'auto', padding: '0 26px 0 8px', fontSize: 12 }}
                        value={solicitud.prioridad}
                        disabled={pending}
                        onChange={(e) =>
                          void run(
                            () => cambiarPrioridadAction(solicitud.id, e.target.value),
                            `Prioridad ${e.target.value}`,
                          )
                        }
                      >
                        {['A', 'B', 'C', 'D', 'F'].map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </Can>
                  )}
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-k">Asignada a</span>
                <span className="kv-v">{solicitud.adminAsignado?.nombre ?? 'Sin asignar'}</span>
              </div>
              <div className="kv-row">
                <span className="kv-k">SLA</span>
                <span className="kv-v">
                  <SlaSemaforo status={solicitud.slaStatus} />
                </span>
              </div>
            </div>

            {(estado === 'asignado' || estado === 'en_revision' || (!esTerminal)) && (
              <>
                <div className="divider" />
                <div className="action-stack">
                  {(estado === 'asignado' || estado === 'en_revision') && (
                    <>
                      <Can permiso="solicitudes.reasignar">
                        <Button variant="secondary" size="block" disabled={pending} onClick={() => setModal('reasignar')}>
                          Reasignar
                        </Button>
                      </Can>
                      {soyAsignado && (
                        <Can permiso="solicitudes.liberar">
                          <Button
                            variant="ghost"
                            size="block"
                            disabled={pending}
                            onClick={() => {
                              const motivo = prompt('Motivo (opcional):') ?? undefined;
                              void run(() => liberarAction(solicitud.id, motivo), 'Liberada: volvió a la cola');
                            }}
                          >
                            Liberar
                          </Button>
                        </Can>
                      )}
                    </>
                  )}
                  {!esTerminal && !esAprobadaPendienteCierre && (
                    <Can permiso="solicitudes.cancelar">
                      <Button
                        variant="danger"
                        size="block"
                        disabled={pending}
                        onClick={() => {
                          const motivo = prompt('Motivo de cancelación:') ?? undefined;
                          if (!motivo) return;
                          void run(() => cancelarAdminAction(solicitud.id, motivo), 'Cancelada');
                        }}
                      >
                        Cancelar solicitud
                      </Button>
                    </Can>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {(modal === 'aprobar' || modal === 'rechazar' || modal === 'subsanar') && (
        <DecisionDialog
          tipo={modal}
          pending={pending}
          onClose={() => setModal(null)}
          onSubmit={(texto) => {
            if (modal === 'aprobar') {
              void run(() => aprobarAction(solicitud.id, texto || undefined), 'Aprobada');
            } else if (modal === 'rechazar') {
              void run(() => rechazarAction(solicitud.id, texto), 'Rechazada');
            } else {
              void run(() => pedirSubsanacionAction(solicitud.id, texto), 'Subsanación solicitada');
            }
          }}
        />
      )}
      {modal === 'pausar' && (
        <Dialog open onOpenChange={(open) => !open && setModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Pausar solicitud</DialogTitle>
              <DialogDescription>
                La solicitud volverá a tu revisión al reanudarla. El SLA queda congelado mientras esté pausada.
              </DialogDescription>
            </DialogHeader>
            <textarea
              rows={3}
              maxLength={1000}
              autoFocus
              placeholder="Motivo (opcional, visible para el equipo)…"
              className="textarea"
              value={motivoPausa}
              onChange={(e) => setMotivoPausa(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModal(null)}>
                Cancelar
              </Button>
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => void run(() => pausarAction(solicitud.id, motivoPausa), 'Solicitud pausada')}
              >
                Pausar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {modal === 'cerrar' && (
        <CerrarDialog
          pending={pending}
          resultado={cerrarResultado}
          comentario={cerrarComentario}
          onResultadoChange={(v) => setCerrarResultado(v)}
          onComentarioChange={(v) => setCerrarComentario(v)}
          onClose={() => {
            setModal(null);
            setCerrarResultado('');
            setCerrarComentario('');
          }}
          onSubmit={() => {
            if (!cerrarResultado) return;
            const dto = cerrarResultado === 'exitoso'
              ? { resultado: 'exitoso' as const }
              : { resultado: cerrarResultado, comentario: cerrarComentario.trim() };
            void run(
              () => cerrarAction(solicitud.id, dto),
              'Solicitud cerrada',
            );
          }}
        />
      )}
      {modal === 'reasignar' && (
        <ReasignarDialog
          admins={admins.filter((a) => a.id !== solicitud.adminAsignadoId)}
          pending={pending}
          onClose={() => setModal(null)}
          onSubmit={(nuevoResponsableId, motivo) =>
            void run(
              () => reasignarAction(solicitud.id, { nuevoResponsableId, comentario: motivo }),
              'Reasignada',
            )
          }
        />
      )}
    </div>
  );
}

function CampoExtra({ k, v }: { k: string; v: unknown }) {
  // T-V21: `asistentes` es una lista {nombre, documento} → tabla compacta.
  if (k === 'asistentes' && Array.isArray(v)) {
    const lista = v as Array<{ nombre?: string; documento?: string }>;
    return (
      <div>
        <div className="dt">{CAMPOS_EXTRA_LABEL[k]}</div>
        <div className="dd">
          {lista.length === 0 ? (
            <span className="muted">—</span>
          ) : (
            <ul className="text-sm">
              {lista.map((a, i) => (
                <li key={i}>
                  <b>{a.nombre || '—'}</b> · <span className="muted">{a.documento || '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="dt">{CAMPOS_EXTRA_LABEL[k] ?? k}</div>
      <div className="dd">{typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v ?? '—')}</div>
    </div>
  );
}

/** Modal de decisión: rechazo/subsanación exigen comentario (T7/T8). */
function DecisionDialog({
  tipo,
  pending,
  onClose,
  onSubmit,
}: {
  tipo: 'aprobar' | 'rechazar' | 'subsanar';
  pending: boolean;
  onClose: () => void;
  onSubmit: (texto: string) => void;
}) {
  const [texto, setTexto] = useState('');
  const obligatorio = tipo !== 'aprobar';
  const titulo =
    tipo === 'aprobar' ? 'Aprobar solicitud' : tipo === 'rechazar' ? 'Rechazar solicitud' : 'Pedir subsanación';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            {obligatorio
              ? 'El comentario es obligatorio y se notifica al inquilino.'
              : 'Comentario opcional para el inquilino.'}
          </DialogDescription>
        </DialogHeader>
        <textarea
          rows={4}
          maxLength={4000}
          autoFocus
          className="textarea"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pending || (obligatorio && !texto.trim())}
            variant={tipo === 'rechazar' ? 'danger-solid' : tipo === 'aprobar' ? 'success' : 'default'}
            onClick={() => onSubmit(texto.trim())}
          >
            {titulo}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Modal de reasignación (T12): combobox de admin_plaza con staff activo. */
function ReasignarDialog({
  admins,
  pending,
  onClose,
  onSubmit,
}: {
  admins: AdminOption[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (nuevoResponsableId: string, motivo?: string) => void;
}) {
  const [seleccion, setSeleccion] = useState('');
  const [motivo, setMotivo] = useState('');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reasignar solicitud</DialogTitle>
          <DialogDescription>
            El nuevo responsable debe ser un admin de plaza con rol de staff activo (SC-6).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <select className="select" value={seleccion} onChange={(e) => setSeleccion(e.target.value)}>
            <option value="">Selecciona administrador…</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} ({a.email})
              </option>
            ))}
          </select>
          <input
            placeholder="Motivo (opcional)"
            maxLength={1000}
            className="input"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={pending || !seleccion} onClick={() => onSubmit(seleccion, motivo.trim() || undefined)}>
              Reasignar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Modal de cierre (T-091e-cerrar): resultado + comentario cuando != exitoso. */
function CerrarDialog({
  pending,
  resultado,
  comentario,
  onResultadoChange,
  onComentarioChange,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  resultado: SolicitudResultadoCierre | '';
  comentario: string;
  onResultadoChange: (v: SolicitudResultadoCierre | '') => void;
  onComentarioChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const requiereComentario = resultado !== '' && resultado !== 'exitoso';
  const comentarioOk = !requiereComentario || comentario.trim().length > 0;
  const submitDisabled = pending || resultado === '' || !comentarioOk;

  const OPCIONES: { value: SolicitudResultadoCierre; label: string }[] = [
    { value: 'exitoso', label: 'Cerrada con éxito' },
    { value: 'parcial', label: 'Cerrada parcialmente' },
    { value: 'fallido', label: 'Cerrada sin éxito' },
    { value: 'no_realizado', label: 'No realizada' },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar solicitud</DialogTitle>
          <DialogDescription>
            Registra el resultado de la actividad. Esta acción es terminal: no se puede reabrir.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Resultado</span>
            <select
              className="select"
              autoFocus
              value={resultado}
              onChange={(e) => onResultadoChange(e.target.value as SolicitudResultadoCierre | '')}
            >
              <option value="">Selecciona resultado…</option>
              {OPCIONES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">
              Comentario {requiereComentario ? '(obligatorio)' : '(opcional)'}
            </span>
            <textarea
              rows={4}
              maxLength={4000}
              className="textarea"
              placeholder="Detalle del resultado, evidencia o motivo…"
              value={comentario}
              onChange={(e) => onComentarioChange(e.target.value)}
            />
            {requiereComentario && !comentarioOk && (
              <span className="text-sm" style={{ color: 'var(--danger-600, #b91c1c)' }}>
                El comentario es obligatorio cuando el cierre no es exitoso.
              </span>
            )}
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="success" disabled={submitDisabled} onClick={onSubmit}>
            Cerrar solicitud
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
