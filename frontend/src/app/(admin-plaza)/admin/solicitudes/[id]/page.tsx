import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import type { SolicitudDetailOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import {
  SolicitudDetailAdmin,
  type AdminOption,
} from '@/components/client/solicitud-detail-admin';

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

interface PaginatedUsuarios {
  items: Array<{
    id: string;
    nombre: string;
    email: string;
    rolStaffActivo: boolean | null;
  }>;
}

/** Detalle del admin con acciones del flujo (T-107). */
export default async function AdminSolicitudDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const [res, staffRes] = await Promise.all([
    apiFetch(`/solicitudes/${id}`),
    apiFetch('/usuarios?rol=admin_plaza&page=1&pageSize=100'),
  ]);
  if (!res.ok) notFound();
  const solicitud = (await res.json()) as SolicitudDetailOutput;
  const admins: AdminOption[] = staffRes.ok
    ? ((await staffRes.json()) as PaginatedUsuarios).items
        .filter((u) => u.rolStaffActivo === true)
        .map((u) => ({ id: u.id, nombre: u.nombre, email: u.email }))
    : [];

  return (
    <SolicitudDetailAdmin solicitud={solicitud} admins={admins} miUsuarioId={session.user.id} />
  );
}
