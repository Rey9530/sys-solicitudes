import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { LocalDetailOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { Tabs } from '@/components/client/tabs';
import { EditarLocalForm } from '@/components/client/editar-local-form';
import { LocalEstadoBadge, ContratoEstadoBadge } from '@/components/estado-badge';
import { formatDateInPlazaTz } from '@/lib/datetime';

export const metadata: Metadata = { title: 'Detalle de local' };

export default async function LocalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await apiFetch(`/locales/${id}`);
  if (!res.ok) notFound();
  const local = (await res.json()) as LocalDetailOutput;
  const tieneVigente = local.contratoVigente !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            <Link href="/admin/locales" className="hover:underline">
              Locales
            </Link>{' '}
            / {local.codigo}
          </p>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900">
            {local.codigo} {local.nombre ? `· ${local.nombre}` : ''}
            <LocalEstadoBadge estado={local.estado} />
          </h1>
        </div>
      </div>

      <Tabs
        tabs={[
          {
            key: 'datos',
            label: 'Datos',
            content: <EditarLocalForm local={local} tieneContratoVigente={tieneVigente} />,
          },
          {
            key: 'contratos',
            label: `Contratos (${local.historicoContratos.length})`,
            content: (
              <div className="space-y-2">
                {local.historicoContratos.length === 0 && (
                  <p className="text-sm text-gray-500">Sin contratos todavía.</p>
                )}
                {local.historicoContratos.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/contratos/${c.id}`}
                    className={`flex items-center justify-between rounded-lg border bg-white p-4 hover:border-primary ${
                      c.estado === 'vigente' ? 'border-green-300 ring-1 ring-green-200' : ''
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {c.fechaInicio} → {c.fechaFin ?? 'indefinido'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {c.moneda} {c.montoMensual ?? '—'} / mes
                      </p>
                    </div>
                    <ContratoEstadoBadge estado={c.estado} />
                  </Link>
                ))}
              </div>
            ),
          },
          {
            key: 'adjuntos',
            label: 'Adjuntos',
            content: (
              <p className="text-sm text-gray-500">
                Los adjuntos de local llegan con el módulo 08 (T-110+). Los PDF de contrato
                firmado se gestionan en el detalle de cada contrato.
              </p>
            ),
          },
          {
            key: 'solicitudes',
            label: 'Solicitudes',
            content: (
              <p className="text-sm text-gray-500">
                Las solicitudes relacionadas llegan con el módulo 06.
              </p>
            ),
          },
        ]}
      />

      <p className="text-xs text-gray-400">
        Creado: {formatDateInPlazaTz(local.createdAt)} · Actualizado:{' '}
        {formatDateInPlazaTz(local.updatedAt)}
      </p>
    </div>
  );
}
