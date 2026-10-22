/**
 * Carga inicial desde Excel: locales + inquilinos + contratos en un solo paso.
 * Detalles: PLANIFICACION/18-carga-inicial-excel.md.
 *
 * Cada fila de la plantilla es un local con su inquilino y su contrato. El
 * backend ubica las columnas por ENCABEZADO normalizado (sin acentos, sin
 * signos, mayúsculas), no por letra: reordenar columnas no rompe la carga.
 */
import { z } from 'zod';

/** Tope del archivo `.xlsx` (validado en frontend y backend). */
export const CARGA_INICIAL_MAX_BYTES = 5 * 1024 * 1024;

/** Tope de filas de datos por archivo. */
export const CARGA_INICIAL_MAX_FILAS = 2000;

/** Hoja preferida; si el libro no la tiene se usa la primera. */
export const CARGA_INICIAL_HOJA = 'INFORMACION A LLENAR';

/**
 * Las filas de ejemplo de la plantilla descargable llevan en COMENTARIOS un
 * texto que empieza con esta palabra; el importador las ignora (no crean nada).
 */
export const CARGA_INICIAL_MARCA_EJEMPLO = 'EJEMPLO';

export type CargaInicialGrupo = 'local' | 'inquilino' | 'contrato';

export interface CargaInicialColumna {
  campo: string;
  /** Encabezado tal como aparece en la plantilla. */
  encabezado: string;
  grupo: CargaInicialGrupo;
  /** La columna debe existir en el archivo (aunque sus celdas vayan vacías). */
  obligatoria?: true;
}

/**
 * Fuente única del formato de la plantilla, en el orden del archivo. "CARGO"
 * aparece dos veces: la 1.ª ocurrencia es del contacto 1 y la 2.ª del contacto 2.
 */
export const CARGA_INICIAL_COLUMNAS = [
  // ── Locales ──────────────────────────────────────────────────────────────
  { campo: 'modulo', encabezado: 'MODULO', grupo: 'local', obligatoria: true },
  { campo: 'nivel', encabezado: 'NIVEL', grupo: 'local' },
  { campo: 'local', encabezado: 'LOCAL', grupo: 'local', obligatoria: true },
  { campo: 'area', encabezado: 'ÁREA', grupo: 'local' },
  { campo: 'medidorEnergia', encabezado: 'MEDIDOR ENERGIA', grupo: 'local' },
  { campo: 'medidorAgua', encabezado: 'MEDIDOR AGUA', grupo: 'local' },
  // ── Inquilinos ───────────────────────────────────────────────────────────
  { campo: 'nombreComercial', encabezado: 'NOMBRE COMERCIAL', grupo: 'inquilino', obligatoria: true },
  { campo: 'razonSocial', encabezado: 'RAZON SOCIAL', grupo: 'inquilino', obligatoria: true },
  { campo: 'representanteLegal', encabezado: 'REPRESENTANTE LEGAL', grupo: 'inquilino' },
  { campo: 'nit', encabezado: 'NIT DE LA EMPRESA', grupo: 'inquilino' },
  { campo: 'correoDte', encabezado: 'CORREO DE RECEPCION DTE', grupo: 'inquilino' },
  { campo: 'telefono', encabezado: 'NUMERO DE TELEFONO', grupo: 'inquilino' },
  { campo: 'nrc', encabezado: 'NUMERO DE NRC', grupo: 'inquilino' },
  { campo: 'contacto1Nombre', encabezado: 'CONTACTO', grupo: 'inquilino' },
  { campo: 'contacto1Cargo', encabezado: 'CARGO', grupo: 'inquilino' },
  { campo: 'contacto1Email', encabezado: 'CORREO CONTACTO', grupo: 'inquilino' },
  { campo: 'contacto1Telefono', encabezado: 'TELEFONO CONTACTO', grupo: 'inquilino' },
  { campo: 'contacto2Nombre', encabezado: 'CONTACTO #2', grupo: 'inquilino' },
  { campo: 'contacto2Cargo', encabezado: 'CARGO', grupo: 'inquilino' },
  { campo: 'contacto2Email', encabezado: 'CORREO CONTACTO #2', grupo: 'inquilino' },
  { campo: 'contacto2Telefono', encabezado: 'TELEFONO CONTACTO #2', grupo: 'inquilino' },
  { campo: 'tipoCliente', encabezado: 'TIPO DE CLIENTE', grupo: 'inquilino' },
  { campo: 'giroAutorizado', encabezado: 'GIRO AUTORIZADO', grupo: 'inquilino' },
  { campo: 'categoria', encabezado: 'CATEGORIA', grupo: 'inquilino' },
  { campo: 'subcategoria', encabezado: 'SUBCATEGORIA', grupo: 'inquilino' },
  // ── Contratos ────────────────────────────────────────────────────────────
  { campo: 'plazoAnios', encabezado: 'PLAZO (AÑOS)', grupo: 'contrato' },
  { campo: 'areaReal', encabezado: 'ÁREA mt2 MEDICION REAL', grupo: 'contrato' },
  { campo: 'cuotaArrendamiento', encabezado: 'CUOTA ARRENDAMIENTO', grupo: 'contrato' },
  { campo: 'cuotaCam', encabezado: 'CUOTA CAM', grupo: 'contrato' },
  { campo: 'totalCanon', encabezado: 'TOTAL CANON ARRENDAMIENTO', grupo: 'contrato' },
  { campo: 'totalCam', encabezado: 'TOTAL CAM', grupo: 'contrato' },
  { campo: 'total', encabezado: 'TOTAL', grupo: 'contrato' },
  { campo: 'deposito', encabezado: 'DEPOSITO DE GARANTÍA', grupo: 'contrato' },
  { campo: 'fechaPagoDeposito', encabezado: 'FECHA PAGO DEPOSITO', grupo: 'contrato' },
  { campo: 'fechaInicio', encabezado: 'FECHA INICIO DE CONTRATO', grupo: 'contrato', obligatoria: true },
  { campo: 'fechaFin', encabezado: 'FECHA FIN DE CONTRATO', grupo: 'contrato' },
  { campo: 'fechaEntregaLocal', encabezado: 'FECHA ENTREGA DE LOCAL', grupo: 'contrato' },
  { campo: 'periodoGracia', encabezado: 'PERIODO DE GRACIA', grupo: 'contrato' },
  { campo: 'inicioOperaciones', encabezado: 'INICIO DE OPERACIONES', grupo: 'contrato' },
  { campo: 'vencimiento', encabezado: 'VENCIMIENTO DEL CONTRATO', grupo: 'contrato' },
  { campo: 'avisoTerminacion', encabezado: 'AVISO DE TERMINACIÓN', grupo: 'contrato' },
  { campo: 'condicionesIncremento', encabezado: 'CONDICIONES DE INCREMENTO CANON', grupo: 'contrato' },
  { campo: 'comentarios', encabezado: 'COMENTARIOS', grupo: 'contrato' },
] as const satisfies readonly CargaInicialColumna[];

export type CargaInicialCampo = (typeof CARGA_INICIAL_COLUMNAS)[number]['campo'];

/**
 * Normaliza un encabezado para compararlo: sin acentos, mayúsculas y cualquier
 * secuencia no alfanumérica → un espacio ("PLAZO (AÑOS)" → "PLAZO ANOS").
 */
export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado (mismo shape para el análisis y la ejecución)

/**
 * - `crear`: se crea (análisis) o se creó (ejecución).
 * - `existente`: ya estaba en la plaza; se reutiliza sin modificarlo.
 * - `repetido`: lo introduce una fila anterior del mismo archivo (`filaOrigen`).
 * - `omitido`: no se crea; el motivo va en `mensajes`.
 */
export const CargaInicialAccionSchema = z.enum(['crear', 'existente', 'repetido', 'omitido']);
export type CargaInicialAccion = z.infer<typeof CargaInicialAccionSchema>;

/** `error` = la fila no crea ni reutiliza nada; `advertencia` = se omitió una parte. */
export const CargaInicialFilaEstadoSchema = z.enum(['ok', 'advertencia', 'error']);
export type CargaInicialFilaEstado = z.infer<typeof CargaInicialFilaEstadoSchema>;

export const CargaInicialMensajeSchema = z.object({
  nivel: z.enum(['advertencia', 'info']),
  texto: z.string(),
});
export type CargaInicialMensaje = z.infer<typeof CargaInicialMensajeSchema>;

const EntidadFilaSchema = z.object({
  accion: CargaInicialAccionSchema,
  filaOrigen: z.number().int().nullable(),
});

export const CargaInicialFilaSchema = z.object({
  /** Número de fila en el Excel (1-based, como lo muestra Excel). */
  fila: z.number().int(),
  local: EntidadFilaSchema.extend({ codigo: z.string() }).nullable(),
  inquilino: EntidadFilaSchema.extend({ razonSocial: z.string() }).nullable(),
  contrato: z
    .object({
      accion: CargaInicialAccionSchema,
      fechaInicio: z.iso.date().nullable(),
      montoMensual: z.number().nullable(),
    })
    .nullable(),
  estado: CargaInicialFilaEstadoSchema,
  mensajes: z.array(CargaInicialMensajeSchema),
});
export type CargaInicialFila = z.infer<typeof CargaInicialFilaSchema>;

const ConteoSchema = z.object({
  crear: z.number().int(),
  existentes: z.number().int(),
});

export const CargaInicialTotalesSchema = z.object({
  filas: z.number().int(),
  filasOk: z.number().int(),
  filasConAdvertencia: z.number().int(),
  filasConError: z.number().int(),
  locales: ConteoSchema,
  inquilinos: ConteoSchema,
  contratos: ConteoSchema.extend({ omitidos: z.number().int() }),
});
export type CargaInicialTotales = z.infer<typeof CargaInicialTotalesSchema>;

export const CargaInicialResultadoSchema = z.object({
  modo: z.enum(['analisis', 'ejecucion']),
  archivo: z.string(),
  hoja: z.string(),
  /** Columnas opcionales de la plantilla que no vinieron en el archivo. */
  columnasFaltantes: z.array(z.string()),
  /** Filas ignoradas por ser ejemplos de la plantilla (COMENTARIOS empieza con «EJEMPLO»). */
  filasEjemplo: z.array(z.number().int()),
  totales: CargaInicialTotalesSchema,
  filas: z.array(CargaInicialFilaSchema),
});
export type CargaInicialResultado = z.infer<typeof CargaInicialResultadoSchema>;
