'use server';

import { revalidatePath } from 'next/cache';
import type { EmailLogPreview } from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function assertAdminPlaza(): Promise<void> {
  const session = await auth();
  const rol = session?.user?.rol;
  if (rol !== 'admin_plaza' && rol !== 'superadmin') {
    throw new Error('Forbidden');
  }
}

async function errorFrom(res: Response, fallback: string): Promise<string> {
  const err = (await res.json().catch(() => ({}))) as { message?: string; detail?: string };
  return err.message ?? err.detail ?? fallback;
}

/** T-127: reintento manual de un email fallido. */
export async function reintentarEmailAction(id: string): Promise<ActionResult> {
  await assertAdminPlaza();
  const res = await apiFetch(`/notificaciones/${id}/reintentar`, { method: 'POST' });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo reintentar el email.') };
  revalidatePath('/admin/notificaciones');
  return { ok: true };
}

/** T-127: HTML renderizado para el modal "Ver contenido". */
export async function previewEmailAction(
  id: string,
): Promise<{ ok: true; preview: EmailLogPreview } | { ok: false; error: string }> {
  await assertAdminPlaza();
  const res = await apiFetch(`/notificaciones/${id}/preview`);
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo cargar el contenido.') };
  }
  return { ok: true, preview: (await res.json()) as EmailLogPreview };
}

/** T-125: resetear una desuscripción (vuelve a recibir esa plantilla). */
export async function resetUnsubscribeAction(id: string): Promise<ActionResult> {
  await assertAdminPlaza();
  const res = await apiFetch(`/notificaciones/unsubscribes/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo resetear la desuscripción.') };
  }
  revalidatePath('/admin/notificaciones');
  return { ok: true };
}
