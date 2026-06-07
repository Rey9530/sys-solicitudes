'use client';

import type { AdjuntoOutput } from '@app/contracts';
import {
  AdjuntoUploader,
  type ActionResult,
  type DownloadResult,
} from '@/components/client/adjunto-uploader';
import {
  subirAdjuntoContratoAction,
  descargarAdjuntoAction,
  eliminarAdjuntoAction,
} from '@/app/(admin-plaza)/admin/contratos/actions';

/**
 * Wrapper de `AdjuntoUploader` específico para el contrato firmado.
 * Restringe el allowlist a PDF (T-062) y reutiliza el componente genérico
 * (T-117). Reutilizado por la vista admin y la del inquilino (`canDelete`
 * se controla desde el padre).
 */
export function AdjuntosContrato({
  contratoId,
  adjuntos,
  canDelete,
}: {
  contratoId: string;
  adjuntos: AdjuntoOutput[];
  canDelete: boolean;
}) {
  return (
    <AdjuntoUploader
      entidadTipo="contrato"
      adjuntosIniciales={adjuntos}
      mimeAllowlist={['application/pdf']}
      maxBytes={50 * 1024 * 1024}
      canDelete={canDelete}
      subirAction={(fd): Promise<ActionResult> => subirAdjuntoContratoAction(contratoId, fd)}
      descargarAction={descargarAdjuntoAction as (id: string) => Promise<DownloadResult>}
      eliminarAction={(adjId): Promise<ActionResult> => eliminarAdjuntoAction(adjId, contratoId)}
    />
  );
}
