'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Download,
  FileSignature,
  FileSpreadsheet,
  Loader2,
  Users,
  XCircle,
} from 'lucide-react';
import {
  CARGA_INICIAL_MAX_BYTES,
  type CargaInicialAccion,
  type CargaInicialFila,
  type CargaInicialFilaEstado,
  type CargaInicialResultado,
} from '@app/contracts';
import { Card, CardBody, CardHead } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { Tabs } from '@/components/client/tabs';
import {
  ResponsiveDataView,
  type ResponsiveColumn,
} from '@/components/client/responsive/responsive-data-view';
import { confirmAction } from '@/lib/sweetalert';
import {
  analizarCargaInicialAction,
  ejecutarCargaInicialAction,
} from '@/app/(admin-plaza)/admin/contratos/actions';

const PLANTILLA_URL = '/plantillas/plantilla-carga-inicial.xlsx';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MAX_MB = CARGA_INICIAL_MAX_BYTES / (1024 * 1024);

type Paso = 'idle' | 'analizando' | 'importando';

const ESTADO_FILA: Record<CargaInicialFilaEstado, { tone: string; label: string }> = {
  ok: { tone: 'b-ok', label: 'OK' },
  advertencia: { tone: 'b-warn', label: 'Advertencia' },
  error: { tone: 'b-danger', label: 'Error' },
};

/**
 * Carga inicial desde Excel (PLANIFICACION/18): sube la plantilla, muestra la
 * vista previa por fila (sin escribir nada) y, al confirmar, reenvía el mismo
 * archivo para crear locales, inquilinos y contratos en una sola transacción.
 */
export function CargaInicialImporter() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<CargaInicialResultado | null>(null);
  const [paso, setPaso] = useState<Paso>('idle');
  const ocupado = paso !== 'idle';

  const analizar = useCallback(async (file: File) => {
    setArchivo(file);
    setResultado(null);
    setPaso('analizando');
    const fd = new FormData();
    fd.set('file', file);
    const r = await analizarCargaInicialAction(fd);
    setPaso('idle');
    if (r.ok) setResultado(r.resultado);
    else toast.error(r.error);
  }, []);

  const onDrop = useCallback(
    (aceptados: File[], rechazados: FileRejection[]) => {
      const rechazo = rechazados[0];
      if (rechazo) {
        const code = rechazo.errors[0]?.code;
        toast.error(
          code === 'file-too-large'
            ? `${rechazo.file.name}: supera el máximo de ${MAX_MB} MB.`
            : `${rechazo.file.name}: solo se aceptan archivos Excel .xlsx.`,
        );
        return;
      }
      const file = aceptados[0];
      if (file) void analizar(file);
    },
    [analizar],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { [XLSX_MIME]: ['.xlsx'] },
    maxSize: CARGA_INICIAL_MAX_BYTES,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    disabled: ocupado,
  });

  const importar = async () => {
    if (!archivo || !resultado) return;
    const t = resultado.totales;
    const omitidos =
      t.filasConError > 0 || t.contratos.omitidos > 0
        ? `<br/>No se importan: ${t.filasConError} fila(s) con error y ${t.contratos.omitidos} contrato(s) omitido(s).`
        : '';
    const ok = await confirmAction({
      title: '¿Importar la carga inicial?',
      html:
        `Se crearán <b>${t.locales.crear}</b> locales, <b>${t.inquilinos.crear}</b> inquilinos ` +
        `y <b>${t.contratos.crear}</b> contratos.${omitidos}` +
        '<br/>La importación no se puede deshacer en bloque.',
      icon: 'question',
      confirmButtonText: 'Sí, importar',
    });
    if (!ok) return;

    setPaso('importando');
    const fd = new FormData();
    fd.set('file', archivo);
    const r = await ejecutarCargaInicialAction(fd);
    setPaso('idle');
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    setResultado(r.resultado);
    const c = r.resultado.totales;
    toast.success(
      `Importación completada: ${c.locales.crear} locales, ${c.inquilinos.crear} inquilinos y ${c.contratos.crear} contratos.`,
    );
  };

  const reiniciar = () => {
    setArchivo(null);
    setResultado(null);
  };

  const nadaQueCrear =
    !resultado ||
    resultado.totales.locales.crear +
      resultado.totales.inquilinos.crear +
      resultado.totales.contratos.crear ===
      0;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <CardHead>
          <h3>1 · Prepara el archivo</h3>
        </CardHead>
        <CardBody className="space-y-3 text-sm">
          <p>
            Cada fila de la plantilla es un local con su inquilino y su contrato. Columnas
            obligatorias: <b>MODULO</b> y <b>LOCAL</b> (forman el código del local, p. ej.{' '}
            <span className="cellcode">K-1</span>), <b>RAZON SOCIAL</b> (o NOMBRE COMERCIAL) y{' '}
            <b>FECHA INICIO DE CONTRATO</b>.
          </p>
          <p className="muted">
            Sin fecha de fin el contrato queda indefinido. No se crean cuentas de usuario: dalas de
            alta después desde cada inquilino. Volver a importar el mismo archivo no duplica nada.
          </p>
          <p className="muted">
            La plantilla trae <b>3 filas de ejemplo</b> (en amarillo): un local con contrato
            completo, el mismo inquilino en un segundo local con contrato indefinido y un local
            disponible. Se ignoran al importar, así que puedes escribir debajo o sobre ellas.
          </p>
          <a href={PLANTILLA_URL} download className="btn btn-secondary btn-sm">
            <Download /> Descargar plantilla con ejemplos
          </a>
        </CardBody>
      </Card>

      <Card>
        <CardHead>
          <h3>2 · Sube el Excel y revisa la vista previa</h3>
        </CardHead>
        <CardBody>
          <div
            {...getRootProps()}
            className={`dropzone${isDragActive ? 'drag' : ''}`}
            aria-label="Zona de arrastre para la plantilla de carga inicial"
          >
            <input {...getInputProps()} />
            <div className="dz-ic">
              {paso === 'analizando' ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
            </div>
            {paso === 'analizando' ? (
              <p className="muted">Analizando {archivo?.name}…</p>
            ) : isDragActive ? (
              <p style={{ color: 'var(--primary)' }}>Suelta el archivo aquí…</p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {archivo && <p className="text-sm font-medium break-all">{archivo.name}</p>}
                <p className="muted text-sm">
                  Arrastra el Excel aquí o{' '}
                  <button
                    type="button"
                    onClick={open}
                    disabled={ocupado}
                    className="font-medium underline"
                    style={{ color: 'var(--primary)' }}
                  >
                    {archivo ? 'elige otro archivo' : 'elige un archivo'}
                  </button>
                  .
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Solo .xlsx · máx. {MAX_MB} MB
                </p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {resultado && (
        <ResultadoCarga
          resultado={resultado}
          importando={paso === 'importando'}
          puedeImportar={!nadaQueCrear && !ocupado}
          onImportar={importar}
          onReiniciar={reiniciar}
        />
      )}
    </div>
  );
}

function ResultadoCarga({
  resultado,
  importando,
  puedeImportar,
  onImportar,
  onReiniciar,
}: {
  resultado: CargaInicialResultado;
  importando: boolean;
  puedeImportar: boolean;
  onImportar: () => void;
  onReiniciar: () => void;
}) {
  const { totales: t, modo } = resultado;
  const ejecutado = modo === 'ejecucion';
  const columns = useMemo(() => columnasResultado(modo), [modo]);

  const porEstado = (estado: CargaInicialFilaEstado) =>
    resultado.filas.filter((f) => f.estado === estado);
  const tabla = (filas: CargaInicialFila[]) => (
    <ResponsiveDataView
      rows={filas}
      columns={columns}
      rowKey={(f) => String(f.fila)}
      emptyState={<p className="muted p-4 text-sm">Sin filas en esta categoría.</p>}
    />
  );

  return (
    <div className="stack" style={{ gap: 16 }}>
      {/* Barra de acciones ARRIBA: con cientos de filas, al final de la tabla no se vería. */}
      <div className="card card-pad flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {ejecutado ? (
          <p className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: 'var(--ok-fg)' }} />
            Importación completada. Los datos ya están disponibles en la plaza.
          </p>
        ) : (
          <p className="text-sm">
            Vista previa de <b className="break-all">{resultado.archivo}</b> (hoja «{resultado.hoja}
            », {t.filas} filas): <b>todavía no se ha guardado nada</b>.
          </p>
        )}
        <div className="flex flex-wrap gap-2 md:shrink-0">
          {ejecutado ? (
            <>
              <Link href="/admin/contratos" className="btn btn-secondary btn-sm">
                Ver contratos
              </Link>
              <Link href="/admin/locales" className="btn btn-secondary btn-sm">
                Ver locales
              </Link>
              <Link href="/admin/inquilinos" className="btn btn-secondary btn-sm">
                Ver inquilinos
              </Link>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onReiniciar}>
                Importar otro archivo
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onReiniciar}
                disabled={importando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onImportar}
                disabled={!puedeImportar}
                aria-busy={importando}
              >
                {importando ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
                {importando ? 'Importando…' : 'Importar'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard
          label={ejecutado ? 'Locales creados' : 'Locales a crear'}
          value={t.locales.crear}
          icon={Building2}
          tint="info"
        />
        <KpiCard
          label={ejecutado ? 'Inquilinos creados' : 'Inquilinos a crear'}
          value={t.inquilinos.crear}
          icon={Users}
          tint="violet"
        />
        <KpiCard
          label={ejecutado ? 'Contratos creados' : 'Contratos a crear'}
          value={t.contratos.crear}
          icon={FileSignature}
          tint="ok"
        />
        <KpiCard
          label="Filas con advertencia"
          value={t.filasConAdvertencia}
          icon={AlertTriangle}
          tint="warn"
        />
        <KpiCard label="Filas con error" value={t.filasConError} icon={XCircle} tint="danger" />
      </div>

      {(t.locales.existentes > 0 || t.inquilinos.existentes > 0 || t.contratos.existentes > 0) && (
        <p className="muted text-sm">
          Ya existían en la plaza y se reutilizan: {t.locales.existentes} locales,{' '}
          {t.inquilinos.existentes} inquilinos y {t.contratos.existentes} contratos.
        </p>
      )}
      {resultado.filasEjemplo.length > 0 && (
        <p className="muted text-sm">
          Se ignoraron las filas de ejemplo de la plantilla ({resultado.filasEjemplo.join(', ')}):
          su COMENTARIOS empieza con «EJEMPLO».
        </p>
      )}
      {resultado.columnasFaltantes.length > 0 && (
        <p className="muted text-sm">
          Columnas no encontradas (se toman como vacías): {resultado.columnasFaltantes.join(', ')}.
        </p>
      )}

      <Card>
        <CardBody>
          <Tabs
            tabs={[
              { key: 'todas', label: 'Todas', count: t.filas, content: tabla(resultado.filas) },
              {
                key: 'advertencia',
                label: 'Con advertencia',
                count: t.filasConAdvertencia,
                content: tabla(porEstado('advertencia')),
              },
              {
                key: 'error',
                label: 'Con error',
                count: t.filasConError,
                content: tabla(porEstado('error')),
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}

function AccionBadge({
  accion,
  filaOrigen,
  ejecutado,
}: {
  accion: CargaInicialAccion;
  filaOrigen: number | null;
  ejecutado: boolean;
}) {
  const config: Record<CargaInicialAccion, { tone: string; label: string }> = {
    crear: { tone: 'b-info', label: ejecutado ? 'Creado' : 'Nuevo' },
    existente: { tone: 'b-neutral', label: 'Ya existe' },
    repetido: { tone: 'b-neutral', label: `Igual a fila ${filaOrigen ?? '?'}` },
    omitido: { tone: 'b-warn', label: 'No se crea' },
  };
  const { tone, label } = config[accion];
  return <span className={`badge ${tone}`}>{label}</span>;
}

function columnasResultado(
  modo: CargaInicialResultado['modo'],
): ResponsiveColumn<CargaInicialFila>[] {
  const ejecutado = modo === 'ejecucion';
  return [
    {
      key: 'fila',
      header: 'Fila',
      cardLabel: 'Fila',
      primary: true,
      cell: (f) => <span className="cellcode">Fila {f.fila}</span>,
    },
    {
      key: 'local',
      header: 'Local',
      cardLabel: 'Local',
      cell: (f) =>
        f.local ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="cellcode">{f.local.codigo}</span>
            <AccionBadge
              accion={f.local.accion}
              filaOrigen={f.local.filaOrigen}
              ejecutado={ejecutado}
            />
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'inquilino',
      header: 'Inquilino',
      cardLabel: 'Inquilino',
      cell: (f) =>
        f.inquilino ? (
          <span
            className="flex flex-col items-start gap-1"
            style={{ minWidth: 160, maxWidth: 240 }}
          >
            <span style={{ whiteSpace: 'normal' }}>{f.inquilino.razonSocial}</span>
            <AccionBadge
              accion={f.inquilino.accion}
              filaOrigen={f.inquilino.filaOrigen}
              ejecutado={ejecutado}
            />
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'contrato',
      header: 'Contrato',
      cardLabel: 'Contrato',
      cell: (f) =>
        f.contrato ? (
          <span className="flex flex-col items-start gap-1">
            <AccionBadge accion={f.contrato.accion} filaOrigen={null} ejecutado={ejecutado} />
            {f.contrato.fechaInicio && (
              <span className="muted text-xs whitespace-nowrap">
                Desde {f.contrato.fechaInicio}
                {f.contrato.montoMensual !== null && ` · USD ${f.contrato.montoMensual.toFixed(2)}`}
              </span>
            )}
          </span>
        ) : (
          '—'
        ),
    },
    {
      // Estado + detalle en una sola columna: la tabla debe caber en ~950 px.
      key: 'estado',
      header: 'Estado',
      cardLabel: 'Estado',
      cell: (f) => (
        <span className="flex flex-col items-start gap-2" style={{ minWidth: 200, maxWidth: 300 }}>
          <span className={`badge ${ESTADO_FILA[f.estado].tone}`}>
            <span className="bdot" />
            {ESTADO_FILA[f.estado].label}
          </span>
          {f.mensajes.length > 0 && (
            <ul className="space-y-1 text-xs" style={{ whiteSpace: 'normal' }}>
              {f.mensajes.map((m, i) => (
                <li key={i} className={m.nivel === 'info' ? 'muted' : undefined}>
                  {m.texto}
                </li>
              ))}
            </ul>
          )}
        </span>
      ),
    },
  ];
}
