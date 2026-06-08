'use server';

import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

async function assertAdminPlaza(): Promise<void> {
  const session = await auth();
  const rol = session?.user?.rol;
  if (rol !== 'admin_plaza' && rol !== 'superadmin') {
    throw new Error('Forbidden');
  }
}

export interface PreviewResult {
  ok: boolean;
  error?: string;
  items?: Array<Record<string, unknown>>;
  total?: number;
}

/** T-144: previsualización de los primeros 10 registros del reporte. */
export async function previewReporteAction(
  entidad: string,
  filtros: Record<string, string>,
): Promise<PreviewResult> {
  await assertAdminPlaza();
  const qs = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => Boolean(v)),
  ).toString();
  const res = await apiFetch(`/reportes/${entidad}/preview${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, error: err.message ?? 'No se pudo previsualizar el reporte.' };
  }
  const data = (await res.json()) as { items: Array<Record<string, unknown>>; total: number };
  return { ok: true, items: data.items, total: data.total };
}
