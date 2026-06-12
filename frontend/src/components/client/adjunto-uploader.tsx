'use client';

import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { File as FileIcon, Loader2, Trash2, Download, Image as ImageIcon } from 'lucide-react';
import type { AdjuntoOutput } from '@app/contracts';
import { Button } from '@/components/ui/button';
import { formatDateInPlazaTz } from '@/lib/datetime';
import { confirmAction } from '@/lib/sweetalert';

export type AdjuntoEntidadTipo = 'solicitud' | 'local' | 'contrato';

export type ActionResult = { ok: true } | { ok: false; error: string };
export type DownloadResult = { ok: true; url: string } | { ok: false; error: string };

export interface AdjuntoUploaderProps {
  /** Etiqueta legible del tipo (aparece en mensajes). */
  entidadTipo: AdjuntoEntidadTipo;
  /** Lista inicial de adjuntos (proveniente del Server Component padre). */
  adjuntosIniciales: AdjuntoOutput[];
  /** MIME permitidos (lista cerrada por el padre, según el caso de uso). */
  mimeAllowlist: string[];
  /** Tamaño máximo por archivo en bytes. */
  maxBytes: number;
  /** Si el usuario actual puede eliminar adjuntos. */
  canDelete: boolean;
  /** Server Action: sube un archivo. Devuelve OK o error. */
  subirAction: (formData: FormData) => Promise<ActionResult>;
  /** Server Action: descarga un adjunto y devuelve la URL pre-firmada. */
  descargarAction: (adjuntoId: string) => Promise<DownloadResult>;
  /** Server Action: elimina (soft delete + quarantine). */
  eliminarAction: (adjuntoId: string) => Promise<ActionResult>;
}

/** Formatea bytes a KB/MB. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Construye la clave de `accept` para react-dropzone a partir de MIME allowlist. */
function buildAccept(mimes: string[]): Record<string, string[]> {
  return mimes.reduce<Record<string, string[]>>((acc, m) => {
    acc[m] = mimeToExts(m);
    return acc;
  }, {});
}

function mimeToExts(mime: string): string[] {
  if (mime === 'application/pdf') return ['.pdf'];
  if (mime === 'image/jpeg') return ['.jpg', '.jpeg'];
  if (mime === 'image/png') return ['.png'];
  if (mime === 'image/webp') return ['.webp'];
  if (mime === 'application/dwg' || mime === 'application/acad') return ['.dwg'];
  if (mime === 'application/vnd.ms-excel') return ['.xls'];
  if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return ['.xlsx'];
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return ['.docx'];
  }
  return [];
}

/**
 * T-117 — Componente Client genérico de upload + preview + delete de adjuntos.
 *
 * Reutilizado por:
 *   - Wizard de solicitud (T-088) → `entidadTipo="solicitud"`, allowlist de la plaza.
 *   - Detalle de solicitud admin/inquilino → idem.
 *   - Detalle de local (T-116) → `entidadTipo="local"`, allowlist hard-coded de imágenes.
 *   - Detalle de contrato (T-062) → `entidadTipo="contrato"`, allowlist `[application/pdf]`.
 *
 * El padre pasa las Server Actions de subir/descargar/eliminar (cada uno conoce
 * su endpoint y valida la sesión). El componente NO hace `fetch` directo
 * (mantiene el patrón BFF: cookies httpOnly, JWT nunca llega al JS del cliente).
 *
 * Validación cliente (UX rápida): tamaño + MIME declarado. La validación
 * definitiva (magic bytes, ejecutables) ocurre en backend (T-115).
 *
 * Decisión: no se incluye preview en línea de PDF/imágenes en este PR.
 * El componente muestra icono + nombre + tamaño + fecha. La preview inline
 * (T-117 criterio "Imágenes: thumbnail · PDF: primera página") se deja
 * para v1.1 — requiere un endpoint que devuelva la URL pre-firmada en el
 * payload de `GET /solicitudes/:id` y `GET /locales/:id` (hoy no lo hace).
 */
export function AdjuntoUploader({
  entidadTipo,
  adjuntosIniciales,
  mimeAllowlist,
  maxBytes,
  canDelete,
  subirAction,
  descargarAction,
  eliminarAction,
}: AdjuntoUploaderProps) {
  const router = useRouter();
  const [adjuntos, setAdjuntos] = useState<AdjuntoOutput[]>(adjuntosIniciales);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const maxMb = Math.floor(maxBytes / 1024 / 1024);

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejections: FileRejection[]) => {
      for (const r of rejections) {
        const first = r.errors[0];
        const code = first?.code;
        let msg = first?.message ?? 'Archivo rechazado';
        if (code === 'file-too-large') msg = `Supera el máximo de ${maxMb} MB.`;
        else if (code === 'file-invalid-type') msg = 'Tipo de archivo no permitido.';
        toast.error(`${r.file.name}: ${msg}`);
      }
      if (acceptedFiles.length === 0) return;

      setUploadingCount(acceptedFiles.length);
      for (const file of acceptedFiles) {
        const fd = new FormData();
        fd.set('file', file);
        const r = await subirAction(fd);
        if (r.ok) {
          toast.success(`${file.name} subido`);
        } else {
          toast.error(`${file.name}: ${r.error}`);
        }
      }
      setUploadingCount(0);
      router.refresh();
    },
    [maxMb, router, subirAction],
  );

  const onDownload = async (adj: AdjuntoOutput) => {
    setPendingId(adj.id);
    const r = await descargarAction(adj.id);
    setPendingId(null);
    if (r.ok) {
      window.open(r.url, '_blank', 'noopener');
    } else {
      toast.error(r.error);
    }
  };

  const onDelete = async (adj: AdjuntoOutput) => {
    const ok = await confirmAction({
      title: `¿Eliminar "${adj.nombreOriginal}"?`,
      text: 'El archivo se moverá a cuarentena.',
      icon: 'warning',
      confirmButtonText: 'Sí, eliminar',
    });
    if (!ok) return;
    setPendingId(adj.id);
    const r = await eliminarAction(adj.id);
    setPendingId(null);
    if (r.ok) {
      toast.success('Adjunto eliminado (movido a cuarentena)');
      setAdjuntos((prev) => prev.filter((a) => a.id !== adj.id));
      router.refresh();
    } else {
      toast.error(r.error);
    }
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: buildAccept(mimeAllowlist),
    maxSize: maxBytes,
    multiple: true,
    noClick: true, // el botón "Subir" hace open() explícitamente
    noKeyboard: true, // el botón ya tiene foco accesible
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`dropzone${isDragActive ? ' drag' : ''}`}
        aria-label={`Zona de arrastre para subir adjuntos de ${entidadTipo}`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className="text-center" style={{ color: 'var(--primary)' }}>
            Suelta los archivos aquí…
          </p>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="muted text-center">
              Arrastra archivos aquí o haz click en{' '}
              <button
                type="button"
                onClick={open}
                className="font-medium underline"
                style={{ color: 'var(--primary)' }}
              >
                Subir archivos
              </button>
              .
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Máx. {maxMb} MB por archivo · {mimeAllowlist.length} tipos permitidos
            </p>
            {uploadingCount > 0 && (
              <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--primary)' }}>
                <Loader2 className="h-3 w-3 animate-spin" /> Subiendo {uploadingCount} archivo(s)…
              </p>
            )}
          </div>
        )}
      </div>

      {adjuntos.length === 0 ? (
        <p className="muted text-sm">Sin adjuntos todavía.</p>
      ) : (
        <ul className="card divide-y">
          {adjuntos.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="flex min-w-0 items-center gap-3">
                <AdjuntoIcon mime={a.mimeType} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.nombreOriginal}</p>
                  <p className="muted text-xs">
                    {formatBytes(a.tamanoBytes)} · {a.mimeType} ·{' '}
                    {formatDateInPlazaTz(a.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId === a.id}
                  onClick={() => onDownload(a)}
                  aria-label={`Descargar ${a.nombreOriginal}`}
                >
                  <Download className="mr-1 h-3 w-3" /> Descargar
                </Button>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    disabled={pendingId === a.id}
                    onClick={() => onDelete(a)}
                    aria-label={`Eliminar ${a.nombreOriginal}`}
                  >
                    <Trash2 className="mr-1 h-3 w-3" /> Eliminar
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

function AdjuntoIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) {
    return (
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-gray-400">
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-gray-400">
      <FileIcon className="h-5 w-5" />
    </div>
  );
}
