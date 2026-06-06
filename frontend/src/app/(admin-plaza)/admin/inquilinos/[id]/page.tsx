import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { InquilinoOutput, ContratoOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { Tabs } from '@/components/client/tabs';
import { EditarInquilinoForm } from '@/components/client/editar-inquilino-form';
import { AltaUsuarioInquilinoDialog } from '@/components/client/alta-usuario-inquilino-dialog';
import { ContratoEstadoBadge } from '@/components/estado-badge';

export const metadata: Metadata = { title: 'Detalle de inquilino' };

interface InquilinoDetail extends InquilinoOutput {
  contratosVigentes: ContratoOutput[];
  historicoContratos: ContratoOutput[];
}

export default async function InquilinoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await apiFetch(`/inquilinos/${id}`);
  if (!res.ok) notFound();
  const inquilino = (await res.json()) as InquilinoDetail;
  const tieneVigente = inquilino.contratosVigentes.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            <Link href="/admin/inquilinos" className="hover:underline">
              Inquilinos
            </Link>{' '}
            / {inquilino.razonSocial}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">{inquilino.razonSocial}</h1>
          {inquilino.identificacion && (
            <p className="text-sm text-gray-500">ID: {inquilino.identificacion}</p>
          )}
        </div>
        <AltaUsuarioInquilinoDialog
          inquilinoId={inquilino.id}
          razonSocial={inquilino.razonSocial}
          contactoEmail={inquilino.contactoEmail}
          contactoNombre={inquilino.contactoNombre}
        />
      </div>

      <Tabs
        tabs={[
          {
            key: 'datos',
            label: 'Datos',
            content: (
              <EditarInquilinoForm
                inquilino={inquilino}
                tieneContratoVigente={tieneVigente}
              />
            ),
          },
          {
            key: 'contratos',
            label: `Contratos (${inquilino.historicoContratos.length})`,
            content: (
              <div className="space-y-2">
                {inquilino.historicoContratos.length === 0 && (
                  <p className="text-sm text-gray-500">Sin contratos todavía.</p>
                )}
                {inquilino.historicoContratos.map((c) => (
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
            key: 'solicitudes',
            label: 'Solicitudes',
            content: (
              <p className="text-sm text-gray-500">
                Las solicitudes del inquilino llegan con el módulo 06.
              </p>
            ),
          },
        ]}
      />
    </div>
  );
}
