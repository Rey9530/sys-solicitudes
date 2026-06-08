import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ContratoDetailOutput, AdjuntoOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { ContratoEstadoBadge } from '@/components/estado-badge';
import { AdjuntosContrato } from '@/components/client/adjuntos-contrato';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Mi contrato' };

export default async function InquilinoContratoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [res, adjuntosRes] = await Promise.all([
    apiFetch(`/contratos/${id}`),
    apiFetch(`/contratos/${id}/adjuntos`),
  ]);
  if (!res.ok) notFound();
  const contrato = (await res.json()) as ContratoDetailOutput;
  const adjuntos = adjuntosRes.ok ? ((await adjuntosRes.json()) as AdjuntoOutput[]) : [];

  return (
    <div className="page">
      <PageHeader
        breadcrumb={[{ label: 'Mis contratos', href: '/inquilino/contratos' }, { label: contrato.localCodigo ?? '' }]}
        title={
          <>
            Local <span className="mono">{contrato.localCodigo}</span>
          </>
        }
        badges={<ContratoEstadoBadge estado={contrato.estado} />}
      />

      <Card pad>
        <dl className="dl">
          <div>
            <div className="dt">Inicio</div>
            <div className="dd">{contrato.fechaInicio}</div>
          </div>
          <div>
            <div className="dt">Fin</div>
            <div className="dd">{contrato.fechaFin ?? 'Indefinido'}</div>
          </div>
          <div>
            <div className="dt">Monto mensual</div>
            <div className="dd">
              {contrato.montoMensual !== null ? `${contrato.moneda} ${contrato.montoMensual}` : '—'}
            </div>
          </div>
          <div>
            <div className="dt">Moneda</div>
            <div className="dd">{contrato.moneda}</div>
          </div>
          {contrato.condiciones && (
            <div className="full">
              <div className="dt">Condiciones</div>
              <div className="dd whitespace-pre-wrap">{contrato.condiciones}</div>
            </div>
          )}
        </dl>
      </Card>

      <div className="stack" style={{ marginTop: 20, gap: 12 }}>
        <h2 className="text-[15px] font-semibold">Contrato firmado (PDF)</h2>
        {/* El inquilino puede subir/descargar; solo borra lo que subió (backend valida). */}
        <AdjuntosContrato contratoId={contrato.id} adjuntos={adjuntos} canDelete />
      </div>
    </div>
  );
}
