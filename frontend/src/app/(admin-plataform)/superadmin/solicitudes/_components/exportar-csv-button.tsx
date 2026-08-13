'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import type { ListSolicitudesPlataformaQuery } from '@app/contracts';
import { descargarSolicitudesCsvAction } from '../actions';

/**
 * T-V25 · Botón "Exportar CSV" de la vista cross-plaza.
 *
 * Llama a `descargarSolicitudesCsvAction` (Server Action) que hace de BFF
 * para `apiFetch('/admin/solicitudes/export.csv')` — el cliente nunca tiene
 * el JWT httpOnly.
 *
 * Recibe los filtros actuales como prop para no tener que parsear la URL
 * aquí (el padre ya los tiene en `searchParams`).
 */
export function ExportarCsvButton({
  filtros,
  disabled = false,
}: {
  filtros: ListSolicitudesPlataformaQuery;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);

  const onClick = async () => {
    if (pending) return;
    setPending(true);
    const promise = descargarSolicitudesCsvAction(filtros);
    toast.promise(promise, {
      loading: 'Generando CSV…',
      success: (r) => {
        if (!r.ok) {
          throw new Error(r.error);
        }
        // Disparo del download programático.
        const blob = new Blob([r.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = r.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return `Descargado ${r.filename}`;
      },
      error: (e) => `No se pudo exportar: ${e instanceof Error ? e.message : String(e)}`,
      finally: () => setPending(false),
    });
  };

  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={onClick}
      disabled={pending || disabled}
      aria-busy={pending}
    >
      <Download className="h-4 w-4" />
      {pending ? 'Exportando…' : 'Exportar CSV'}
    </button>
  );
}
