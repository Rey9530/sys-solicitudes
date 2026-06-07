'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { CreateLocalSchema, UpdateLocalSchema } from '@app/contracts';

// Tipos de ENTRADA (pre-coerción de Zod): lo que envían los formularios.
type CreateLocalFormInput = z.input<typeof CreateLocalSchema>;
type UpdateLocalFormInput = z.input<typeof UpdateLocalSchema>;
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

/** Solo admin_plaza/superadmin operan el panel (el backend también lo exige). */
async function assertAdminPlaza(): Promise<void> {
  const session = await auth();
  const rol = session?.user?.rol;
  if (rol !== 'admin_plaza' && rol !== 'superadmin') {
    throw new Error('Forbidden');
  }
}

export type ActionResult = { ok: true } | { ok: false; error: string };

async function errorFrom(res: Response, fallback: string): Promise<string> {
  const err = (await res.json().catch(() => ({}))) as { message?: string; detail?: string };
  return err.message ?? err.detail ?? fallback;
}

export async function createLocalAction(input: CreateLocalFormInput): Promise<ActionResult> {
  await assertAdminPlaza();
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
  await assertAdminPlaza();
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
  await assertAdminPlaza();
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
  await assertAdminPlaza();
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
  await assertAdminPlaza();
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
  await assertAdminPlaza();
  const res = await apiFetch(`/adjuntos/${adjuntoId}`, { method: 'DELETE' });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo eliminar.') };
  }
  revalidatePath(`/admin/locales/${localId}`);
  return { ok: true };
}
