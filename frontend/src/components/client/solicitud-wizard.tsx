'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import type {
  Asistente,
  SolicitudDetailOutput,
  SolicitudListItem,
  SolicitudTipo,
} from '@app/contracts';
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

/**
 * T-V20: tipos de solicitud configurables por plaza.
 * `codigo` es el valor canónico (mismo que el enum `solicitud_tipo` de BD);
 * `etiqueta` es el label visible que el admin controla. La discriminada union
 * de `campos_extra` se ramifica por `codigo` (no por etiqueta).
 */
export interface TipoOption {
  codigo: SolicitudTipo;
  etiqueta: string;
}

const selectClass = 'select';
const MAX_ADJUNTOS = 10;
const MAX_ASISTENTES = 10; // T-V21
const PASOS = ['Tipo y categoría', 'Detalles', 'Adjuntos y revisión'];

interface CamposExtraState {
  // mantenimiento
  area_afectada: string;
  requiere_ingreso_a_local: boolean;
  // bloque asistentes (T-V21, transversal a los 4 tipos).
  // `asistentes` es un map indexado: permite editar el item 3 sin tocar los
  // anteriores cuando N se reduce. La lista final al enviar se deriva con
  // `Object.values(asistentes).slice(0, numAsistentes)`.
  asistentes_estimados: string;
  asistentes: Record<number, Asistente>;
  // evento
  requiere_corte_calle: boolean;
  requiere_amplificacion: boolean;
  // remodelacion
  fecha_inicio_estimada: string;
  duracion_dias: string;
  empresa_constructora: string;
  monto_presupuesto: string;
}

const CAMPOS_EXTRA_INICIAL: CamposExtraState = {
  area_afectada: '',
  requiere_ingreso_a_local: false,
  asistentes_estimados: '',
  asistentes: {},
  requiere_corte_calle: false,
  requiere_amplificacion: false,
  fecha_inicio_estimada: '',
  duracion_dias: '',
  empresa_constructora: '',
  monto_presupuesto: '',
};

/**
 * Wizard de solicitud (T-088, sin paso de recurrencia — T-V05):
 *   1. Tipo y categoría/subcategoría
 *   2. Local + detalles + campos extra dinámicos por tipo
 *   3. Adjuntos (máx 10) y revisión → "Guardar borrador" o "Enviar ahora"
 * En modo edición (`solicitud` presente) hace PATCH y omite adjuntos (tab propia).
 */
/** T-132: pre-relleno desde el calendario (tipo + slot clickeado). */
export interface WizardPrefill {
  tipo?: SolicitudTipo;
  fecha?: string;
  hora?: string;
  localId?: string;
}

export function SolicitudWizard({
  categorias,
  locales,
  tipos,
  solicitud,
  prefill,
}: {
  categorias: CategoriaOption[];
  locales: LocalOption[];
  tipos: TipoOption[];
  solicitud?: SolicitudDetailOutput;
  prefill?: WizardPrefill;
}) {
  const router = useRouter();
  const editMode = Boolean(solicitud);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // T-V20: el default prioriza el tipo del borrador > prefill > primer tipo
  // activo configurado para la plaza. Si el prefill apunta a un tipo ahora
  // desactivado, cae al primer activo (en el peor caso, 'mantenimiento').
  const tiposCodigos = useMemo(() => new Set(tipos.map((t) => t.codigo)), [tipos]);
  const tipoInicial: SolicitudTipo = (() => {
    if (solicitud?.tipo) return solicitud.tipo;
    if (prefill?.tipo && tiposCodigos.has(prefill.tipo)) return prefill.tipo;
    return tipos[0]?.codigo ?? 'mantenimiento';
  })();
  const [tipo, setTipo] = useState<SolicitudTipo>(tipoInicial);
  const [categoriaId, setCategoriaId] = useState(solicitud?.categoriaId ?? '');
  const [subcategoriaId, setSubcategoriaId] = useState(solicitud?.subcategoriaId ?? '');
  const [localId, setLocalId] = useState(solicitud?.localId ?? prefill?.localId ?? '');
  const [titulo, setTitulo] = useState(solicitud?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(solicitud?.descripcion ?? '');
  const [fechaInicio, setFechaInicio] = useState(
    solicitud?.fechaEventoInicio ?? prefill?.fecha ?? '',
  );
  const [fechaFin, setFechaFin] = useState(solicitud?.fechaEventoFin ?? prefill?.fecha ?? '');
  const [horaInicio, setHoraInicio] = useState(solicitud?.horaInicio ?? prefill?.hora ?? '');
  const [horaFin, setHoraFin] = useState(solicitud?.horaFin ?? '');
  const [extra, setExtra] = useState<CamposExtraState>(() => {
    const base: CamposExtraState = { ...CAMPOS_EXTRA_INICIAL };
    if (!solicitud) return base;
    // T-V21: hidratamos asistentes como Record<index, Asistente>; el resto
    // se aplana desde JSONB a string|boolean según el tipo de valor.
    const parsed: Partial<CamposExtraState> = {};
    for (const [k, v] of Object.entries(solicitud.camposExtra)) {
      if (k === 'asistentes' && Array.isArray(v)) {
        const map: Record<number, Asistente> = {};
        (v as Asistente[]).forEach((a, i) => {
          map[i] = { nombre: a.nombre ?? '', documento: a.documento ?? '' };
        });
        parsed.asistentes = map;
      } else if (typeof v === 'boolean') {
        (parsed as Record<string, unknown>)[k] = v;
      } else {
        (parsed as Record<string, unknown>)[k] = String(v ?? '');
      }
    }
    return { ...base, ...parsed };
  });
  const [files, setFiles] = useState<File[]>([]);
  const [duplicados, setDuplicados] = useState<SolicitudListItem[]>([]);

  const subcategorias = useMemo(
    () => categorias.find((c) => c.id === categoriaId)?.subcategorias ?? [],
    [categorias, categoriaId],
  );

  // T-V21: el número de asistentes se deriva del input. La lista de items
  // editados es un `Record<index, Asistente>` en el estado: la entrada i
  // existe solo si el usuario escribió algo en ella. Al renderizar y al
  // enviar, derivamos la lista "completa" con `Object.values(asistentes)`.
  // No usamos un useEffect para "sincronizar" → evitamos el cascading render
  // que el linter marca como antipatrón.
  const numAsistentes = useMemo(() => {
    const n = Number(extra.asistentes_estimados);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(MAX_ASISTENTES, Math.floor(n));
  }, [extra.asistentes_estimados]);

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

  const validarAsistentes = (): string | null => {
    if (numAsistentes === 0) return null;
    for (let i = 0; i < numAsistentes; i += 1) {
      const a = extra.asistentes[i] ?? { nombre: '', documento: '' };
      if (!a.nombre.trim() || !a.documento.trim()) {
        return `Completa el nombre y documento del asistente ${i + 1}.`;
      }
      if (a.documento.trim().length < 3 || a.documento.trim().length > 20) {
        return `El documento del asistente ${i + 1} debe tener entre 3 y 20 caracteres.`;
      }
    }
    return null;
  };

  const validarPaso = (n: number): string | null => {
    if (n === 1) {
      // T-V21: categoría + subcategoría obligatorias para TODO tipo (antes 'otro' exento).
      if (!categoriaId || !subcategoriaId) {
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
        // En evento el N mínimo es 1 (validado por Zod), pero el input puede
        // estar vacío. Validamos acá también para mejor UX.
        if (!Number(extra.asistentes_estimados) || numAsistentes < 1) {
          return 'Indica al menos 1 asistente estimado.';
        }
        if (!fechaInicio || !fechaFin) return 'Indica las fechas del evento.';
      }
      if (tipo === 'remodelacion') {
        if (!extra.fecha_inicio_estimada) return 'Indica la fecha de inicio estimada.';
        if (!Number(extra.duracion_dias)) return 'Indica la duración en días.';
        if (!extra.empresa_constructora.trim()) return 'Indica la empresa constructora.';
        if (extra.monto_presupuesto === '') return 'Indica el monto del presupuesto.';
      }
      // T-V21: validación transversal de la lista de asistentes (aplica a
      // los 4 tipos si N>0; en evento siempre N>=1).
      const errAsistentes = validarAsistentes();
      if (errAsistentes) return errAsistentes;
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
    // T-V21: derivamos la lista del Record<index, Asistente> → array indexado
    // 0..numAsistentes-1. Si el usuario nunca tocó el item i, queda {nombre:'', documento:''}
    // y la validación de paso 2 lo bloquea antes de enviar.
    const listaAsistentes: Asistente[] = Array.from({ length: numAsistentes }, (_, i) => ({
      nombre: extra.asistentes[i]?.nombre ?? '',
      documento: extra.asistentes[i]?.documento ?? '',
    }));
    const bloqueAsistentes = {
      asistentes_estimados: numAsistentes,
      asistentes: listaAsistentes,
    };
    switch (tipo) {
      case 'mantenimiento':
        return {
          area_afectada: extra.area_afectada,
          requiere_ingreso_a_local: extra.requiere_ingreso_a_local,
          ...bloqueAsistentes,
        };
      case 'evento':
        return {
          ...bloqueAsistentes,
          requiere_corte_calle: extra.requiere_corte_calle,
          requiere_amplificacion: extra.requiere_amplificacion,
        };
      case 'remodelacion':
        return {
          fecha_inicio_estimada: extra.fecha_inicio_estimada,
          duracion_dias: Number(extra.duracion_dias),
          empresa_constructora: extra.empresa_constructora,
          monto_presupuesto: Number(extra.monto_presupuesto),
          ...bloqueAsistentes,
        };
      case 'otro':
        // T-V21 (Interpretación B): 'otro' ya no tiene categoria_libre/
        // descripcion_larga; se compone SOLO del bloque de asistentes.
        return bloqueAsistentes;
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
      // T-V21: cat/sub obligatorios para TODO tipo.
      categoriaId,
      subcategoriaId,
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
      {/* Indicador de pasos (stepper) */}
      <div className="stepper">
        {PASOS.map((label, i) => {
          const n = i + 1;
          const cls = step === n ? 'step active' : step > n ? 'step done' : 'step';
          return (
            <Fragment key={label}>
              <div className={cls}>
                <div className="num">{step > n ? <Check className="h-4 w-4" /> : n}</div>
                <div className="lab">
                  <b>{label}</b>
                  <span>Paso {n}</span>
                </div>
              </div>
              {i < PASOS.length - 1 && (
                <div className={`step-line${step > n ? ' done-line' : ''}`} />
              )}
            </Fragment>
          );
        })}
      </div>

      {duplicados.length > 0 && (
        <div className="banner banner-warn">
          Ya existe una solicitud reciente similar: {duplicados.map((d) => d.codigo).join(', ')}.
          Puedes continuar de todas formas.
        </div>
      )}

      <div className="card card-pad">
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
                {tipos.map((t) => (
                  <option key={t.codigo} value={t.codigo}>
                    {t.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            {/* T-V21: categoría y subcategoría obligatorias para TODO tipo
                (antes 'otro' se eximía y describía la categoría en texto libre). */}
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
                className="textarea"
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
              <div className="wz-extra">
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
              <div className="wz-extra">
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
              <div className="wz-extra">
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
            {/* T-V21: bloque de asistentes transversal a los 4 tipos. En 'evento'
                el N mínimo es 1 (validado por Zod al guardar y por
                validarAsistentes al avanzar); en los demás tipos N es opcional. */}
            <BloqueAsistentes
              tipo={tipo}
              estimados={extra.asistentes_estimados}
              onChangeEstimados={(v) => setX('asistentes_estimados', v)}
              lista={extra.asistentes}
              onChangeLista={(v) => setX('asistentes', v)}
            />
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
            <div className="wz-extra text-sm">
              <p className="mb-1 font-semibold" style={{ color: 'var(--text)' }}>
                Revisión
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1" style={{ color: 'var(--text-2)' }}>
                <dt>Tipo</dt>
                <dd>{tipos.find((t) => t.codigo === tipo)?.etiqueta ?? tipo}</dd>
                <dt>Local</dt>
                <dd>{locales.find((l) => l.id === localId)?.codigo ?? '—'}</dd>
                <dt>Título</dt>
                <dd>{titulo || '—'}</dd>
                {/* T-V21: subcategoría visible para TODO tipo (antes 'otro' la ocultaba). */}
                <dt>Subcategoría</dt>
                <dd>{subcategorias.find((s) => s.id === subcategoriaId)?.nombre ?? '—'}</dd>
                {numAsistentes > 0 && (
                  <>
                    <dt>Asistentes</dt>
                    <dd>
                      {numAsistentes} (
                      {Array.from({ length: numAsistentes }, (_, i) =>
                        extra.asistentes[i]?.nombre || `Asistente ${i + 1}`,
                      ).join(', ')}
                      )
                    </dd>
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

// ── Sub-componente: bloque de asistentes (T-V21) ──────────────────────────────

interface BloqueAsistentesProps {
  tipo: SolicitudTipo;
  estimados: string;
  onChangeEstimados: (v: string) => void;
  lista: Record<number, Asistente>;
  onChangeLista: (v: Record<number, Asistente>) => void;
}

/**
 * T-V21: pide nombre + documento de cada asistente según la cantidad estimada.
 *
 *  - `evento` exige mínimo 1 (Zod en el schema).
 *  - `mantenimiento | remodelacion | otro` permiten 0 (campo opcional).
 *  - Tope `MAX_ASISTENTES` = 10 (alineado con el schema).
 *  - El padre guarda los items como `Record<index, Asistente>` (no como array)
 *    para que cambiar el número N no descarte lo que el usuario ya escribió.
 */
function BloqueAsistentes({
  tipo,
  estimados,
  onChangeEstimados,
  lista,
  onChangeLista,
}: BloqueAsistentesProps) {
  const esEvento = tipo === 'evento';
  const num = Math.max(0, Math.min(MAX_ASISTENTES, Math.floor(Number(estimados) || 0)));

  const updateAsistente = (i: number, patch: { nombre?: string; documento?: string }) => {
    const prev = lista[i] ?? { nombre: '', documento: '' };
    onChangeLista({ ...lista, [i]: { ...prev, ...patch } });
  };

  return (
    <div className="wz-extra">
      <div className="grid gap-1.5">
        <Label htmlFor="asistentes-estimados">
          Asistentes estimados {esEvento ? '*' : ''}
        </Label>
        <Input
          id="asistentes-estimados"
          type="number"
          min={esEvento ? 1 : 0}
          max={MAX_ASISTENTES}
          value={estimados}
          onChange={(e) => onChangeEstimados(e.target.value)}
          style={{ width: 160 }}
        />
        <p className="text-xs text-gray-500">
          {esEvento
            ? `Obligatorio (mínimo 1, máximo ${MAX_ASISTENTES}). Si supera el umbral configurado por la plaza, requerirá aprobación especial.`
            : `Opcional. Si lo completas, se solicitará el nombre y documento de cada uno (máximo ${MAX_ASISTENTES}).`}
        </p>
      </div>

      {num > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            <UserPlus className="mr-1 inline h-4 w-4" />
            Detalle de asistentes ({num})
          </p>
          <ul className="grid gap-2">
            {Array.from({ length: num }, (_, i) => {
              const a = lista[i] ?? { nombre: '', documento: '' };
              return (
                <li
                  key={i}
                  className="grid grid-cols-1 gap-2 rounded-md border border-gray-200 p-3 md:grid-cols-2"
                >
                  <div className="grid gap-1.5">
                    <Label htmlFor={`asistente-${i}-nombre`}>Nombre *</Label>
                    <Input
                      id={`asistente-${i}-nombre`}
                      maxLength={120}
                      value={a.nombre}
                      onChange={(e) => updateAsistente(i, { nombre: e.target.value })}
                      placeholder={`Asistente ${i + 1}`}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`asistente-${i}-documento`}>Documento *</Label>
                    <Input
                      id={`asistente-${i}-documento`}
                      minLength={3}
                      maxLength={20}
                      value={a.documento}
                      onChange={(e) => updateAsistente(i, { documento: e.target.value })}
                      placeholder="DUI, NIT, pasaporte…"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {num === 0 && esEvento && (
        <p className="text-xs text-amber-700">
          <X className="mr-1 inline h-3 w-3" />
          Para enviar un evento debés indicar al menos 1 asistente.
        </p>
      )}
    </div>
  );
}
