import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { SolicitudTipoConfigOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { TipoSolicitudForm } from '@/components/client/tipo-solicitud-form';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Editar tipo de solicitud' };

/**
 * Detalle + edición de un tipo de solicitud (T-V20). El `codigo` es inmutable
 * (proviene del enum `solicitud_tipo`); se editan etiqueta, descripción,
 * orden y el flag activo (con bloqueos server-side para `otro` y tipos con
 * solicitudes activas).
 */
export default async function TipoSolicitudDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await apiFetch(`/admin/tipos-solicitud/${id}`);
  if (!res.ok) notFound();
  const tipo = (await res.json()) as SolicitudTipoConfigOutput;

  return (
    <div className="page narrow">
      <PageHeader
        breadcrumb={[
          { label: 'Tipos de solicitud', href: '/admin/catalogos/tipos-solicitud' },
          { label: tipo.etiqueta },
        ]}
        title={tipo.etiqueta}
        subtitle={`Código: ${tipo.codigo} · ${tipo.activo ? 'Activo' : 'Inactivo'} · orden ${tipo.orden}`}
      />
      <TipoSolicitudForm tipo={tipo} />
    </div>
  );
}
