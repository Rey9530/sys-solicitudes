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

const selectClass = 'h-9 w-full rounded-md border border-input bg-white px-2 text-sm';

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
 * Detalle de solicitud del admin (T-107) con acciones contextuales:
 *  - enviada (cola): "Tomar" (cualquier admin).
 *  - asignado y soy el asignado: "Tomar" (pasa a revisión), "Reasignar", "Liberar".
 *  - en_revision y soy el asignado y NO soy el creador (SC-4): Aprobar /
 *    Rechazar / Pedir subsanación (modales con comentario) + Reasignar/Liberar.
 *  - en_revision y soy el creador: decisiones deshabilitadas (SC-4).
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
  const [modal, setModal] = useState<'aprobar' | 'rechazar' | 'subsanar' | 'reasignar' | null>(
    null,
  );

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{solicitud.codigo}</h1>
            <SolicitudEstadoBadge estado={estado} />
            <PrioridadBadge prioridad={solicitud.prioridad} />
            <SlaSemaforo status={solicitud.slaStatus} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {solicitud.titulo} · Local {solicitud.localCodigo ?? '—'} ·{' '}
            {solicitud.inquilinoRazonSocial ?? '—'}
            {solicitud.adminAsignado ? ` · Asignada a ${solicitud.adminAsignado.nombre}` : ''}
          </p>
          {soyCreador && !esTerminal && (
            <p className="mt-1 text-xs font-medium text-amber-600">
              Creaste esta solicitud: no puedes aprobarla ni rechazarla (SC-4).
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {estado === 'enviada' && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => void run(() => tomarAction(solicitud.id), 'Tomada: en revisión')}
            >
              Tomar
            </Button>
          )}
          {estado === 'asignado' && soyAsignado && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => void run(() => tomarAction(solicitud.id), 'En revisión')}
            >
              Tomar (revisar)
            </Button>
          )}
          {estado === 'en_revision' && soyAsignado && !soyCreador && (
            <>
              <Button size="sm" disabled={pending} onClick={() => setModal('aprobar')}>
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600"
                disabled={pending}
                onClick={() => setModal('rechazar')}
              >
                Rechazar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setModal('subsanar')}
              >
                Pedir subsanación
              </Button>
            </>
          )}
          {(estado === 'asignado' || estado === 'en_revision') && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setModal('reasignar')}
              >
                Reasignar
              </Button>
              {soyAsignado && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    const motivo = prompt('Motivo (opcional):') ?? undefined;
                    void run(
                      () => liberarAction(solicitud.id, motivo),
                      'Liberada: volvió a la cola',
                    );
                  }}
                >
                  Liberar
                </Button>
              )}
            </>
          )}
          {!esTerminal && estado !== 'borrador' && (
            <>
              <select
                className="h-8 rounded-md border border-input bg-white px-1 text-sm"
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
                    Prioridad {p}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600"
                disabled={pending}
                onClick={() => {
                  const motivo = prompt('Motivo de cancelación:') ?? undefined;
                  void run(() => cancelarAdminAction(solicitud.id, motivo), 'Cancelada');
                }}
              >
                Cancelar
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs
        tabs={[
          {
            key: 'detalle',
            label: 'Detalle',
            content: (
              <div className="grid gap-4 rounded-lg border bg-white p-6 text-sm">
                <p className="whitespace-pre-wrap text-gray-700">{solicitud.descripcion}</p>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-gray-600">
                  <dt className="font-medium text-gray-900">Solicitante</dt>
                  <dd>
                    {solicitud.usuarioCreador?.nombre ?? '—'} (
                    {solicitud.inquilinoRazonSocial ?? '—'})
                  </dd>
                  <dt className="font-medium text-gray-900">Categoría / Subcategoría</dt>
                  <dd>
                    {solicitud.categoriaNombre ?? '—'} / {solicitud.subcategoriaNombre ?? '—'}
                  </dd>
                  <dt className="font-medium text-gray-900">Enviada</dt>
                  <dd>{solicitud.enviadaAt ? formatDateInPlazaTz(solicitud.enviadaAt) : '—'}</dd>
                  <dt className="font-medium text-gray-900">Decisión</dt>
                  <dd>{solicitud.decisionAt ? formatDateInPlazaTz(solicitud.decisionAt) : '—'}</dd>
                  {solicitud.fechaEventoInicio && (
                    <>
                      <dt className="font-medium text-gray-900">Fechas del evento</dt>
                      <dd>
                        {solicitud.fechaEventoInicio} → {solicitud.fechaEventoFin ?? '—'}{' '}
                        {solicitud.horaInicio
                          ? `(${solicitud.horaInicio}–${solicitud.horaFin})`
                          : ''}
                      </dd>
                    </>
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
            label: `Comentarios (${solicitud.comentarios.length})`,
            content: (
              <div className="space-y-4">
                <ul className="space-y-3">
                  {solicitud.comentarios.length === 0 && (
                    <li className="text-sm text-gray-500">Sin comentarios.</li>
                  )}
                  {solicitud.comentarios.map((c) => (
                    <li key={c.id} className="rounded-lg border bg-white p-4 text-sm">
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                        <span className="font-medium text-gray-700">
                          {c.usuario?.nombre ?? 'Sistema'}
                          {c.tipo !== 'general' && (
                            <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
                              {c.tipo}
                            </span>
                          )}
                        </span>
                        <span>{formatDateInPlazaTz(c.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-gray-700">{c.cuerpo}</p>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    maxLength={4000}
                    placeholder="Comentario para el inquilino…"
                    className="flex-1 rounded-md border border-input bg-white px-3 py-2 text-sm"
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
            label: `Historial (${solicitud.historial.length})`,
            content: (
              <ol className="relative ml-3 space-y-4 border-l pl-6">
                {solicitud.historial.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <p className="text-sm font-medium text-gray-900">
                      {EVENTO_LABEL[h.evento] ?? h.evento}
                      {h.estadoNuevo && (
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          → {SOLICITUD_ESTADO_LABEL[h.estadoNuevo]}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDateInPlazaTz(h.createdAt)} · {h.usuario?.nombre ?? 'Sistema'}
                    </p>
                    {h.comentario && <p className="mt-1 text-sm text-gray-600">{h.comentario}</p>}
                  </li>
                ))}
              </ol>
            ),
          },
          {
            key: 'adjuntos',
            label: `Adjuntos (${solicitud.adjuntos.length})`,
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
              void run(
                () => pedirSubsanacionAction(solicitud.id, texto),
                'Subsanación solicitada',
              );
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
    <>
      <dt className="font-medium text-gray-900">{CAMPOS_EXTRA_LABEL[k] ?? k}</dt>
      <dd>{typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v ?? '—')}</dd>
    </>
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
          className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={pending || (obligatorio && !texto.trim())}
            variant={tipo === 'rechazar' ? 'destructive' : 'default'}
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
          <select
            className={selectClass}
            value={seleccion}
            onChange={(e) => setSeleccion(e.target.value)}
          >
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
            className="h-9 rounded-md border border-input bg-white px-3 text-sm"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={pending || !seleccion}
              onClick={() => onSubmit(seleccion, motivo.trim() || undefined)}
            >
              Reasignar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
