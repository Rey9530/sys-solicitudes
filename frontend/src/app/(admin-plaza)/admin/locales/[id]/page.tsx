import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AdjuntoOutput, LocalDetailOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { Tabs } from '@/components/client/tabs';
import { EditarLocalForm } from '@/components/client/editar-local-form';
import { AdjuntoUploader } from '@/components/client/adjunto-uploader';
import { LocalEstadoBadge, ContratoEstadoBadge } from '@/components/estado-badge';
import { PageHeader } from '@/components/ui/page-header';
import { formatDateInPlazaTz } from '@/lib/datetime';
import {
  subirAdjuntoLocalAction,
  descargarAdjuntoLocalAction,
  eliminarAdjuntoLocalAction,
} from '@/app/(admin-plaza)/admin/locales/actions';

export const metadata: Metadata = { title: 'Detalle de local' };

/** MIME permitidos para adjuntos de local (T-116, hard-coded). */
const LOCAL_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const LOCAL_MAX_BYTES = 50 * 1024 * 1024; // 50 MB (T-V06, default de plaza)

export default async function LocalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await apiFetch(`/locales/${id}`);
  if (!res.ok) notFound();
  const local = (await res.json()) as LocalDetailOutput;

  const adjuntosRes = await apiFetch(`/locales/${id}/adjuntos`);
  const adjuntos: AdjuntoOutput[] = adjuntosRes.ok ? await adjuntosRes.json() : [];

  const tieneVigente = local.contratoVigente !== null;

  return (
    <div className="page">
      <PageHeader
        breadcrumb={[{ label: 'Locales', href: '/admin/locales' }, { label: local.codigo }]}
        title={
          <>
            <span className="mono">{local.codigo}</span>
            {local.nombre ? ` · ${local.nombre}` : ''}
          </>
        }
        badges={<LocalEstadoBadge estado={local.estado} />}
      />

      <Tabs
        tabs={[
          {
            key: 'datos',
            label: 'Datos',
            content: <EditarLocalForm local={local} tieneContratoVigente={tieneVigente} />,
          },
          {
            key: 'contratos',
            label: 'Contratos',
            count: local.historicoContratos.length,
            content: (
              <div className="stack" style={{ gap: 10 }}>
                {local.historicoContratos.length === 0 && (
                  <p className="muted text-sm">Sin contratos todavía.</p>
                )}
                {local.historicoContratos.map((c) => (
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
            key: 'adjuntos',
            label: `Adjuntos (${adjuntos.length})`,
            content: (
              <AdjuntoUploader
                entidadTipo="local"
                adjuntosIniciales={adjuntos}
                mimeAllowlist={LOCAL_MIMES}
                maxBytes={LOCAL_MAX_BYTES}
                canDelete
                subirAction={subirAdjuntoLocalAction.bind(null, id)}
                descargarAction={descargarAdjuntoLocalAction}
                eliminarAction={eliminarAdjuntoLocalAction.bind(null, id)}
              />
            ),
          },
          {
            key: 'solicitudes',
            label: 'Solicitudes',
            content: <p className="muted text-sm">Las solicitudes relacionadas llegan con el módulo 06.</p>,
          },
        ]}
      />

      <div className="meta-foot">
        <span>
          <b>Creado:</b> {formatDateInPlazaTz(local.createdAt)}
        </span>
        <span>
          <b>Actualizado:</b> {formatDateInPlazaTz(local.updatedAt)}
        </span>
      </div>
    </div>
  );
}
