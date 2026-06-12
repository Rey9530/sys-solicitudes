'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import {
  CreateInquilinoSchema,
  UpdateInquilinoSchema,
  UpdateUsuarioSchema,
  type CreateInquilinoInput,
  type UpdateInquilinoInput,
  type UpdateUsuarioInput,
} from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

async function assertAdminPlaza(): Promise<void> {
  const session = await auth();
  const rol = session?.user?.rol;
  console.log('assertAdminPlaza: user rol:', rol);
  if (rol !== 'admin_plaza' && rol !== 'superadmin') {
    throw new Error('Forbidden');
  }
}

export type ActionResult = { ok: true } | { ok: false; error: string };

async function errorFrom(res: Response, fallback: string): Promise<string> {
  const err = (await res.json().catch(() => ({}))) as { message?: string; detail?: string };
  return err.message ?? err.detail ?? fallback;
}

export async function createInquilinoAction(input: CreateInquilinoInput): Promise<ActionResult> {
  await assertAdminPlaza();
  const parsed = CreateInquilinoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch('/inquilinos', {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo crear el inquilino.') };
  revalidatePath('/admin/inquilinos');
  return { ok: true };
}

export async function updateInquilinoAction(
  id: string,
  input: UpdateInquilinoInput,
): Promise<ActionResult> {
  await assertAdminPlaza();
  const parsed = UpdateInquilinoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch(`/inquilinos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo actualizar el inquilino.') };
  }
  revalidatePath('/admin/inquilinos');
  revalidatePath(`/admin/inquilinos/${id}`);
  return { ok: true };
}

export async function deleteInquilinoAction(id: string): Promise<ActionResult> {
  await assertAdminPlaza();
  const res = await apiFetch(`/inquilinos/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo desactivar el inquilino.') };
  }
  revalidatePath('/admin/inquilinos');
  return { ok: true };
}

/**
 * Alta rápida de usuario asociado al inquilino (T-059, subconjunto de T-034):
 * genera una contraseña temporal segura, crea el usuario rol `inquilino` vía
 * el backend (que envía el email de bienvenida) y devuelve la contraseña para
 * mostrarla UNA vez al admin (el mailer provisional no la incluye, T-118).
 */
export type AltaUsuarioResult =
  | { ok: true; passwordTemporal: string }
  | { ok: false; error: string };

export async function altaUsuarioInquilinoAction(input: {
  inquilinoId: string;
  email: string;
  nombre: string;
}): Promise<AltaUsuarioResult> {
  await assertAdminPlaza();
  // Password temporal que cumple la política (mayúscula + minúscula + dígito).
  const passwordTemporal = `Tmp${randomBytes(9).toString('base64url')}1a`;
  const res = await apiFetch('/usuarios', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      nombre: input.nombre,
      password: passwordTemporal,
      rol: 'inquilino',
      inquilinoId: input.inquilinoId,
    }),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo crear el usuario.') };
  revalidatePath(`/admin/inquilinos/${input.inquilinoId}`);
  return { ok: true, passwordTemporal };
}

// ─────────────────────────────────────────────────────────────────────────────
// T-059-bis: gestión de usuarios del inquilino desde la pestaña "Usuarios".

/** Deshabilita (soft delete) un usuario. 409 si ya estaba inactivo. */
export async function disableUsuarioInquilinoAction(
  usuarioId: string,
): Promise<ActionResult> {
  await assertAdminPlaza();
  const res = await apiFetch(`/usuarios/${usuarioId}`, { method: 'DELETE' });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo deshabilitar el usuario.') };
  return { ok: true };
}

/** Reactiva un usuario previamente deshabilitado. 409 si ya estaba activo. */
export async function reactivateUsuarioInquilinoAction(
  usuarioId: string,
): Promise<ActionResult> {
  await assertAdminPlaza();
  const res = await apiFetch(`/usuarios/${usuarioId}/reactivate`, { method: 'POST' });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo reactivar el usuario.') };
  return { ok: true };
}

/** Dispara un reset de contraseña por email (T-029 vía T-059-bis). */
export async function adminResetUsuarioPasswordAction(
  usuarioId: string,
): Promise<ActionResult> {
  await assertAdminPlaza();
  const res = await apiFetch(`/usuarios/${usuarioId}/reset-password`, { method: 'POST' });
  if (!res.ok) {
    return {
      ok: false,
      error: await errorFrom(res, 'No se pudo disparar el reset de contraseña.'),
    };
  }
  return { ok: true };
}

/** Edita nombre y teléfono de un usuario. */
export async function updateUsuarioInquilinoAction(
  usuarioId: string,
  input: UpdateUsuarioInput,
): Promise<ActionResult> {
  await assertAdminPlaza();
  const parsed = UpdateUsuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch(`/usuarios/${usuarioId}`, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo actualizar el usuario.') };
  }
  return { ok: true };
}
