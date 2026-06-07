'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, RefreshCw, Eye } from 'lucide-react';
import type { EmailLogOutput, EmailLogPreview } from '@app/contracts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { previewEmailAction, reintentarEmailAction } from '@/app/(admin-plaza)/admin/notificaciones/actions';

const ESTADO_BADGE: Record<EmailLogOutput['estado'], string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  enviado: 'bg-green-100 text-green-800',
  fallido: 'bg-red-100 text-red-800',
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return iso.slice(0, 16).replace('T', ' ');
}

/** Tabla del log de emails (T-127) con reintento manual y modal de contenido. */
export function NotificacionesTable({ emails }: { emails: EmailLogOutput[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ destinatario: string; data: EmailLogPreview } | null>(
    null,
  );

  if (emails.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">
        No hay emails con esos criterios.
      </p>
    );
  }

  const reintentar = (id: string) =>
    startTransition(async () => {
      setError(null);
      const res = await reintentarEmailAction(id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });

  const verContenido = (email: EmailLogOutput) =>
    startTransition(async () => {
      setError(null);
      const res = await previewEmailAction(email.id);
      if (!res.ok) setError(res.error);
      else setPreview({ destinatario: email.destinatario, data: res.preview });
    });

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Destinatario</TableHead>
              <TableHead>Plantilla</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Reintentos</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead>Enviado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {emails.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.destinatario}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5 text-gray-600">
                    <Mail className="h-3.5 w-3.5 text-gray-400" aria-hidden />
                    {e.plantilla}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_BADGE[e.estado]}`}
                    title={e.lastError ?? undefined}
                  >
                    {e.estado}
                  </span>
                  {e.lastError && (
                    <span
                      className="ml-1 cursor-help text-xs text-red-500 underline decoration-dotted"
                      title={e.lastError}
                    >
                      error
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center text-gray-500">{e.reintentos}</TableCell>
                <TableCell className="text-gray-500">{fmt(e.createdAt)}</TableCell>
                <TableCell className="text-gray-500">{fmt(e.sentAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => verContenido(e)}
                      title="Ver contenido"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    {e.estado === 'fallido' && e.plantilla !== 'reset-password' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => reintentar(e.id)}
                        title="Reintentar"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.data.subject}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Para: {preview.destinatario}</p>
              <iframe
                title="Contenido del email"
                srcDoc={preview.data.html}
                sandbox=""
                className="h-[480px] w-full rounded-md border bg-white"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
