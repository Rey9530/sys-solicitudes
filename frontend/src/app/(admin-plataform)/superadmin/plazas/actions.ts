'use server';

import { revalidatePath } from 'next/cache';
import { CreatePlazaSchema, type CreatePlazaInput } from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

/** Solo superadmin opera el admin-plataform (verificación también en el backend). */
async function assertSuperadmin(): Promise<void> {
  const session = await auth();
  if (session?.user?.rol !== 'superadmin') {
    throw new Error('Forbidden');
  }
}

export type CreatePlazaResult = { ok: true } | { ok: false; error: string };

export async function createPlazaAction(input: CreatePlazaInput): Promise<CreatePlazaResult> {
  await assertSuperadmin();
  const parsed = CreatePlazaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos' };
  }
  const res = await apiFetch('/plazas', {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, error: err.message ?? 'No se pudo crear la plaza.' };
  }
  revalidatePath('/superadmin/plazas');
  return { ok: true };
}

export async function deactivatePlazaAction(id: string): Promise<{ ok: boolean }> {
  await assertSuperadmin();
  const res = await apiFetch(`/plazas/${id}`, { method: 'DELETE' });
  if (res.ok) revalidatePath('/superadmin/plazas');
  return { ok: res.ok };
}
