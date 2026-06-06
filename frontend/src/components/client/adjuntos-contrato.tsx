'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { AdjuntoOutput } from '@app/contracts';
import {
  subirAdjuntoContratoAction,
  descargarAdjuntoAction,
  eliminarAdjuntoAction,
} from '@/app/(admin-plaza)/admin/contratos/actions';
import { Button } from '@/components/ui/button';
import { formatDateInPlazaTz } from '@/lib/datetime';

/**
 * Adjuntos PDF de un contrato (T-062): subida, descarga pre-firmada y borrado.
 * Reutilizado por la vista admin y la del inquilino (canDelete según permisos).
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
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const onUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Solo se permite PDF');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.set('file', file);
    const result = await subirAdjuntoContratoAction(contratoId, formData);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
    if (result.ok) {
      toast.success('PDF subido');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const onDownload = async (adjunto: AdjuntoOutput) => {
    setPendingId(adjunto.id);
    const result = await descargarAdjuntoAction(adjunto.id);
    setPendingId(null);
    if (result.ok) {
      window.open(result.url, '_blank', 'noopener');
    } else {
      toast.error(result.error);
    }
  };

  const onDelete = async (adjunto: AdjuntoOutput) => {
    if (!confirm(`¿Eliminar "${adjunto.nombreOriginal}"?`)) return;
    setPendingId(adjunto.id);
    const result = await eliminarAdjuntoAction(adjunto.id, contratoId);
    setPendingId(null);
    if (result.ok) {
      toast.success('Adjunto eliminado (movido a cuarentena)');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-dashed bg-white p-4">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
          }}
        />
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Sube el contrato firmado en PDF (máx. según configuración de la plaza).
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? 'Subiendo…' : 'Subir PDF'}
          </Button>
        </div>
      </div>

      {adjuntos.length === 0 ? (
        <p className="text-sm text-gray-500">Sin adjuntos todavía.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-white">
          {adjuntos.map((a) => (
            <li key={a.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <p className="font-medium">{a.nombreOriginal}</p>
                <p className="text-xs text-gray-500">
                  {(a.tamanoBytes / 1024).toFixed(1)} KB · {formatDateInPlazaTz(a.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId === a.id}
                  onClick={() => onDownload(a)}
                >
                  Descargar
                </Button>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    disabled={pendingId === a.id}
                    onClick={() => onDelete(a)}
                  >
                    Eliminar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
