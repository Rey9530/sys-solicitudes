'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { CreateLocalSchema, UpdateLocalSchema } from '@app/contracts';

// Tipos de ENTRADA (pre-coerción de Zod): lo que envían los formularios.
type CreateLocalFormInput = z.input<typeof CreateLocalSchema>;
type UpdateLocalFormInput = z.input<typeof UpdateLocalSchema>;
import { ForbiddenError, assertAnyCan } from '@/lib/server/assert-can';
import { apiFetch, errorFromResponse } from '@/lib/api';

/**
 * T-RBAC-1 · Server Actions de Locales.
 *
 * Cada acción valida el permiso granular con `assertAnyCan(...)` ANTES de
 * llamar al backend. La defensa real vive en el `PermissionsGuard` global
 * del backend; este helper es solo UX para evitar round-trips innecesarios
 * y emitir mensajes claros cuando el toast del cliente muestra el 403.
 *
 * Para acciones que NO requieren permiso granular (ej. lectura desde
 * `apiFetch` server-side en `page.tsx`) no se aplica gating aquí: la
 * página Server Component ya llamó a `assertCan('locales.listar')`.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Helper que envuelve `assertAnyCan` y traduce el `ForbiddenError` al
 * `ActionResult` estándar. Lanza cualquier otro error (red, validación,
 * etc.) para que el caller decida.
 */
/**
 * Helper que devuelve `null` si el usuario tiene AL MENOS UNO de los permisos,
 * o `{ ok: false; error }` si el `ForbiddenError` se dispara. Cualquier otro
 * error (red, validación, etc.) se relanza para que el caller decida.
 *
 * El tipo de retorno se restringe a la rama `false` para ser compatible con
 * los `Result` especializados de cada acción (e.g. `DownloadResult`,
 * `AltaUsuarioResult`) que extienden `ActionResult` con datos extra en `ok: true`.
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

export async function createLocalAction(input: CreateLocalFormInput): Promise<ActionResult> {
  const denied = await ensureCan(['locales.crear']);
  if (denied) return denied;
  const parsed = CreateLocalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch('/locales', { method: 'POST', body: JSON.stringify(parsed.data) });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo crear el local.') };
  revalidatePath('/admin/locales');
  return { ok: true };
}

export async function updateLocalAction(
  id: string,
  input: UpdateLocalFormInput,
): Promise<ActionResult> {
  const denied = await ensureCan(['locales.editar']);
  if (denied) return denied;
  const parsed = UpdateLocalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch(`/locales/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo actualizar el local.') };
  revalidatePath('/admin/locales');
  revalidatePath(`/admin/locales/${id}`);
  return { ok: true };
}

export async function deleteLocalAction(id: string): Promise<ActionResult> {
  const denied = await ensureCan(['locales.deshabilitar']);
  if (denied) return denied;
  const res = await apiFetch(`/locales/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo desactivar el local.') };
  }
  revalidatePath('/admin/locales');
  return { ok: true };
}

// ── Adjuntos del local (T-116, T-117) ─────────────────────────────────────────

/** Sube un archivo al local. El FormData viaja tal cual al backend (multipart). */
export async function subirAdjuntoLocalAction(
  localId: string,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await ensureCan(['locales.adjuntos.subir']);
  if (denied) return denied;
  const res = await apiFetch(`/locales/${localId}/adjuntos`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo subir el archivo.') };
  }
  revalidatePath(`/admin/locales/${localId}`);
  return { ok: true };
}

/** URL pre-firmada (15 min) para descargar un adjunto. */
export async function descargarAdjuntoLocalAction(
  adjuntoId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const denied = await ensureCan(['locales.adjuntos.descargar']);
  if (denied) return denied;
  const res = await apiFetch(`/adjuntos/${adjuntoId}/download`);
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo descargar.') };
  }
  const data = (await res.json()) as { url: string };
  return { ok: true, url: data.url };
}

/** Elimina un adjunto del local (soft delete + movimiento a quarantine). */
export async function eliminarAdjuntoLocalAction(
  localId: string,
  adjuntoId: string,
): Promise<ActionResult> {
  const denied = await ensureCan(['locales.adjuntos.eliminar']);
  if (denied) return denied;
  const res = await apiFetch(`/adjuntos/${adjuntoId}`, { method: 'DELETE' });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo eliminar.') };
  }
  revalidatePath(`/admin/locales/${localId}`);
  return { ok: true };
}
