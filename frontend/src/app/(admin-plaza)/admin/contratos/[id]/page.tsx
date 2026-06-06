import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ContratoDetailOutput, AdjuntoOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { ContratoEstadoBadge } from '@/components/estado-badge';
import { CerrarContratoDialog } from '@/components/client/cerrar-contrato-dialog';
import { RenovarContratoDialog } from '@/components/client/renovar-contrato-dialog';
import { AdjuntosContrato } from '@/components/client/adjuntos-contrato';
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
    <div className="space-y-6">
      {/* Banner de ventana de vencimiento (T-060) */}
      {contrato.enVentanaT7 ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          ⚠️ Este contrato vence en 7 días o menos ({contrato.fechaFin}). Renueva o cierra.
        </div>
      ) : contrato.enVentanaT30 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          ⚠️ Este contrato vence en 30 días o menos ({contrato.fechaFin}).
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            <Link href="/admin/contratos" className="hover:underline">
              Contratos
            </Link>{' '}
            / {contrato.localCodigo}
          </p>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900">
            {contrato.localCodigo} · {contrato.inquilinoRazonSocial}
            <ContratoEstadoBadge estado={contrato.estado} />
          </h1>
        </div>
        {contrato.estado === 'vigente' && (
          <div className="flex gap-2">
            <RenovarContratoDialog contrato={contrato} />
            <CerrarContratoDialog contrato={contrato} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border bg-white p-6 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs text-gray-500">Inicio</p>
          <p className="font-medium">{contrato.fechaInicio}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Fin</p>
          <p className="font-medium">{contrato.fechaFin ?? 'Indefinido'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Monto mensual</p>
          <p className="font-medium">
            {contrato.montoMensual !== null
              ? `${contrato.moneda} ${contrato.montoMensual}`
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Creado</p>
          <p className="font-medium">{formatDateInPlazaTz(contrato.createdAt)}</p>
        </div>
        {contrato.condiciones && (
          <div className="col-span-2 md:col-span-4">
            <p className="text-xs text-gray-500">Condiciones</p>
            <p className="whitespace-pre-wrap">{contrato.condiciones}</p>
          </div>
        )}
        {contrato.estado !== 'vigente' && (
          <>
            <div>
              <p className="text-xs text-gray-500">Fin efectivo</p>
              <p className="font-medium">{contrato.fechaFinEfectiva ?? '—'}</p>
            </div>
            <div className="col-span-2 md:col-span-3">
              <p className="text-xs text-gray-500">Motivo de cierre</p>
              <p className="font-medium">{contrato.motivoFin ?? '—'}</p>
            </div>
          </>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Contrato firmado (PDF)</h2>
        <AdjuntosContrato contratoId={contrato.id} adjuntos={adjuntos} canDelete />
      </div>
    </div>
  );
}
