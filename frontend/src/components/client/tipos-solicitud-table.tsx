'use client';

import Link from 'next/link';
import { Shapes } from 'lucide-react';
import type { SolicitudTipoConfigOutput } from '@app/contracts';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Tabla de tipos de solicitud configurados por plaza (T-V20).
 * Los 4 codigos del enum `solicitud_tipo` se muestran en orden estable
 * (orden ASC, codigo ASC). La edición se hace desde la página de detalle:
 * click en el nombre o botón "Editar".
 */
export function TiposSolicitudTable({ tipos }: { tipos: SolicitudTipoConfigOutput[] }) {
  if (tipos.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Shapes}
          title="Sin tipos"
          body="No hay tipos con esos criterios. Si es la primera vez, ejecuta el seed."
        />
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Etiqueta</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Descripción</TableHead>
            <TableHead>Orden</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="actions">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tipos.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <Link
                  href={`/admin/catalogos/tipos-solicitud/${t.id}`}
                  className="lead"
                  style={{ color: 'var(--text)' }}
                >
                  {t.etiqueta}
                </Link>
              </TableCell>
              <TableCell>
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{t.codigo}</code>
              </TableCell>
              <TableCell className="muted max-w-sm truncate">
                {t.descripcion ?? '—'}
              </TableCell>
              <TableCell className="muted">{t.orden}</TableCell>
              <TableCell>
                <span className={`badge ${t.activo ? 'b-ok' : 'b-neutral'}`}>
                  <span className="bdot" />
                  {t.activo ? 'Activo' : 'Inactivo'}
                </span>
              </TableCell>
              <TableCell className="actions">
                <div className="flex justify-end">
                  <Link
                    href={`/admin/catalogos/tipos-solicitud/${t.id}`}
                    className="btn btn-ghost btn-sm"
                  >
                    Editar
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
