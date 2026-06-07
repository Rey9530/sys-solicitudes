import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AdjuntoOutput, LocalDetailOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { Tabs } from '@/components/client/tabs';
import { EditarLocalForm } from '@/components/client/editar-local-form';
import { AdjuntoUploader } from '@/components/client/adjunto-uploader';
import { LocalEstadoBadge, ContratoEstadoBadge } from '@/components/estado-badge';
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
            label: `Adjuntos (${adjuntos.length})`,
            content: (
              <AdjuntoUploader
                entidadTipo="local"
                adjuntosIniciales={adjuntos}
                mimeAllowlist={LOCAL_MIMES}
                maxBytes={LOCAL_MAX_BYTES}
                canDelete
                subirAction={(fd) => subirAdjuntoLocalAction(id, fd)}
                descargarAction={descargarAdjuntoLocalAction}
                eliminarAction={(adjId) => eliminarAdjuntoLocalAction(id, adjId)}
              />
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
