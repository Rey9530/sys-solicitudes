import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { SolicitudDetailOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { loadCategorias, loadLocales } from '@/lib/solicitudes-data';
import { SolicitudWizard } from '@/components/client/solicitud-wizard';

export const metadata: Metadata = { title: 'Editar solicitud' };

/** Edición (T-080/T-089): solo en borrador o requerida_subsanacion (S-FS-F). */
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

  const [categorias, locales] = await Promise.all([loadCategorias(), loadLocales()]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Editar {solicitud.codigo}</h1>
        <p className="text-sm text-gray-500">
          El cambio de local solo está permitido en borrador y requerida_subsanacion (S-FS-F).
        </p>
      </div>
      <SolicitudWizard categorias={categorias} locales={locales} solicitud={solicitud} />
    </div>
  );
}
