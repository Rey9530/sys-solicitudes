'use server';

import { ChangePasswordSchema, type ChangePasswordInput } from '@app/contracts';
import { apiFetch } from '@/lib/api';

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: string; field?: 'currentPassword' | 'newPassword' };

/**
 * Cambio de contraseña del usuario autenticado (T-030 · `PATCH /auth/change-password`).
 * El backend revoca TODOS los refresh tokens del usuario; el cliente debe cerrar
 * la sesión local a continuación (`logoutAndRedirect`).
 */
export async function changePasswordAction(
  input: ChangePasswordInput,
): Promise<ChangePasswordResult> {
  const parsed = ChangePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' };
  }

  const res = await apiFetch('/auth/change-password', {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (res.ok) return { ok: true };

  const body = (await res.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
    detail?: string;
  };
  const error = body.message ?? body.detail ?? 'No se pudo cambiar la contraseña.';
  if (body.code === 'INVALID_CURRENT_PASSWORD')
    return { ok: false, error, field: 'currentPassword' };
  if (body.code === 'SAME_PASSWORD') return { ok: false, error, field: 'newPassword' };
  return { ok: false, error };
}
