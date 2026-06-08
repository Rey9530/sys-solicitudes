'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { SolicitudDetailOutput } from '@app/contracts';
import {
  tomarAction,
  liberarAction,
  aprobarAction,
  rechazarAction,
  pedirSubsanacionAction,
  reasignarAction,
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
  const [modal, setModal] = useState<'aprobar' | 'rechazar' | 'subsanar' | 'reasignar' | null>(null);

  const estado = solicitud.estado;
  const soyAsignado = solicitud.adminAsignadoId === miUsuarioId;
  const soyCreador = solicitud.usuarioCreadorId === miUsuarioId; // SC-4
  const esTerminal = ['aprobada', 'rechazada', 'cancelada'].includes(estado);

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
                        <CampoExtra key={k} k={k} v={v} />
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
                <Button
                  size="block"
                  disabled={pending}
                  onClick={() => void run(() => tomarAction(solicitud.id), 'Tomada: en revisión')}
                >
                  Tomar
                </Button>
              )}
              {estado === 'asignado' && soyAsignado && (
                <Button
                  size="block"
                  disabled={pending}
                  onClick={() => void run(() => tomarAction(solicitud.id), 'En revisión')}
                >
                  Tomar (revisar)
                </Button>
              )}
              {estado === 'en_revision' && soyAsignado && !soyCreador && (
                <>
                  <Button variant="success" size="block" disabled={pending} onClick={() => setModal('aprobar')}>
                    Aprobar
                  </Button>
                  <Button variant="danger" size="block" disabled={pending} onClick={() => setModal('rechazar')}>
                    Rechazar
                  </Button>
                  <Button variant="secondary" size="block" disabled={pending} onClick={() => setModal('subsanar')}>
                    Pedir subsanación
                  </Button>
                </>
              )}
              {esTerminal && (
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
                      <Button variant="secondary" size="block" disabled={pending} onClick={() => setModal('reasignar')}>
                        Reasignar
                      </Button>
                      {soyAsignado && (
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
                      )}
                    </>
                  )}
                  {!esTerminal && (
                    <Button
                      variant="danger"
                      size="block"
                      disabled={pending}
                      onClick={() => {
                        const motivo = prompt('Motivo de cancelación:') ?? undefined;
                        void run(() => cancelarAdminAction(solicitud.id, motivo), 'Cancelada');
                      }}
                    >
                      Cancelar solicitud
                    </Button>
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
