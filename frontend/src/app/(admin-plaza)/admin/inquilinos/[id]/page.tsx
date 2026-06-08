import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { InquilinoOutput, ContratoOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { Tabs } from '@/components/client/tabs';
import { EditarInquilinoForm } from '@/components/client/editar-inquilino-form';
import { AltaUsuarioInquilinoDialog } from '@/components/client/alta-usuario-inquilino-dialog';
import { ContratoEstadoBadge } from '@/components/estado-badge';
import { PageHeader } from '@/components/ui/page-header';

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
    <div className="page">
      <PageHeader
        breadcrumb={[{ label: 'Inquilinos', href: '/admin/inquilinos' }, { label: inquilino.razonSocial }]}
        title={inquilino.razonSocial}
        subtitle={inquilino.identificacion ? `ID: ${inquilino.identificacion}` : undefined}
        actions={
          <AltaUsuarioInquilinoDialog
            inquilinoId={inquilino.id}
            razonSocial={inquilino.razonSocial}
            contactoEmail={inquilino.contactoEmail}
            contactoNombre={inquilino.contactoNombre}
          />
        }
      />

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
            label: 'Contratos',
            count: inquilino.historicoContratos.length,
            content: (
              <div className="stack" style={{ gap: 10 }}>
                {inquilino.historicoContratos.length === 0 && (
                  <p className="muted text-sm">Sin contratos todavía.</p>
                )}
                {inquilino.historicoContratos.map((c) => (
                  <Link
                    key={c.id}
                    href={`/admin/contratos/${c.id}`}
                    className={`mini-card${c.estado === 'vigente' ? ' vigente' : ''}`}
                  >
                    <div className="mc-main">
                      <b>
                        {c.fechaInicio} → {c.fechaFin ?? 'indefinido'}
                      </b>
                      <span>
                        {c.moneda} {c.montoMensual ?? '—'} / mes
                      </span>
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
            content: <p className="muted text-sm">Las solicitudes del inquilino llegan con el módulo 06.</p>,
          },
        ]}
      />
    </div>
  );
}
