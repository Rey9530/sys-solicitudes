'use server';

import type { CalendarioEventoOutput } from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

export interface CalendarioFeedParams {
  from: string;
  to: string;
  localId?: string[];
  inquilinoId?: string[];
  tipo?: string[];
}

async function assertAutenticado(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');
}

/** T-129/T-133: feed para FullCalendar vía BFF (el JWT nunca toca el cliente). */
export async function fetchCalendarioFeedAction(
  params: CalendarioFeedParams,
): Promise<{ ok: true; eventos: CalendarioEventoOutput[] } | { ok: false; error: string }> {
  await assertAutenticado();
  const qs = new URLSearchParams({ from: params.from, to: params.to });
  if (params.localId?.length) qs.set('localId', params.localId.join(','));
  if (params.inquilinoId?.length) qs.set('inquilinoId', params.inquilinoId.join(','));
  if (params.tipo?.length) qs.set('tipo', params.tipo.join(','));
  const res = await apiFetch(`/calendario?${qs.toString()}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, error: err.message ?? 'No se pudo cargar el calendario.' };
  }
  return { ok: true, eventos: (await res.json()) as CalendarioEventoOutput[] };
}

/** Drag-and-drop del admin (T-133): mueve un evento aprobado. */
export async function moverEventoAction(
  eventoId: string,
  inicio: string,
  fin: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.rol !== 'admin_plaza' && session?.user?.rol !== 'superadmin') {
    return { ok: false, error: 'Solo un administrador puede mover eventos.' };
  }
  const res = await apiFetch(`/calendario/eventos/${eventoId}/fechas`, {
    method: 'PATCH',
    body: JSON.stringify({ inicio, fin }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, error: err.message ?? 'No se pudo mover el evento.' };
  }
  return { ok: true };
}
