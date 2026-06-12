import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { SolicitudDetailOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { loadCategorias, loadLocales, loadTiposSolicitud } from '@/lib/solicitudes-data';
import { SolicitudWizard } from '@/components/client/solicitud-wizard';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Editar solicitud' };

/** Edición (T-080/T-089): solo en borrador o requerida_subsanacion (S-FS-F).
 *  T-V20: la lista de tipos también viene de la config por plaza. */
export default async function EditarSolicitudPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await apiFetch(`/solicitudes/${id}`);
  if (!res.ok) notFound();
  const solicitud = (await res.json()) as SolicitudDetailOutput;
  if (solicitud.estado !== 'borrador' && solicitud.estado !== 'requerida_subsanacion') {
    redirect(`/inquilino/solicitudes/${id}`);
  }

  const [categorias, locales, tiposConfig] = await Promise.all([
    loadCategorias(),
    loadLocales(),
    loadTiposSolicitud(),
  ]);

  return (
    <div className="page narrow">
      <PageHeader
        title={`Editar ${solicitud.codigo}`}
        subtitle="El cambio de local solo está permitido en borrador y requerida_subsanacion (S-FS-F)."
        breadcrumb={[
          { label: 'Mis solicitudes', href: '/inquilino/solicitudes' },
          { label: solicitud.codigo, href: `/inquilino/solicitudes/${solicitud.id}` },
          { label: 'Editar' },
        ]}
      />
      <SolicitudWizard
        categorias={categorias}
        locales={locales}
        tipos={tiposConfig.map((t) => ({ codigo: t.codigo, etiqueta: t.etiqueta }))}
        solicitud={solicitud}
      />
    </div>
  );
}
