'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { SolicitudDetailOutput, SolicitudListItem, SolicitudTipo } from '@app/contracts';
import {
  createSolicitudAction,
  updateSolicitudAction,
  enviarSolicitudAction,
  subirAdjuntoSolicitudAction,
  checkDuplicadosAction,
} from '@/app/(inquilino)/inquilino/solicitudes/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface CategoriaOption {
  id: string;
  nombre: string;
  subcategorias: Array<{ id: string; nombre: string; prioridad: string }>;
}

export interface LocalOption {
  id: string;
  codigo: string;
}

const TIPOS: Array<{ value: SolicitudTipo; label: string }> = [
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'evento', label: 'Evento' },
  { value: 'remodelacion', label: 'Remodelación' },
  { value: 'otro', label: 'Otro' },
];

const selectClass = 'h-9 w-full rounded-md border border-input bg-white px-2 text-sm';
const MAX_ADJUNTOS = 10;

interface CamposExtraState {
  // mantenimiento
  area_afectada: string;
  requiere_ingreso_a_local: boolean;
  // evento
  asistentes_estimados: string;
  requiere_corte_calle: boolean;
  requiere_amplificacion: boolean;
  // remodelacion
  fecha_inicio_estimada: string;
  duracion_dias: string;
  empresa_constructora: string;
  monto_presupuesto: string;
  // otro
  categoria_libre: string;
  descripcion_larga: string;
}

const CAMPOS_EXTRA_INICIAL: CamposExtraState = {
  area_afectada: '',
  requiere_ingreso_a_local: false,
  asistentes_estimados: '',
  requiere_corte_calle: false,
  requiere_amplificacion: false,
  fecha_inicio_estimada: '',
  duracion_dias: '',
  empresa_constructora: '',
  monto_presupuesto: '',
  categoria_libre: '',
  descripcion_larga: '',
};

/**
 * Wizard de solicitud (T-088, sin paso de recurrencia — T-V05):
 *   1. Tipo y categoría/subcategoría
 *   2. Local + detalles + campos extra dinámicos por tipo
 *   3. Adjuntos (máx 10) y revisión → "Guardar borrador" o "Enviar ahora"
 * En modo edición (`solicitud` presente) hace PATCH y omite adjuntos (tab propia).
 */
export function SolicitudWizard({
  categorias,
  locales,
  solicitud,
}: {
  categorias: CategoriaOption[];
  locales: LocalOption[];
  solicitud?: SolicitudDetailOutput;
}) {
  const router = useRouter();
  const editMode = Boolean(solicitud);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [tipo, setTipo] = useState<SolicitudTipo>(solicitud?.tipo ?? 'mantenimiento');
  const [categoriaId, setCategoriaId] = useState(solicitud?.categoriaId ?? '');
  const [subcategoriaId, setSubcategoriaId] = useState(solicitud?.subcategoriaId ?? '');
  const [localId, setLocalId] = useState(solicitud?.localId ?? '');
  const [titulo, setTitulo] = useState(solicitud?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(solicitud?.descripcion ?? '');
  const [fechaInicio, setFechaInicio] = useState(solicitud?.fechaEventoInicio ?? '');
  const [fechaFin, setFechaFin] = useState(solicitud?.fechaEventoFin ?? '');
  const [horaInicio, setHoraInicio] = useState(solicitud?.horaInicio ?? '');
  const [horaFin, setHoraFin] = useState(solicitud?.horaFin ?? '');
  const [extra, setExtra] = useState<CamposExtraState>({
    ...CAMPOS_EXTRA_INICIAL,
    ...(solicitud
      ? Object.fromEntries(
          Object.entries(solicitud.camposExtra).map(([k, v]) => [
            k,
            typeof v === 'boolean' ? v : String(v ?? ''),
          ]),
        )
      : {}),
  });
  const [files, setFiles] = useState<File[]>([]);
  const [duplicados, setDuplicados] = useState<SolicitudListItem[]>([]);

  const subcategorias = useMemo(
    () => categorias.find((c) => c.id === categoriaId)?.subcategorias ?? [],
    [categorias, categoriaId],
  );

  // T-090: aviso NO bloqueante de duplicados al elegir local (paso 2).
  useEffect(() => {
    if (!localId || !tipo) return;
    let alive = true;
    void checkDuplicadosAction(localId, tipo).then((items) => {
      if (alive) setDuplicados(items.filter((d) => d.id !== solicitud?.id));
    });
    return () => {
      alive = false;
    };
  }, [localId, tipo, solicitud?.id]);

  const setX = <K extends keyof CamposExtraState>(k: K, v: CamposExtraState[K]) =>
    setExtra((prev) => ({ ...prev, [k]: v }));

  const necesitaFechas = tipo === 'evento';

  const validarPaso = (n: number): string | null => {
    if (n === 1) {
      if (tipo !== 'otro' && (!categoriaId || !subcategoriaId)) {
        return 'Selecciona categoría y subcategoría.';
      }
      return null;
    }
    if (n === 2) {
      if (!localId) return 'Selecciona un local.';
      if (!titulo.trim()) return 'El título es obligatorio.';
      if (!descripcion.trim()) return 'La descripción es obligatoria.';
      if (tipo === 'mantenimiento' && !extra.area_afectada.trim()) {
        return 'Indica el área afectada.';
      }
      if (tipo === 'evento') {
        if (!Number(extra.asistentes_estimados)) return 'Indica los asistentes estimados.';
        if (!fechaInicio || !fechaFin) return 'Indica las fechas del evento.';
      }
      if (tipo === 'remodelacion') {
        if (!extra.fecha_inicio_estimada) return 'Indica la fecha de inicio estimada.';
        if (!Number(extra.duracion_dias)) return 'Indica la duración en días.';
        if (!extra.empresa_constructora.trim()) return 'Indica la empresa constructora.';
        if (extra.monto_presupuesto === '') return 'Indica el monto del presupuesto.';
      }
      if (tipo === 'otro') {
        if (!extra.categoria_libre.trim()) return 'Indica la categoría libre.';
        if (!extra.descripcion_larga.trim()) return 'Completa la descripción larga.';
      }
      return null;
    }
    return null;
  };

  const avanzar = () => {
    const error = validarPaso(step);
    if (error) {
      toast.error(error);
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const buildCamposExtra = (): Record<string, unknown> => {
    switch (tipo) {
      case 'mantenimiento':
        return {
          area_afectada: extra.area_afectada,
          requiere_ingreso_a_local: extra.requiere_ingreso_a_local,
        };
      case 'evento':
        return {
          asistentes_estimados: Number(extra.asistentes_estimados),
          requiere_corte_calle: extra.requiere_corte_calle,
          requiere_amplificacion: extra.requiere_amplificacion,
        };
      case 'remodelacion':
        return {
          fecha_inicio_estimada: extra.fecha_inicio_estimada,
          duracion_dias: Number(extra.duracion_dias),
          empresa_constructora: extra.empresa_constructora,
          monto_presupuesto: Number(extra.monto_presupuesto),
        };
      case 'otro':
        return {
          categoria_libre: extra.categoria_libre,
          descripcion_larga: extra.descripcion_larga,
        };
    }
  };

  const onSubmit = async (enviarAhora: boolean) => {
    const error = validarPaso(1) ?? validarPaso(2);
    if (error) {
      toast.error(error);
      return;
    }
    setSubmitting(true);
    const payload = {
      localId,
      tipo,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      categoriaId: tipo === 'otro' ? undefined : categoriaId,
      subcategoriaId: tipo === 'otro' ? undefined : subcategoriaId,
      fechaEventoInicio: fechaInicio || undefined,
      fechaEventoFin: fechaFin || undefined,
      horaInicio: horaInicio || undefined,
      horaFin: horaFin || undefined,
      camposExtra: buildCamposExtra(),
    };

    let id = solicitud?.id;
    if (editMode && id) {
      const r = await updateSolicitudAction(
        id,
        payload as Parameters<typeof updateSolicitudAction>[1],
      );
      if (!r.ok) {
        setSubmitting(false);
        toast.error(r.error);
        return;
      }
    } else {
      const r = await createSolicitudAction(payload as Parameters<typeof createSolicitudAction>[0]);
      if (!r.ok || !r.data) {
        setSubmitting(false);
        toast.error(r.ok ? 'Error inesperado' : r.error);
        return;
      }
      id = r.data.id;
      // Adjuntos del paso 3 (máx 10).
      for (const file of files) {
        const fd = new FormData();
        fd.set('file', file);
        const up = await subirAdjuntoSolicitudAction(id, fd);
        if (!up.ok) toast.error(`Adjunto "${file.name}": ${up.error}`);
      }
    }

    if (enviarAhora && id) {
      const r = await enviarSolicitudAction(id);
      if (!r.ok) {
        setSubmitting(false);
        toast.error(`Guardada como borrador, pero no se pudo enviar: ${r.error}`);
        router.push(`/inquilino/solicitudes/${id}`);
        return;
      }
    }
    setSubmitting(false);
    toast.success(
      enviarAhora ? 'Solicitud enviada: quedó en cola de asignación' : 'Borrador guardado',
    );
    router.push(`/inquilino/solicitudes/${id}`);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Indicador de pasos */}
      <ol className="flex gap-2 text-sm">
        {['Tipo y categoría', 'Detalles', 'Adjuntos y revisión'].map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 ${
              step === i + 1 ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {duplicados.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Ya existe una solicitud reciente similar:{' '}
          {duplicados.map((d) => d.codigo).join(', ')}. Puedes continuar de todas formas.
        </div>
      )}

      <div className="rounded-lg border bg-white p-6">
        {step === 1 && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Tipo de solicitud *</Label>
              <select
                className={selectClass}
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value as SolicitudTipo);
                  setCategoriaId('');
                  setSubcategoriaId('');
                }}
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {tipo !== 'otro' ? (
              <>
                <div className="grid gap-1.5">
                  <Label>Categoría *</Label>
                  <select
                    className={selectClass}
                    value={categoriaId}
                    onChange={(e) => {
                      setCategoriaId(e.target.value);
                      setSubcategoriaId('');
                    }}
                  >
                    <option value="">Selecciona…</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Subcategoría *</Label>
                  <select
                    className={selectClass}
                    value={subcategoriaId}
                    onChange={(e) => setSubcategoriaId(e.target.value)}
                    disabled={!categoriaId}
                  >
                    <option value="">Selecciona…</option>
                    {subcategorias.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} (prioridad {s.prioridad})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">
                Para «Otro» describirás la categoría libremente en el siguiente paso.
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Local *</Label>
              <select
                className={selectClass}
                value={localId}
                onChange={(e) => setLocalId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {locales.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Título *</Label>
              <Input maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Descripción *</Label>
              <textarea
                rows={4}
                maxLength={4000}
                className="rounded-md border border-input bg-white px-3 py-2 text-sm"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>

            {necesitaFechas && (
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Fecha inicio *</Label>
                  <Input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Fecha fin *</Label>
                  <Input
                    type="date"
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Hora inicio</Label>
                  <Input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Hora fin</Label>
                  <Input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
                </div>
              </div>
            )}

            {/* Campos extra dinámicos por tipo (T-079) */}
            {tipo === 'mantenimiento' && (
              <div className="grid gap-3 rounded-md border bg-gray-50 p-4">
                <div className="grid gap-1.5">
                  <Label>Área afectada *</Label>
                  <Input
                    maxLength={200}
                    value={extra.area_afectada}
                    onChange={(e) => setX('area_afectada', e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={extra.requiere_ingreso_a_local}
                    onChange={(e) => setX('requiere_ingreso_a_local', e.target.checked)}
                  />
                  Requiere ingreso al local
                </label>
              </div>
            )}
            {tipo === 'evento' && (
              <div className="grid gap-3 rounded-md border bg-gray-50 p-4">
                <div className="grid gap-1.5">
                  <Label>Asistentes estimados *</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={extra.asistentes_estimados}
                    onChange={(e) => setX('asistentes_estimados', e.target.value)}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={extra.requiere_corte_calle}
                    onChange={(e) => setX('requiere_corte_calle', e.target.checked)}
                  />
                  Requiere corte de calle
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={extra.requiere_amplificacion}
                    onChange={(e) => setX('requiere_amplificacion', e.target.checked)}
                  />
                  Requiere amplificación
                </label>
              </div>
            )}
            {tipo === 'remodelacion' && (
              <div className="grid gap-3 rounded-md border bg-gray-50 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label>Fecha inicio estimada *</Label>
                    <Input
                      type="date"
                      value={extra.fecha_inicio_estimada}
                      onChange={(e) => setX('fecha_inicio_estimada', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Duración (días) *</Label>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={extra.duracion_dias}
                      onChange={(e) => setX('duracion_dias', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Empresa constructora *</Label>
                  <Input
                    maxLength={160}
                    value={extra.empresa_constructora}
                    onChange={(e) => setX('empresa_constructora', e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Monto presupuesto (USD) *</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={extra.monto_presupuesto}
                    onChange={(e) => setX('monto_presupuesto', e.target.value)}
                  />
                </div>
              </div>
            )}
            {tipo === 'otro' && (
              <div className="grid gap-3 rounded-md border bg-gray-50 p-4">
                <div className="grid gap-1.5">
                  <Label>Categoría libre *</Label>
                  <Input
                    maxLength={120}
                    value={extra.categoria_libre}
                    onChange={(e) => setX('categoria_libre', e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Descripción larga *</Label>
                  <textarea
                    rows={4}
                    maxLength={4000}
                    className="rounded-md border border-input bg-white px-3 py-2 text-sm"
                    value={extra.descripcion_larga}
                    onChange={(e) => setX('descripcion_larga', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-4">
            {!editMode && (
              <div className="grid gap-1.5">
                <Label>Adjuntos (máx {MAX_ADJUNTOS})</Label>
                <input
                  type="file"
                  multiple
                  className="text-sm"
                  onChange={(e) => {
                    const nuevos = Array.from(e.target.files ?? []);
                    setFiles((prev) => [...prev, ...nuevos].slice(0, MAX_ADJUNTOS));
                  }}
                />
                {files.length > 0 && (
                  <ul className="text-sm text-gray-600">
                    {files.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center justify-between">
                        <span>
                          {f.name} ({Math.ceil(f.size / 1024)} KB)
                        </span>
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                        >
                          quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="rounded-md border bg-gray-50 p-4 text-sm">
              <p className="mb-2 font-medium text-gray-900">Revisión</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
                <dt>Tipo</dt>
                <dd>{TIPOS.find((t) => t.value === tipo)?.label}</dd>
                <dt>Local</dt>
                <dd>{locales.find((l) => l.id === localId)?.codigo ?? '—'}</dd>
                <dt>Título</dt>
                <dd>{titulo || '—'}</dd>
                {tipo !== 'otro' && (
                  <>
                    <dt>Subcategoría</dt>
                    <dd>{subcategorias.find((s) => s.id === subcategoriaId)?.nombre ?? '—'}</dd>
                  </>
                )}
              </dl>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={step === 1 || submitting}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
        >
          Atrás
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={avanzar}>
            Siguiente
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => void onSubmit(false)}
            >
              {editMode ? 'Guardar cambios' : 'Guardar borrador'}
            </Button>
            {!editMode && (
              <Button type="button" disabled={submitting} onClick={() => void onSubmit(true)}>
                {submitting ? 'Enviando…' : 'Enviar ahora'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
