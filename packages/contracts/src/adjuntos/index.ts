/**
 * Schemas de adjuntos.
 * Detalles: PLANIFICACION/08-adjuntos.md (T-115).
 *
 * Decisión T-V06: 50 MB máximo por archivo (en lugar de 25 MB del plan original).
 * Actualización 2026-09-24: se aceptan videos (MP4/MOV/WebM). Este módulo es la
 * FUENTE ÚNICA de la lista de MIME permitidos: backend (allowlist del PATCH
 * /configuracion, validador de magic bytes), wizard de solicitud, uploader
 * genérico, vistas de detalle y pantalla de configuración leen de aquí.
 */
import { z } from 'zod';
import { UuidSchema } from '../common/index.js';

export const AdjuntoEntidadTipoSchema = z.enum(['solicitud', 'local', 'contrato']);
export type AdjuntoEntidadTipo = z.infer<typeof AdjuntoEntidadTipoSchema>;

// Lista cerrada de MIME permitidos (configurable por plaza, T-V06)
export const MimePermitidoSchema = z.enum([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/dwg',
  'application/acad',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);
export type MimePermitido = z.infer<typeof MimePermitidoSchema>;

export type MimeCategoria = 'documento' | 'imagen' | 'video' | 'cad';

export interface MimeInfo {
  /** Etiqueta corta para la UI ("PDF", "MP4"). */
  label: string;
  /** Extensiones que react-dropzone asocia al MIME (`accept`). */
  extensiones: string[];
  categoria: MimeCategoria;
  /**
   * Alias histórico: se sigue aceptando si una plaza lo tiene almacenado,
   * pero NO se ofrece por defecto ni aparece en la UI de configuración.
   */
  legacy?: boolean;
}

/**
 * Metadata por MIME. Está tipado por `MimePermitido`: añadir un MIME al enum
 * sin su entrada aquí rompe la compilación (garantía de fuente única).
 */
export const MIME_INFO: Record<MimePermitido, MimeInfo> = {
  'application/pdf': { label: 'PDF', extensiones: ['.pdf'], categoria: 'documento' },
  'image/jpeg': { label: 'JPG', extensiones: ['.jpg', '.jpeg'], categoria: 'imagen' },
  'image/png': { label: 'PNG', extensiones: ['.png'], categoria: 'imagen' },
  'image/webp': { label: 'WebP', extensiones: ['.webp'], categoria: 'imagen' },
  'application/vnd.ms-excel': { label: 'XLS', extensiones: ['.xls'], categoria: 'documento' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    label: 'XLSX',
    extensiones: ['.xlsx'],
    categoria: 'documento',
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    label: 'DOCX',
    extensiones: ['.docx'],
    categoria: 'documento',
  },
  'application/dwg': { label: 'DWG', extensiones: ['.dwg'], categoria: 'cad' },
  'application/acad': {
    label: 'DWG (alias application/acad)',
    extensiones: ['.dwg'],
    categoria: 'cad',
    legacy: true,
  },
  'video/mp4': { label: 'MP4', extensiones: ['.mp4', '.m4v'], categoria: 'video' },
  'video/quicktime': { label: 'MOV', extensiones: ['.mov'], categoria: 'video' },
  'video/webm': { label: 'WebM', extensiones: ['.webm'], categoria: 'video' },
};

/**
 * Lista por defecto de una plaza nueva y allowlist del `PATCH /configuracion`
 * (excluye alias legacy). Debe coincidir con el `@default` de
 * `configuracion.mime_types_permitidos` en `schema.prisma`.
 */
export const MIME_PERMITIDOS_DEFAULT: MimePermitido[] = MimePermitidoSchema.options.filter(
  (m) => !MIME_INFO[m].legacy,
);

/** Tamaño máximo por archivo por defecto (T-V06). Configurable por plaza. */
export const ADJUNTO_TAMANIO_MAX_MB_DEFAULT = 50;
export const ADJUNTO_TAMANIO_MAX_BYTES_DEFAULT = ADJUNTO_TAMANIO_MAX_MB_DEFAULT * 1024 * 1024;

function infoDe(mime: string): MimeInfo | undefined {
  return (MIME_INFO as Record<string, MimeInfo | undefined>)[mime];
}

/**
 * Mapa `mime → extensiones` listo para la prop `accept` de react-dropzone.
 * Un MIME desconocido mapea a `[]` (react-dropzone filtra entonces solo por MIME).
 */
export function mimeAcceptMap(mimes: readonly string[]): Record<string, string[]> {
  return Object.fromEntries(mimes.map((m) => [m, infoDe(m)?.extensiones ?? []]));
}

/** Etiquetas legibles ("PDF", "JPG", …) para textos de ayuda. */
export function mimeLabels(mimes: readonly string[]): string[] {
  return mimes.map((m) => infoDe(m)?.label ?? m);
}

export const AdjuntoOutputSchema = z.object({
  id: UuidSchema,
  plazaId: UuidSchema,
  entidadTipo: AdjuntoEntidadTipoSchema,
  entidadId: UuidSchema,
  nombreOriginal: z.string(),
  mimeType: z.string(),
  tamanoBytes: z.number().int().min(0),
  usuarioSubioId: UuidSchema,
  createdAt: z.iso.datetime(),
});
export type AdjuntoOutput = z.infer<typeof AdjuntoOutputSchema>;

export const UploadAdjuntoResponseSchema = z.object({
  adjunto: AdjuntoOutputSchema,
  url: z.string().url().optional(), // pre-firmada para preview
});
export type UploadAdjuntoResponse = z.infer<typeof UploadAdjuntoResponseSchema>;
