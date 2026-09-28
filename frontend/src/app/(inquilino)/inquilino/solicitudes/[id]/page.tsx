import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { SolicitudDetailOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { SolicitudDetailInquilino } from '@/components/client/solicitud-detail-inquilino';

/** El número de solicitud también en el título de la pestaña (2026-09-28). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const res = await apiFetch(`/solicitudes/${id}`);
  if (!res.ok) return { title: 'Detalle de solicitud' };
  const { codigo } = (await res.json()) as { codigo: string };
  return { title: `${codigo} · Detalle de solicitud` };
}

/** Detalle de solicitud del inquilino (T-089). */
export default async function SolicitudDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await apiFetch(`/solicitudes/${id}`);
  if (!res.ok) notFound();
  const solicitud = (await res.json()) as SolicitudDetailOutput;

  return <SolicitudDetailInquilino solicitud={solicitud} />;
}
