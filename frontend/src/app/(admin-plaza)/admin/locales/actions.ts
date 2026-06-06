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
