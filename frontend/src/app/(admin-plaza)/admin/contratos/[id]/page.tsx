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

  // Totales derivados (Y/Z/AA — T-V14+): se calculan en frontend, no se persisten.
  // Fórmula de negocio (2026-08-21):
  //   totalCanon = areaMt2MedicionReal × cuotaArrendamiento
  //   totalCam   = areaMt2MedicionReal × cuotaCam
  //   total      = totalCanon + totalCam
  const area = Number(contrato.areaMt2MedicionReal ?? 0);
  const canon = Number(contrato.cuotaArrendamiento ?? 0);
  const cam = Number(contrato.cuotaCam ?? 0);
  const totalCanon = area * canon;
  const totalCam = area * cam;
  const total = totalCanon + totalCam;

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

      {/* ── Sección: Términos contractuales (Excel U-AK; T-V14+) ─────────── */}
      <Card pad>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide muted">
          Términos contractuales
        </h2>
        <dl className="dl">
          <div>
            <div className="dt">Plazo (meses)</div>
            <div className="dd">{contrato.plazoMeses ?? '—'}</div>
          </div>
          <div>
            <div className="dt">Período de gracia (días)</div>
            <div className="dd">
              {contrato.periodoGraciaDias !== null
                ? `${contrato.periodoGraciaDias} días`
                : '—'}
            </div>
          </div>
          <div>
            <div className="dt">Área (medición real)</div>
            <div className="dd">
              {contrato.areaMt2MedicionReal !== null
                ? `${contrato.areaMt2MedicionReal} m²`
                : '—'}
            </div>
          </div>
          <div>
            <div className="dt">Fecha entrega del local</div>
            <div className="dd">{contrato.fechaEntregaLocal ?? '—'}</div>
          </div>
          <div>
            <div className="dt">Inicio de operaciones</div>
            <div className="dd">{contrato.inicioOperaciones ?? '—'}</div>
          </div>
          <div>
            <div className="dt">Aviso de terminación</div>
            <div className="dd">{contrato.avisoTerminacion ?? '—'}</div>
          </div>
        </dl>
      </Card>

      {/* ── Sección: Pagos (Excel U/AB/AC + W/X/AA derivados) ─────────────── */}
      <div style={{ marginTop: 16 }}>
        <Card pad>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide muted">Pagos</h2>
          <dl className="dl">
            <div>
              <div className="dt">Monto mensual</div>
              <div className="dd">
                {contrato.montoMensual !== null ? `${contrato.moneda} ${contrato.montoMensual}` : '—'}
              </div>
            </div>
            <div>
              <div className="dt">Canon arrendamiento</div>
              <div className="dd">
                {contrato.cuotaArrendamiento !== null
                  ? `${contrato.moneda} ${contrato.cuotaArrendamiento}`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="dt">CAM</div>
              <div className="dd">
                {contrato.cuotaCam !== null ? `${contrato.moneda} ${contrato.cuotaCam}` : '—'}
              </div>
            </div>
            <div>
              <div className="dt">Depósito de garantía</div>
              <div className="dd">
                {contrato.depositoGarantia !== null
                  ? `${contrato.moneda} ${contrato.depositoGarantia}`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="dt">Fecha pago del depósito</div>
              <div className="dd">{contrato.fechaPagoDeposito ?? '—'}</div>
            </div>
            {/* Totales derivados Y/Z/AA — T-V14+ */}
            <div className="full">
              <div className="dt">Totales derivados</div>
              <div className="dd">
                <p>
                  <span className="muted">Total canon (Y):</span>{' '}
                  <span className="font-mono">{totalCanon.toFixed(2)}</span>
                  <span className="muted"> (área × canon)</span>
                </p>
                <p>
                  <span className="muted">Total CAM (Z):</span>{' '}
                  <span className="font-mono">{totalCam.toFixed(2)}</span>
                  <span className="muted"> (área × CAM)</span>
                </p>
                <p>
                  <span className="muted">Total (AA):</span>{' '}
                  <span className="font-mono font-semibold">{total.toFixed(2)}</span>
                  <span className="muted"> (área × canon + área × CAM)</span>
                </p>
              </div>
            </div>
          </dl>
        </Card>
      </div>

      {/* ── Sección: Vigencia y estado (sin cambios) ───────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <Card pad>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide muted">
            Vigencia y estado
          </h2>
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
              <div className="dt">Estado</div>
              <div className="dd">
                <ContratoEstadoBadge estado={contrato.estado} />
              </div>
            </div>
            <div>
              <div className="dt">Creado</div>
              <div className="dd">{formatDateInPlazaTz(contrato.createdAt)}</div>
            </div>
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
      </div>

      {/* ── Sección: Notas (Excel AK + general) ──────────────────────────── */}
      <div style={{ marginTop: 16 }}>
        <Card pad>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide muted">Notas</h2>
          <dl className="dl">
            {contrato.condiciones && (
              <div className="full">
                <div className="dt">Condiciones generales</div>
                <div className="dd whitespace-pre-wrap">{contrato.condiciones}</div>
              </div>
            )}
            {contrato.condicionesIncrementoCanon && (
              <div className="full">
                <div className="dt">Condiciones de incremento de canon</div>
                <div className="dd whitespace-pre-wrap">{contrato.condicionesIncrementoCanon}</div>
              </div>
            )}
            {!contrato.condiciones && !contrato.condicionesIncrementoCanon && (
              <div className="full">
                <div className="dd muted">Sin notas registradas.</div>
              </div>
            )}
          </dl>
        </Card>
      </div>

      <div className="stack" style={{ marginTop: 20, gap: 12 }}>
        <h2 className="text-[15px] font-semibold">Contrato firmado (PDF)</h2>
        <AdjuntosContrato contratoId={contrato.id} adjuntos={adjuntos} canDelete />
      </div>
    </div>
  );
}