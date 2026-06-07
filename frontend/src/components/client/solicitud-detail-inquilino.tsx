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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{solicitud.codigo}</h1>
            <SolicitudEstadoBadge estado={estado} />
            <PrioridadBadge prioridad={solicitud.prioridad} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {solicitud.titulo} · Local {solicitud.localCodigo ?? '—'}
            {solicitud.adminAsignado ? ` · Asignada a ${solicitud.adminAsignado.nombre}` : ''}
          </p>
        </div>

        {/* Acciones contextuales por estado (T-089) */}
        <div className="flex flex-wrap gap-2">
          {esBorrador && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/inquilino/solicitudes/${solicitud.id}/editar`}>Editar</Link>
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  void run(
                    () => enviarSolicitudAction(solicitud.id),
                    'Enviada: quedó en cola de asignación',
                  )
                }
              >
                Enviar
              </Button>
            </>
          )}
          {esSubsanacion && (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href={`/inquilino/solicitudes/${solicitud.id}/editar`}>Editar</Link>
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  void run(
                    () => subsanarSolicitudAction(solicitud.id),
                    'Reenviada: volvió a la cola de asignación',
                  )
                }
              >
                Reenviar subsanada
              </Button>
            </>
          )}
          {!esTerminal && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600"
              disabled={pending}
              onClick={() => {
                const motivo = prompt('Motivo de cancelación (opcional):') ?? undefined;
                void run(() => cancelarSolicitudAction(solicitud.id, motivo), 'Cancelada');
              }}
            >
              Cancelar
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={pending} onClick={() => void onDuplicar()}>
            Duplicar
          </Button>
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
                  <dt className="font-medium text-gray-900">Categoría</dt>
                  <dd>{solicitud.categoriaNombre ?? '—'}</dd>
                  <dt className="font-medium text-gray-900">Subcategoría</dt>
                  <dd>{solicitud.subcategoriaNombre ?? '—'}</dd>
                  <dt className="font-medium text-gray-900">Creada</dt>
                  <dd>{formatDateInPlazaTz(solicitud.createdAt)}</dd>
                  <dt className="font-medium text-gray-900">Enviada</dt>
                  <dd>{solicitud.enviadaAt ? formatDateInPlazaTz(solicitud.enviadaAt) : '—'}</dd>
                  <dt className="font-medium text-gray-900">Decisión</dt>
                  <dd>{solicitud.decisionAt ? formatDateInPlazaTz(solicitud.decisionAt) : '—'}</dd>
                  {solicitud.fechaEventoInicio && (
                    <>
                      <dt className="font-medium text-gray-900">Fechas del evento</dt>
                      <dd>
                        {solicitud.fechaEventoInicio} → {solicitud.fechaEventoFin ?? '—'}{' '}
                        {solicitud.horaInicio ? `(${solicitud.horaInicio}–${solicitud.horaFin})` : ''}
                      </dd>
                    </>
                  )}
                  {Object.entries(solicitud.camposExtra).map(([k, v]) => (
                    <Fragmento key={k} k={k} v={v} />
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
                    placeholder="Escribe un comentario…"
                    className="flex-1 rounded-md border border-input bg-white px-3 py-2 text-sm"
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
  );
}

function Fragmento({ k, v }: { k: string; v: unknown }) {
  return (
    <>
      <dt className="font-medium text-gray-900">{CAMPOS_EXTRA_LABEL[k] ?? k}</dt>
      <dd>{formatValor(v)}</dd>
    </>
  );
}
