'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { CreatePlazaSchema, type CreatePlazaInput } from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';
import { SELECTED_PLAZA_COOKIE } from '@/lib/selected-plaza';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

/**
 * Selecciona (o limpia) la plaza sobre la que el superadmin "actúa". Persiste un
 * UUID validado en una cookie httpOnly; `apiFetch` la reenvía como `x-plaza-id`
 * SOLO para superadmin. `null` limpia la selección (vuelve a contexto global).
 */
export async function selectPlazaAction(plazaId: string | null): Promise<{ ok: boolean }> {
  await assertSuperadmin();
  const store = await cookies();
  if (!plazaId) {
    store.delete(SELECTED_PLAZA_COOKIE);
    return { ok: true };
  }
  if (!UUID_RE.test(plazaId)) {
    return { ok: false };
  }
  store.set(SELECTED_PLAZA_COOKIE, plazaId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
  return { ok: true };
}
