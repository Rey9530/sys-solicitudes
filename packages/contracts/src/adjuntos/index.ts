/**
 * Schemas de adjuntos.
 * Detalles: PLANIFICACION/08-adjuntos.md (T-115).
 *
 * Decisión T-V06: 50 MB máximo por archivo (en lugar de 25 MB del plan original).
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
]);
export type MimePermitido = z.infer<typeof MimePermitidoSchema>;

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
