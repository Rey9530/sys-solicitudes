import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { InquilinoOutput, ContratoOutput, UsuarioOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { Tabs } from '@/components/client/tabs';
import { EditarInquilinoForm } from '@/components/client/editar-inquilino-form';
import { AltaUsuarioInquilinoDialog } from '@/components/client/alta-usuario-inquilino-dialog';
import { UsuariosInquilinoTable } from '@/components/client/usuarios-inquilino-table';
import { ContratoEstadoBadge } from '@/components/estado-badge';
import { PageHeader } from '@/components/ui/page-header';

export const metadata: Metadata = { title: 'Detalle de inquilino' };

interface InquilinoDetail extends InquilinoOutput {
  contratosVigentes: ContratoOutput[];
  historicoContratos: ContratoOutput[];
}

interface UsuariosInquilinoResponse {
  items: (UsuarioOutput & {
    rolStaffActivo: boolean | null;
    rolStaffNombre: string | null;
  })[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

  // T-059-bis: pestaña "Usuarios" — fetch en paralelo con el detalle de
  // contratos. Si el backend no está disponible o el inquilino es nuevo,
  // mostramos la pestaña con lista vacía en lugar de 404.
  const usuariosRes = await apiFetch(`/inquilinos/${id}/usuarios?rol=inquilino&pageSize=100`);
  const usuariosData: UsuariosInquilinoResponse = usuariosRes.ok
    ? await usuariosRes.json()
    : { items: [], total: 0, page: 1, pageSize: 100, totalPages: 0 };

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
            contacto1Email={inquilino.contacto1Email}
            contacto1Nombre={inquilino.contacto1Nombre}
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
            key: 'usuarios',
            label: 'Usuarios',
            count: usuariosData.items.length,
            content: <UsuariosInquilinoTable usuarios={usuariosData.items} />,
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
