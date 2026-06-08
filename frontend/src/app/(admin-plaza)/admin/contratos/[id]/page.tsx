import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ContratoDetailOutput, AdjuntoOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { ContratoEstadoBadge } from '@/components/estado-badge';
import { CerrarContratoDialog } from '@/components/client/cerrar-contrato-dialog';
import { RenovarContratoDialog } from '@/components/client/renovar-contrato-dialog';
import { AdjuntosContrato } from '@/components/client/adjuntos-contrato';
import { PageHeader } from '@/components/ui/page-header';
import { Banner } from '@/components/ui/banner';
import { Card } from '@/components/ui/card';
import { formatDateInPlazaTz } from '@/lib/datetime';

export const metadata: Metadata = { title: 'Detalle de contrato' };

export default async function ContratoDetailPage({
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
      {/* Banner de ventana de vencimiento (T-060) */}
      {contrato.enVentanaT7 ? (
        <div className="mb-4">
          <Banner tone="danger">
            Este contrato vence en 7 días o menos ({contrato.fechaFin}). Renueva o cierra.
          </Banner>
        </div>
      ) : contrato.enVentanaT30 ? (
        <div className="mb-4">
          <Banner tone="warn">Este contrato vence en 30 días o menos ({contrato.fechaFin}).</Banner>
        </div>
      ) : null}

      <PageHeader
        breadcrumb={[{ label: 'Contratos', href: '/admin/contratos' }, { label: contrato.localCodigo ?? '' }]}
        title={
          <>
            <span className="mono">{contrato.localCodigo}</span> · {contrato.inquilinoRazonSocial}
          </>
        }
        badges={<ContratoEstadoBadge estado={contrato.estado} />}
        actions={
          contrato.estado === 'vigente' ? (
            <>
              <RenovarContratoDialog contrato={contrato} />
              <CerrarContratoDialog contrato={contrato} />
            </>
          ) : undefined
        }
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
            <div className="dt">Creado</div>
            <div className="dd">{formatDateInPlazaTz(contrato.createdAt)}</div>
          </div>
          {contrato.condiciones && (
            <div className="full">
              <div className="dt">Condiciones</div>
              <div className="dd whitespace-pre-wrap">{contrato.condiciones}</div>
            </div>
          )}
          {contrato.estado !== 'vigente' && (
            <>
              <div>
                <div className="dt">Fin efectivo</div>
                <div className="dd">{contrato.fechaFinEfectiva ?? '—'}</div>
              </div>
              <div className="full">
                <div className="dt">Motivo de cierre</div>
                <div className="dd">{contrato.motivoFin ?? '—'}</div>
              </div>
            </>
          )}
        </dl>
      </Card>

      <div className="stack" style={{ marginTop: 20, gap: 12 }}>
        <h2 className="text-[15px] font-semibold">Contrato firmado (PDF)</h2>
        <AdjuntosContrato contratoId={contrato.id} adjuntos={adjuntos} canDelete />
      </div>
    </div>
  );
}
