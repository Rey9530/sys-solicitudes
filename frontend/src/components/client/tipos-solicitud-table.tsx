'use client';

import Link from 'next/link';
import { Shapes } from 'lucide-react';
import type { SolicitudTipoConfigOutput } from '@app/contracts';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  ResponsiveDataView,
  type ResponsiveColumn,
} from '@/components/client/responsive/responsive-data-view';

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

  const columns: ResponsiveColumn<SolicitudTipoConfigOutput>[] = [
    {
      key: 'etiqueta',
      header: 'Etiqueta',
      cardLabel: 'Etiqueta',
      primary: true,
      cell: (t) => (
        <Link
          href={`/admin/catalogos/tipos-solicitud/${t.id}`}
          className="lead"
          style={{ color: 'var(--text)' }}
        >
          {t.etiqueta}
        </Link>
      ),
    },
    {
      key: 'codigo',
      header: 'Código',
      cardLabel: 'Código',
      cell: (t) => <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{t.codigo}</code>,
    },
    {
      key: 'descripcion',
      header: 'Descripción',
      cardLabel: 'Descripción',
      className: 'muted max-w-sm truncate',
      cell: (t) => t.descripcion ?? '—',
    },
    { key: 'orden', header: 'Orden', cardLabel: 'Orden', className: 'muted', cell: (t) => t.orden },
    {
      key: 'estado',
      header: 'Estado',
      cardLabel: 'Estado',
      cell: (t) => (
        <span className={`badge ${t.activo ? 'b-ok' : 'b-neutral'}`}>
          <span className="bdot" />
          {t.activo ? 'Activo' : 'Inactivo'}
        </span>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      className: 'actions',
      cell: (t) => (
        <div className="flex justify-end">
          <Link
            href={`/admin/catalogos/tipos-solicitud/${t.id}`}
            className="btn btn-ghost btn-sm"
          >
            Editar
          </Link>
        </div>
      ),
      actions: (t) => (
        <Link
          href={`/admin/catalogos/tipos-solicitud/${t.id}`}
          className="btn btn-ghost btn-sm"
        >
          Editar
        </Link>
      ),
    },
  ];

  return (
    <Card>
      <ResponsiveDataView rows={tipos} columns={columns} rowKey={(t) => t.id} />
    </Card>
  );
}
