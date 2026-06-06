import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ContratoDetailOutput, AdjuntoOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { ContratoEstadoBadge } from '@/components/estado-badge';
import { AdjuntosContrato } from '@/components/client/adjuntos-contrato';

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
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">
          <Link href="/inquilino/contratos" className="hover:underline">
            Mis contratos
          </Link>{' '}
          / {contrato.localCodigo}
        </p>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900">
          Local {contrato.localCodigo}
          <ContratoEstadoBadge estado={contrato.estado} />
        </h1>
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
          <p className="text-xs text-gray-500">Moneda</p>
          <p className="font-medium">{contrato.moneda}</p>
        </div>
        {contrato.condiciones && (
          <div className="col-span-2 md:col-span-4">
            <p className="text-xs text-gray-500">Condiciones</p>
            <p className="whitespace-pre-wrap">{contrato.condiciones}</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Contrato firmado (PDF)</h2>
        {/* El inquilino puede subir/descargar; solo borra lo que subió (backend valida). */}
        <AdjuntosContrato contratoId={contrato.id} adjuntos={adjuntos} canDelete />
      </div>
    </div>
  );
}
