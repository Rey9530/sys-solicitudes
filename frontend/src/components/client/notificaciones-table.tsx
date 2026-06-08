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
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { previewEmailAction, reintentarEmailAction } from '@/app/(admin-plaza)/admin/notificaciones/actions';

const ESTADO_BADGE: Record<EmailLogOutput['estado'], string> = {
  pendiente: 'b-warn',
  enviado: 'b-ok',
  fallido: 'b-danger',
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
      <Card>
        <EmptyState icon={Mail} title="Sin emails" body="No hay emails con esos criterios." />
      </Card>
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
      {error && <div className="banner banner-danger">{error}</div>}
      <Card>
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
                <TableCell className="lead">{e.destinatario}</TableCell>
                <TableCell>
                  <span className="mono inline-flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
                    <Mail className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} aria-hidden />
                    {e.plantilla}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`badge ${ESTADO_BADGE[e.estado]}`} title={e.lastError ?? undefined}>
                    <span className="bdot" />
                    {e.estado}
                  </span>
                </TableCell>
                <TableCell className="num muted">{e.reintentos}</TableCell>
                <TableCell className="muted">{fmt(e.createdAt)}</TableCell>
                <TableCell className="muted">{fmt(e.sentAt)}</TableCell>
                <TableCell className="actions">
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
      </Card>

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
