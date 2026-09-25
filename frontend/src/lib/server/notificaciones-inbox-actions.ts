'use server';

import type { NotificacionesConteoOutput, NotificacionesInboxOutput } from '@app/contracts';
import { apiFetch, errorFromResponse } from '@/lib/api';

/**
 * Server Actions de la campana del topbar (notificaciones in-app,
 * PLANIFICACION/16). BFF: el JWT nunca llega al cliente (S-ARQ-F).
 *
 * Sin `assertAnyCan`: es la bandeja PROPIA del usuario; el backend filtra
 * por plaza (RLS) + usuario_id = JWT.sub y restringe a admin_plaza/inquilino.
 */

export type InboxResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function getNotificacionesConteoAction(): Promise<
  InboxResult<NotificacionesConteoOutput>
> {
  const res = await apiFetch('/notificaciones/inbox/conteo');
  if (!res.ok) {
    return {
      ok: false,
      error: await errorFromResponse(res, 'No se pudo leer el conteo.', 'inbox'),
    };
  }
  return { ok: true, data: (await res.json()) as NotificacionesConteoOutput };
}

export async function getNotificacionesInboxAction(): Promise<
  InboxResult<NotificacionesInboxOutput>
> {
  const res = await apiFetch('/notificaciones/inbox?limit=20');
  if (!res.ok) {
    return {
      ok: false,
      error: await errorFromResponse(res, 'No se pudieron cargar las notificaciones.', 'inbox'),
    };
  }
  return { ok: true, data: (await res.json()) as NotificacionesInboxOutput };
}

export async function marcarNotificacionLeidaAction(id: string): Promise<InboxResult<null>> {
  const res = await apiFetch(`/notificaciones/inbox/${encodeURIComponent(id)}/leer`, {
    method: 'POST',
  });
  if (!res.ok) {
    return {
      ok: false,
      error: await errorFromResponse(res, 'No se pudo marcar como leída.', 'inbox'),
    };
  }
  return { ok: true, data: null };
}

export async function marcarTodasLeidasAction(): Promise<InboxResult<null>> {
  const res = await apiFetch('/notificaciones/inbox/leer-todas', { method: 'POST' });
  if (!res.ok) {
    return {
      ok: false,
      error: await errorFromResponse(res, 'No se pudieron marcar como leídas.', 'inbox'),
    };
  }
  return { ok: true, data: null };
}
