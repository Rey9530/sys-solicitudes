'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, UploadCloud, FileText, Image as ImageIcon, AlertCircle, UserPlus, X } from 'lucide-react';
import { useDropzone, type FileRejection } from 'react-dropzone';
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
import { confirmAction } from '@/lib/sweetalert';
import {
  MAX_PERSONAL,
  MIN_PERSONAL,
  emailBasicoValido,
  maxFechaFinEmergencia,
  maxFechaFinEstandar,
  minFechaInicioEstandar,
  telefonoBasicoValido,
  validarRangoFechas,
} from '@/lib/solicitud-fechas';

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
// T-V22: límites del módulo 08 (adjuntos). Espejan al backend (S-TamañoMax /
// S-MimeTypes). El backend vuelve a validar en ZodValidationPipe; aquí solo
// damos feedback rápido al usuario.
const MAX_ADJUNTO_BYTES = 25 * 1024 * 1024; // 25 MB
const ADJUNTO_MIME_PERMITIDOS: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};
const MAX_PERSONAL_WIZARD = MAX_PERSONAL; // T-V22: 1-20 (antes 0-10)
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
  // T-V22: bloque transversal de empresa ejecutante + contacto de emergencia.
  const [empresaNombre, setEmpresaNombre] = useState(solicitud?.empresaNombre ?? '');
  const [empresaResponsable, setEmpresaResponsable] = useState(solicitud?.empresaResponsable ?? '');
  const [empresaTelefono, setEmpresaTelefono] = useState(solicitud?.empresaTelefono ?? '');
  const [empresaEmail, setEmpresaEmail] = useState(solicitud?.empresaEmail ?? '');
  const [emergenciaContacto, setEmergenciaContacto] = useState(solicitud?.emergenciaContacto ?? '');
  const [emergenciaTelefono, setEmergenciaTelefono] = useState(solicitud?.emergenciaTelefono ?? '');
  // T-V22: modo emergencia (S-SO-Emergencia). Reduce lead time y permite hasta
  // 3 permisos/mes. Se valida en backend con PERMISO_EMERGENCIA_LIMITE.
  const [esEmergencia, setEsEmergencia] = useState<boolean>(solicitud?.esEmergencia ?? false);
  // T-V22: momento de elaboración del permiso, congelado al montar el wizard
  // para que el "ahora + 48h" y "ahora + 7d" no cambien al refrescar la pantalla.
  const [momentoElaboracion] = useState(() => new Date());
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
    return Math.min(MAX_PERSONAL_WIZARD, Math.floor(n));
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

  /**
   * T-V22: abre el modal SweetAlert cuando el usuario quiere activar el modo
   * emergencia. Si cancela, no se aplica. Si confirma, sí.
   */
  const handleEmergenciaToggle = async (next: boolean) => {
    if (!next) {
      setEsEmergencia(false);
      return;
    }
    const ok = await confirmAction({
      title: 'Modo emergencia',
      text: 'Solamente tiene un máximo de 3 permisos de emergencia al mes.',
      icon: 'info',
      confirmButtonText: 'Entendido',
      cancelButtonText: 'Cancelar',
    });
    if (ok) setEsEmergencia(true);
  };

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

  /** T-V22: lista legible de campos_extra específicos del tipo (paso 3). */
  const renderCamposExtraResumen = (): React.ReactNode => {
    const rows: Array<[string, string]> = [];
    switch (tipo) {
      case 'mantenimiento':
        if (extra.area_afectada) rows.push(['Área afectada', extra.area_afectada]);
        rows.push(['Requiere ingreso al local', extra.requiere_ingreso_a_local ? 'Sí' : 'No']);
        break;
      case 'evento':
        rows.push(['Requiere corte de calle', extra.requiere_corte_calle ? 'Sí' : 'No']);
        rows.push(['Requiere amplificación', extra.requiere_amplificacion ? 'Sí' : 'No']);
        break;
      case 'remodelacion':
        if (extra.fecha_inicio_estimada)
          rows.push(['Fecha inicio estimada', extra.fecha_inicio_estimada]);
        if (extra.duracion_dias) rows.push(['Duración (días)', extra.duracion_dias]);
        if (extra.empresa_constructora)
          rows.push(['Empresa constructora', extra.empresa_constructora]);
        if (extra.monto_presupuesto)
          rows.push(['Monto presupuesto (USD)', extra.monto_presupuesto]);
        break;
      case 'otro':
      default:
        break;
    }
    return rows.map(([k, v]) => (
      <Fragment key={k}>
        <dt>{k}</dt>
        <dd>{v}</dd>
      </Fragment>
    ));
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

      // T-V22: fechas obligatorias y validadas dinámicamente para TODO tipo.
      if (!fechaInicio || !fechaFin || !horaInicio || !horaFin) {
        return 'Indica fecha y hora de inicio y fin del permiso.';
      }
      const errFechas = validarRangoFechas(
        fechaInicio,
        fechaFin,
        horaInicio,
        horaFin,
        esEmergencia,
        momentoElaboracion,
      );
      if (errFechas) return errFechas;

      // T-V22: bloque transversal de empresa ejecutante.
      if (!empresaNombre.trim()) return 'Indica el nombre de la empresa ejecutante.';
      if (!empresaResponsable.trim()) return 'Indica el responsable de la empresa.';
      if (!empresaTelefono.trim()) return 'Indica el teléfono de la empresa ejecutante.';
      if (!telefonoBasicoValido(empresaTelefono)) return 'Teléfono de empresa inválido (8-20 dígitos).';
      if (!empresaEmail.trim()) return 'Indica el email de la empresa ejecutante.';
      if (!emailBasicoValido(empresaEmail)) return 'Email de empresa inválido.';
      if (!emergenciaContacto.trim()) return 'Indica el contacto de emergencia.';
      if (!emergenciaTelefono.trim()) return 'Indica el teléfono de emergencia.';
      if (!telefonoBasicoValido(emergenciaTelefono)) return 'Teléfono de emergencia inválido (8-20 dígitos).';

      // T-V22: asistentes_estimados ahora 1-20 para todos los tipos.
      if (!Number(extra.asistentes_estimados) || numAsistentes < MIN_PERSONAL) {
        return `Indica al menos ${MIN_PERSONAL} persona de personal.`;
      }
      if (numAsistentes > MAX_PERSONAL) {
        return `El máximo de personal es ${MAX_PERSONAL}.`;
      }

      if (tipo === 'mantenimiento' && !extra.area_afectada.trim()) {
        return 'Indica el área afectada.';
      }
      if (tipo === 'remodelacion') {
        if (!extra.fecha_inicio_estimada) return 'Indica la fecha de inicio estimada.';
        if (!Number(extra.duracion_dias)) return 'Indica la duración en días.';
        if (!extra.empresa_constructora.trim()) return 'Indica la empresa constructora.';
        if (extra.monto_presupuesto === '') return 'Indica el monto del presupuesto.';
      }
      // T-V21/T-V22: validación transversal de la lista de asistentes (aplica a
      // los 4 tipos si N>0).
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
      // T-V22: fechas siempre obligatorias para todo tipo.
      fechaEventoInicio: fechaInicio,
      fechaEventoFin: fechaFin,
      horaInicio,
      horaFin,
      // T-V22: bloque transversal empresa ejecutante + modo emergencia.
      empresaNombre: empresaNombre.trim(),
      empresaResponsable: empresaResponsable.trim(),
      empresaTelefono: empresaTelefono.trim(),
      empresaEmail: empresaEmail.trim(),
      emergenciaContacto: emergenciaContacto.trim(),
      emergenciaTelefono: emergenciaTelefono.trim(),
      esEmergencia,
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

            {/* T-V22: bloque transversal de empresa ejecutante (aplica a los 4 tipos). */}
            <div className="wz-extra">
              <p
                className="mb-1 text-sm font-semibold"
                style={{ color: 'var(--text)' }}
              >
                Datos de la empresa ejecutante
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="empresa-nombre">Nombre de la empresa *</Label>
                  <Input
                    id="empresa-nombre"
                    maxLength={160}
                    value={empresaNombre}
                    onChange={(e) => setEmpresaNombre(e.target.value)}
                    placeholder="Razón social o nombre comercial"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="empresa-responsable">Responsable *</Label>
                  <Input
                    id="empresa-responsable"
                    maxLength={160}
                    value={empresaResponsable}
                    onChange={(e) => setEmpresaResponsable(e.target.value)}
                    placeholder="Persona responsable en sitio"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="empresa-telefono">Teléfono *</Label>
                  <Input
                    id="empresa-telefono"
                    maxLength={20}
                    value={empresaTelefono}
                    onChange={(e) => setEmpresaTelefono(e.target.value)}
                    placeholder="+503 7000 0000"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="empresa-email">Correo electrónico *</Label>
                  <Input
                    id="empresa-email"
                    type="email"
                    maxLength={254}
                    value={empresaEmail}
                    onChange={(e) => setEmpresaEmail(e.target.value)}
                    placeholder="contacto@empresa.com"
                  />
                </div>
              </div>
              <p
                className="mt-2 text-sm font-semibold"
                style={{ color: 'var(--text)' }}
              >
                Contacto en caso de emergencia
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="emergencia-contacto">Persona de contacto *</Label>
                  <Input
                    id="emergencia-contacto"
                    maxLength={160}
                    value={emergenciaContacto}
                    onChange={(e) => setEmergenciaContacto(e.target.value)}
                    placeholder="Nombre y apellido"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="emergencia-telefono">Teléfono de emergencia *</Label>
                  <Input
                    id="emergencia-telefono"
                    maxLength={20}
                    value={emergenciaTelefono}
                    onChange={(e) => setEmergenciaTelefono(e.target.value)}
                    placeholder="+503 7000 0000"
                  />
                </div>
              </div>
            </div>

            {/* T-V22: fechas del permiso, siempre visibles para todo tipo.
                Los `min` y `max` se calculan en función del modo (estándar/emergencia)
                y del "momento de elaboración" capturado al montar. */}
            <div className="wz-extra">
              <p className="mb-1 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                Fechas del permiso
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Fecha inicio *</Label>
                  <Input
                    type="date"
                    value={fechaInicio}
                    min={esEmergencia ? undefined : minFechaInicioEstandar(momentoElaboracion)}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Fecha fin *</Label>
                  <Input
                    type="date"
                    value={fechaFin}
                    min={fechaInicio || undefined}
                    max={
                      esEmergencia
                        ? maxFechaFinEmergencia(momentoElaboracion)
                        : maxFechaFinEstandar(fechaInicio, momentoElaboracion)
                    }
                    onChange={(e) => setFechaFin(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Hora inicio *</Label>
                  <Input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Hora fin *</Label>
                  <Input
                    type="time"
                    value={horaFin}
                    onChange={(e) => setHoraFin(e.target.value)}
                  />
                </div>
              </div>
              {esEmergencia ? (
                <p className="mt-1 text-xs text-amber-700">
                  Modo emergencia activo: fechas desde hoy y máximo 7 días.
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  La fecha de inicio debe ser al menos 48 horas después de este momento; el permiso
                  puede durar hasta 7 días.
                </p>
              )}
              {/* T-V22: toggle de emergencia. SweetAlert pide confirmación al activarlo. */}
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={esEmergencia}
                  onChange={(e) => void handleEmergenciaToggle(e.target.checked)}
                />
                <span>
                  <b>Emergencia</b> — habilita fechas desde hoy (sin lead time de 48h) y permite
                  hasta 3 permisos/mes. El backend rechazará el 4º.
                </span>
              </label>
            </div>

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
                <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="mx-auto grid w-full max-w-3xl gap-4">
            {/* ── Bloque 1: Adjuntos (T-V22) ─────────────────────────── */}
            {!editMode && (
              <AdjuntosCard
                files={files}
                onAdd={(nuevos) =>
                  setFiles((prev) => [...prev, ...nuevos].slice(0, MAX_ADJUNTOS))
                }
                onRemove={(i) =>
                  setFiles((prev) => prev.filter((_, j) => j !== i))
                }
              />
            )}
            {/* ── Bloque 2: Resumen (apilado debajo) ─────────────────── */}
            <ResumenCard
              tipo={tipo}
              tipos={tipos}
              localId={localId}
              locales={locales}
              titulo={titulo}
              descripcion={descripcion}
              categoriaId={categoriaId}
              categorias={categorias}
              subcategoriaId={subcategoriaId}
              subcategorias={subcategorias}
              empresaNombre={empresaNombre}
              empresaResponsable={empresaResponsable}
              empresaTelefono={empresaTelefono}
              empresaEmail={empresaEmail}
              emergenciaContacto={emergenciaContacto}
              emergenciaTelefono={emergenciaTelefono}
              esEmergencia={esEmergencia}
              fechaInicio={fechaInicio}
              fechaFin={fechaFin}
              horaInicio={horaInicio}
              horaFin={horaFin}
              numAsistentes={numAsistentes}
              asistentes={extra.asistentes}
              camposExtraResumen={renderCamposExtraResumen()}
            />
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
 * T-V22: pide nombre + documento de cada persona del personal.
 *
 *  - Tope `MAX_PERSONAL_WIZARD` = 20 (antes 10 en T-V21).
 *  - Mínimo 1 para los 4 tipos (antes 0 para mantenimiento/remodelacion/otro).
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
  const num = Math.max(
    0,
    Math.min(MAX_PERSONAL_WIZARD, Math.floor(Number(estimados) || 0)),
  );

  const updateAsistente = (i: number, patch: { nombre?: string; documento?: string }) => {
    const prev = lista[i] ?? { nombre: '', documento: '' };
    onChangeLista({ ...lista, [i]: { ...prev, ...patch } });
  };

  return (
    <div className="wz-extra">
      <div className="grid gap-1.5">
        <Label htmlFor="asistentes-estimados">
          Cantidad de Personal *
        </Label>
        <Input
          id="asistentes-estimados"
          type="number"
          min={1}
          max={MAX_PERSONAL_WIZARD}
          value={estimados}
          onChange={(e) => onChangeEstimados(e.target.value)}
          className="w-full max-w-[10rem]"
        />
        <p className="text-xs text-gray-500">
          {esEvento
            ? `Obligatorio (mínimo 1, máximo ${MAX_PERSONAL_WIZARD}). Si supera el umbral configurado por la plaza, requerirá aprobación especial.`
            : `Obligatorio (mínimo 1, máximo ${MAX_PERSONAL_WIZARD}). Completa nombre y documento de cada persona.`}
        </p>
      </div>

      {num > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            <UserPlus className="mr-1 inline h-4 w-4" />
            Información del personal ({num})
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
                      placeholder={`Persona ${i + 1}`}
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

      {num === 0 && (
        <p className="text-xs text-amber-700">
          <X className="mr-1 inline h-3 w-3" />
          Indicá al menos 1 persona de personal.
        </p>
      )}
    </div>
  );
}

// ── Sub-componentes del paso 3 (T-V22: rediseño UX) ─────────────────────────

function formateaBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function iconoPorMime(tipo: string): React.ReactNode {
  if (tipo.startsWith('image/')) return <ImageIcon className="h-4 w-4" aria-hidden />;
  return <FileText className="h-4 w-4" aria-hidden />;
}

interface AdjuntosCardProps {
  files: File[];
  onAdd: (nuevos: File[]) => void;
  onRemove: (index: number) => void;
}

/** T-V22: dropzone visual para adjuntos. Usa react-dropzone (v15, ya en deps). */
function AdjuntosCard({ files, onAdd, onRemove }: AdjuntosCardProps) {
  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      // Reportar rechazos por MIME/tamaño con toast (el backend igual valida
      // en ZodValidationPipe, pero damos feedback inmediato).
      for (const r of rejections) {
        const first = r.errors[0];
        const msg =
          first?.code === 'file-too-large'
            ? `"${r.file.name}" excede 25 MB.`
            : first?.code === 'file-invalid-type'
              ? `"${r.file.name}" no es PDF, PNG, JPG o WebP.`
              : `"${r.file.name}" rechazado.`;
        toast.error(msg);
      }
      if (accepted.length > 0) onAdd(accepted);
    },
    [onAdd],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: MAX_ADJUNTO_BYTES,
    accept: ADJUNTO_MIME_PERMITIDOS,
    disabled: files.length >= MAX_ADJUNTOS,
  });

  const lleno = files.length >= MAX_ADJUNTOS;
  const restantes = MAX_ADJUNTOS - files.length;

  return (
    <section
      aria-labelledby="adjuntos-titulo"
      className="wz-extra flex flex-col gap-3 rounded-lg border p-4"
    >
      <header className="flex items-baseline justify-between">
        <h3 id="adjuntos-titulo" className="text-base font-semibold" style={{ color: 'var(--text)' }}>
          Adjuntos
        </h3>
        <span className="text-xs text-gray-500">
          {files.length} / {MAX_ADJUNTOS}
        </span>
      </header>

      {/* Dropzone */}
      <div
        {...getRootProps({
          className: [
            'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors',
            isDragReject
              ? 'border-red-400 bg-red-50'
              : isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:bg-gray-100',
            lleno ? 'pointer-events-none opacity-50' : 'cursor-pointer',
          ]
            .filter(Boolean)
            .join(' '),
        })}
        aria-label="Zona para arrastrar y soltar archivos adjuntos"
      >
        <input {...getInputProps()} />
        <UploadCloud
          className={
            isDragReject
              ? 'h-8 w-8 text-red-500'
              : isDragActive
                ? 'h-8 w-8 text-blue-600'
                : 'h-8 w-8 text-gray-400'
          }
          aria-hidden
        />
        {lleno ? (
          <p className="text-sm font-medium text-gray-700">
            Has alcanzado el máximo de {MAX_ADJUNTOS} adjuntos.
          </p>
        ) : isDragReject ? (
          <p className="text-sm font-medium text-red-700">
            Tipo de archivo no permitido
          </p>
        ) : isDragActive ? (
          <p className="text-sm font-medium text-blue-700">Suelta para añadir</p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700">
              Arrastra archivos aquí o{' '}
              <span className="text-blue-600 underline">haz clic para seleccionar</span>
            </p>
            <p className="text-xs text-gray-500">
              PDF, PNG, JPG o WebP · máx. 25 MB por archivo · {restantes} restantes
            </p>
          </>
        )}
      </div>

      {/* Lista de archivos seleccionados */}
      {files.length > 0 && (
        <ul className="grid gap-2" aria-label="Archivos seleccionados">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100 text-gray-600">
                {iconoPorMime(f.type)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800" title={f.name}>
                  {f.name}
                </p>
                <p className="text-xs text-gray-500">
                  {f.type || 'tipo desconocido'} · {formateaBytes(f.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                aria-label={`Quitar ${f.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-start gap-1.5 text-xs text-gray-500">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Los adjuntos son opcionales. Se subirán al bucket de la plaza al enviar
        la solicitud (modo borrador: solo al enviar).
      </p>
    </section>
  );
}

interface ResumenCardProps {
  tipo: SolicitudTipo;
  tipos: TipoOption[];
  localId: string;
  locales: LocalOption[];
  titulo: string;
  descripcion: string;
  categoriaId: string;
  categorias: CategoriaOption[];
  subcategoriaId: string;
  subcategorias: Array<{ id: string; nombre: string }>;
  empresaNombre: string;
  empresaResponsable: string;
  empresaTelefono: string;
  empresaEmail: string;
  emergenciaContacto: string;
  emergenciaTelefono: string;
  esEmergencia: boolean;
  fechaInicio: string;
  fechaFin: string;
  horaInicio: string;
  horaFin: string;
  numAsistentes: number;
  asistentes: Record<number, Asistente>;
  camposExtraResumen: React.ReactNode;
}

/** T-V22: tarjeta de revisión con secciones agrupadas por dominio. */
function ResumenCard(props: ResumenCardProps) {
  const {
    tipo,
    tipos,
    localId,
    locales,
    titulo,
    descripcion,
    categoriaId,
    categorias,
    subcategoriaId,
    subcategorias,
    empresaNombre,
    empresaResponsable,
    empresaTelefono,
    empresaEmail,
    emergenciaContacto,
    emergenciaTelefono,
    esEmergencia,
    fechaInicio,
    fechaFin,
    horaInicio,
    horaFin,
    numAsistentes,
    asistentes,
    camposExtraResumen,
  } = props;

  return (
    <section
      aria-labelledby="resumen-titulo"
      className="wz-extra flex flex-col gap-4 rounded-lg border p-4"
    >
      <header className="flex items-baseline justify-between">
        <h3
          id="resumen-titulo"
          className="text-base font-semibold"
          style={{ color: 'var(--text)' }}
        >
          Revisión
        </h3>
        <span className="text-xs text-gray-500">Verifica antes de enviar</span>
      </header>

      <Seccion titulo="Identificación">
        <Fila label="Tipo" value={tipos.find((t) => t.codigo === tipo)?.etiqueta ?? tipo} />
        <Fila label="Local" value={locales.find((l) => l.id === localId)?.codigo} />
        <Fila label="Título" value={titulo} />
        <Fila
          label="Descripción"
          value={
            <span className="whitespace-pre-wrap break-words">{descripcion}</span>
          }
        />
        <Fila
          label="Categoría"
          value={categorias.find((c) => c.id === categoriaId)?.nombre}
        />
        <Fila
          label="Subcategoría"
          value={subcategorias.find((s) => s.id === subcategoriaId)?.nombre}
        />
      </Seccion>

      <Seccion titulo="Empresa ejecutante">
        <Fila label="Empresa" value={empresaNombre} />
        <Fila label="Responsable" value={empresaResponsable} />
        <Fila label="Tel. empresa" value={empresaTelefono} />
        <Fila label="Email empresa" value={empresaEmail} />
      </Seccion>

      <Seccion titulo="Contacto de emergencia">
        <Fila label="Contacto" value={emergenciaContacto} />
        <Fila label="Tel. emerg." value={emergenciaTelefono} />
        <Fila
          label="Modo emerg."
          value={
            esEmergencia ? (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                Sí · máx. 3/mes
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                No
              </span>
            )
          }
        />
      </Seccion>

      <Seccion titulo="Fechas del permiso">
        <Fila
          label="Inicio"
          value={
            fechaInicio
              ? `${fechaInicio} ${horaInicio || ''}`.trim()
              : null
          }
        />
        <Fila
          label="Fin"
          value={
            fechaFin ? `${fechaFin} ${horaFin || ''}`.trim() : null
          }
        />
      </Seccion>

      <Seccion titulo="Personal">
        <Fila label="Cantidad" value={numAsistentes > 0 ? numAsistentes : null} />
        {numAsistentes > 0 && (
          <Fragment>
            <dt className="text-gray-500">Detalle</dt>
            <dd>
              <ul className="grid gap-1">
                {Array.from({ length: numAsistentes }, (_, i) => {
                  const a = asistentes[i];
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1 text-xs"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700">
                        {i + 1}
                      </span>
                      <span className="font-medium text-gray-800">
                        {a?.nombre || `Persona ${i + 1}`}
                      </span>
                      <span className="text-gray-500">·</span>
                      <span className="text-gray-600">
                        {a?.documento || 's/doc'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </dd>
          </Fragment>
        )}
      </Seccion>

      {/* Campos extra específicos del tipo (mantenimiento/evento/remodelacion). */}
      <Seccion titulo="Datos del tipo">
        {camposExtraResumen}
      </Seccion>
    </section>
  );
}

// Helpers top-level (T-V22: declarados fuera de render para cumplir
// `react-hooks/static-components`).
function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {titulo}
      </h4>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        {children}
      </dl>
    </div>
  );
}

function Fila({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Fragment>
      <dt className="font-medium text-gray-600">{label}</dt>
      <dd className="text-gray-900">{value || '—'}</dd>
    </Fragment>
  );
}
