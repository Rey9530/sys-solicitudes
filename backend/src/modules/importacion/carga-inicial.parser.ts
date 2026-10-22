import { BadRequestException } from '@nestjs/common';
import readXlsxFile from 'read-excel-file/node';
import {
  CARGA_INICIAL_COLUMNAS,
  CARGA_INICIAL_HOJA,
  CARGA_INICIAL_MAX_BYTES,
  CARGA_INICIAL_MAX_FILAS,
  CARGA_INICIAL_MARCA_EJEMPLO,
  normalizarEncabezado,
  type CargaInicialCampo,
} from '@app/contracts';

/** Archivo recibido por multer (memory storage). */
export interface ArchivoExcel {
  buffer: Buffer;
  originalname: string;
  size: number;
}

/** Valor crudo de una celda tal como lo entrega `read-excel-file`. */
export type Celda = string | number | boolean | Date | null;

export interface FilaCruda {
  /** Número de fila en Excel (1-based). */
  fila: number;
  celdas: Partial<Record<CargaInicialCampo, Celda>>;
}

export interface ExcelLeido {
  hoja: string;
  columnasFaltantes: string[];
  filas: FilaCruda[];
  /** Filas de ejemplo de la plantilla, ignoradas (números de fila de Excel). */
  filasEjemplo: number[];
}

/** Filas donde se busca la fila de encabezados (la plantilla la tiene en la 3). */
const FILAS_BUSQUEDA_ENCABEZADO = 15;
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const ENCABEZADO_LOCAL = normalizarEncabezado('LOCAL');
const ENCABEZADO_RAZON_SOCIAL = normalizarEncabezado('RAZON SOCIAL');

/**
 * Lee la plantilla de carga inicial (PLANIFICACION/18 D9/D11): valida el
 * archivo, ubica la fila de encabezados y mapea cada columna por su nombre
 * normalizado. No interpreta valores: eso lo hace `CargaInicialService`.
 */
export async function leerExcelCargaInicial(archivo: ArchivoExcel): Promise<ExcelLeido> {
  validarArchivo(archivo);

  let hojas: { sheet: string; data: unknown[][] }[];
  try {
    hojas = await readXlsxFile(archivo.buffer);
  } catch {
    throw archivoInvalido('No se pudo leer el archivo. Verifica que sea un Excel .xlsx válido.');
  }
  const hoja =
    hojas.find((h) => normalizarEncabezado(h.sheet) === normalizarEncabezado(CARGA_INICIAL_HOJA)) ??
    hojas[0];
  if (!hoja) throw archivoInvalido('El archivo no tiene hojas.');

  const data = hoja.data as Celda[][];
  const filaEncabezado = data.slice(0, FILAS_BUSQUEDA_ENCABEZADO).findIndex((row) => {
    const textos = row.map((c) => (typeof c === 'string' ? normalizarEncabezado(c) : ''));
    return textos.includes(ENCABEZADO_LOCAL) && textos.includes(ENCABEZADO_RAZON_SOCIAL);
  });
  if (filaEncabezado === -1) {
    throw plantillaInvalida(
      'No se encontró la fila de encabezados (debe contener las columnas LOCAL y RAZON SOCIAL).',
    );
  }

  const indices = mapearColumnas(data[filaEncabezado] ?? []);
  const faltantes = CARGA_INICIAL_COLUMNAS.filter((c) => !indices.has(c.campo));
  const obligatoriasFaltantes = faltantes.filter((c) => 'obligatoria' in c && c.obligatoria);
  if (obligatoriasFaltantes.length > 0) {
    throw plantillaInvalida(
      `Faltan columnas obligatorias: ${obligatoriasFaltantes.map((c) => c.encabezado).join(', ')}.`,
    );
  }

  const filas: FilaCruda[] = [];
  const filasEjemplo: number[] = [];
  for (let i = filaEncabezado + 1; i < data.length; i++) {
    const row = data[i] ?? [];
    const celdas: FilaCruda['celdas'] = {};
    let vacia = true;
    for (const [campo, col] of indices) {
      const valor = row[col] ?? null;
      celdas[campo] = valor;
      if (!esCeldaVacia(valor)) vacia = false;
    }
    if (vacia) continue;
    if (esFilaDeEjemplo(celdas)) {
      filasEjemplo.push(i + 1);
      continue;
    }
    filas.push({ fila: i + 1, celdas });
    if (filas.length > CARGA_INICIAL_MAX_FILAS) {
      throw new BadRequestException({
        code: 'IMPORTACION_DEMASIADAS_FILAS',
        title: 'Solicitud inválida',
        message: `El archivo supera el máximo de ${CARGA_INICIAL_MAX_FILAS} filas por carga.`,
      });
    }
  }
  if (filas.length === 0) {
    throw new BadRequestException({
      code: 'IMPORTACION_SIN_FILAS',
      title: 'Solicitud inválida',
      message:
        filasEjemplo.length > 0
          ? 'El archivo solo trae las filas de ejemplo de la plantilla: agrega tus datos ' +
            '(las filas cuyo COMENTARIOS empieza con «EJEMPLO» se ignoran).'
          : 'El archivo no tiene filas con datos debajo de los encabezados.',
    });
  }

  return {
    hoja: hoja.sheet,
    columnasFaltantes: faltantes.map((c) => c.encabezado),
    filas,
    filasEjemplo,
  };
}

/** Fila de ejemplo de la plantilla descargable: COMENTARIOS empieza con «EJEMPLO». */
function esFilaDeEjemplo(celdas: FilaCruda['celdas']): boolean {
  const comentarios = celdas.comentarios;
  return (
    typeof comentarios === 'string' &&
    normalizarEncabezado(comentarios).startsWith(CARGA_INICIAL_MARCA_EJEMPLO)
  );
}

/**
 * Asigna a cada campo de la plantilla el índice de su columna. Un encabezado
 * repetido ("CARGO") se resuelve por orden de aparición.
 */
function mapearColumnas(encabezados: Celda[]): Map<CargaInicialCampo, number> {
  const pendientes = new Map<string, CargaInicialCampo[]>();
  for (const c of CARGA_INICIAL_COLUMNAS) {
    const clave = normalizarEncabezado(c.encabezado);
    pendientes.set(clave, [...(pendientes.get(clave) ?? []), c.campo]);
  }
  const indices = new Map<CargaInicialCampo, number>();
  encabezados.forEach((celda, col) => {
    if (typeof celda !== 'string') return;
    const campo = pendientes.get(normalizarEncabezado(celda))?.shift();
    if (campo) indices.set(campo, col);
  });
  return indices;
}

/** Vacía = sin valor, texto en blanco o 0 (las fórmulas de totales arrastradas dan 0). */
export function esCeldaVacia(valor: Celda): boolean {
  return valor === null || valor === 0 || (typeof valor === 'string' && valor.trim() === '');
}

function validarArchivo(archivo: ArchivoExcel): void {
  if (!archivo.originalname.toLowerCase().endsWith('.xlsx')) {
    throw archivoInvalido('Solo se aceptan archivos Excel .xlsx.');
  }
  if (archivo.size > CARGA_INICIAL_MAX_BYTES) {
    throw archivoInvalido(
      `El archivo supera el máximo de ${CARGA_INICIAL_MAX_BYTES / (1024 * 1024)} MB.`,
    );
  }
  if (
    archivo.buffer.length < ZIP_MAGIC.length ||
    !archivo.buffer.subarray(0, 4).equals(ZIP_MAGIC)
  ) {
    throw archivoInvalido('El contenido no corresponde a un Excel .xlsx.');
  }
}

function archivoInvalido(message: string): BadRequestException {
  return new BadRequestException({
    code: 'IMPORTACION_ARCHIVO_INVALIDO',
    title: 'Solicitud inválida',
    message,
  });
}

function plantillaInvalida(message: string): BadRequestException {
  return new BadRequestException({
    code: 'IMPORTACION_PLANTILLA_INVALIDA',
    title: 'Solicitud inválida',
    message,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura tipada de celdas

export interface Lectura<T> {
  valor: T | null;
  /** La celda traía algo, pero no se pudo interpretar. */
  invalido: boolean;
}

const ok = <T>(valor: T): Lectura<T> => ({ valor, invalido: false });
const VACIO: Lectura<never> = { valor: null, invalido: false };
const INVALIDO: Lectura<never> = { valor: null, invalido: true };

/** Texto recortado; vacío → null. Números y fechas se convierten a texto. */
export function leerTexto(celda: Celda | undefined): string | null {
  if (celda === null || celda === undefined) return null;
  if (celda instanceof Date) return isoDate(celda);
  const texto = String(celda).trim();
  return texto === '' ? null : texto;
}

/** Número; acepta texto con `$`, comas de miles y espacios. */
export function leerNumero(celda: Celda | undefined): Lectura<number> {
  if (celda === null || celda === undefined) return VACIO;
  if (typeof celda === 'number') return Number.isFinite(celda) ? ok(celda) : INVALIDO;
  if (typeof celda !== 'string') return INVALIDO;
  const limpio = celda.replace(/[$\s]/g, '').replace(/,/g, '');
  if (limpio === '') return VACIO;
  const n = Number(limpio);
  return Number.isFinite(n) ? ok(n) : INVALIDO;
}

/**
 * Fecha ISO `YYYY-MM-DD`. Acepta celdas de fecha, seriales de Excel y texto
 * `AAAA-MM-DD` o `DD/MM/AAAA` (formato de El Salvador).
 */
export function leerFecha(celda: Celda | undefined): Lectura<string> {
  if (celda === null || celda === undefined) return VACIO;
  if (celda instanceof Date) {
    return Number.isNaN(celda.getTime()) ? INVALIDO : fechaValida(isoDate(celda));
  }
  if (typeof celda === 'number') {
    // Serial de Excel (sistema 1900): día 0 = 1899-12-30.
    if (!Number.isFinite(celda) || celda < 1) return INVALIDO;
    const ms = Date.UTC(1899, 11, 30) + Math.floor(celda) * 86_400_000;
    return fechaValida(isoDate(new Date(ms)));
  }
  if (typeof celda !== 'string') return INVALIDO;
  const texto = celda.trim();
  if (texto === '') return VACIO;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(texto);
  if (iso) return fechaDesdePartes(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(texto);
  if (dmy) return fechaDesdePartes(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  return INVALIDO;
}

function fechaDesdePartes(anio: number, mes: number, dia: number): Lectura<string> {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return INVALIDO;
  }
  return fechaValida(isoDate(d));
}

/** Descarta años absurdos (seriales mal interpretados, typos de 2 dígitos). */
function fechaValida(iso: string): Lectura<string> {
  const anio = Number(iso.slice(0, 4));
  return anio >= 1950 && anio <= 2200 ? ok(iso) : INVALIDO;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
