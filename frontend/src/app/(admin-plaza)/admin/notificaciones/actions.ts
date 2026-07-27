'use server';

import { revalidatePath } from 'next/cache';
import type { EmailLogPreview } from '@app/contracts';
import { ForbiddenError, assertAnyCan } from '@/lib/server/assert-can';
import { apiFetch, errorFromResponse } from '@/lib/api';

/**
 * T-RBAC-1 · Server Actions de Notificaciones.
 *
 * Cada acción valida el permiso granular con `assertAnyCan(...)` ANTES de
 * llamar al backend. La defensa real vive en el `PermissionsGuard` global
 * del backend; este helper es solo UX para evitar round-trips innecesarios
 * y emitir mensajes claros cuando el toast del cliente muestra el 403.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Helper que envuelve `assertAnyCan` y traduce el `ForbiddenError` al
 * `ActionResult` estándar. Lanza cualquier otro error (red, validación,
 * etc.) para que el caller decida.
 */
async function ensureCan(
  permisos: string[],
): Promise<{ ok: false; error: string } | null> {
  try {
    await assertAnyCan(permisos);
    return null;
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}

async function errorFrom(res: Response, fallback: string): Promise<string> {
  // Wrapper: delega en errorFromResponse para tener logging + code/requestId en consola.
  return errorFromResponse(res, fallback, 'legacy');
}

/** T-127: reintento manual de un email fallido. */
export async function reintentarEmailAction(id: string): Promise<ActionResult> {
  const denied = await ensureCan(['notificaciones.reintentar']);
  if (denied) return denied;
  const res = await apiFetch(`/notificaciones/${id}/reintentar`, { method: 'POST' });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo reintentar el email.') };
  revalidatePath('/admin/notificaciones');
  return { ok: true };
}

/** T-127: HTML renderizado para el modal "Ver contenido". */
export async function previewEmailAction(
  id: string,
): Promise<{ ok: true; preview: EmailLogPreview } | { ok: false; error: string }> {
  const denied = await ensureCan(['notificaciones.ver_preview']);
  if (denied) return denied;
  const res = await apiFetch(`/notificaciones/${id}/preview`);
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo cargar el contenido.') };
  }
  return { ok: true, preview: (await res.json()) as EmailLogPreview };
}

/** T-125: resetear una desuscripción (vuelve a recibir esa plantilla). */
export async function resetUnsubscribeAction(id: string): Promise<ActionResult> {
  const denied = await ensureCan(['notificaciones.gestionar_desuscripciones']);
  if (denied) return denied;
  const res = await apiFetch(`/notificaciones/unsubscribes/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo resetear la desuscripción.') };
  }
  revalidatePath('/admin/notificaciones');
  return { ok: true };
}