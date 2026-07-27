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
import { ForbiddenError, assertAnyCan } from '@/lib/server/assert-can';
import { apiFetch, errorFromResponse } from '@/lib/api';

/**
 * T-RBAC-1 · Server Actions de Inquilinos.
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

export async function createInquilinoAction(input: CreateInquilinoInput): Promise<ActionResult> {
  const denied = await ensureCan(['inquilinos.crear']);
  if (denied) return denied;
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
  const denied = await ensureCan(['inquilinos.editar']);
  if (denied) return denied;
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
  const denied = await ensureCan(['inquilinos.deshabilitar']);
  if (denied) return denied;
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
  const denied = await ensureCan(['inquilinos.alta_usuario']);
  if (denied) return denied;
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
  const denied = await ensureCan(['inquilinos.deshabilitar_usuario']);
  if (denied) return denied;
  const res = await apiFetch(`/usuarios/${usuarioId}`, { method: 'DELETE' });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo deshabilitar el usuario.') };
  return { ok: true };
}

/** Reactiva un usuario previamente deshabilitado. 409 si ya estaba activo. */
export async function reactivateUsuarioInquilinoAction(
  usuarioId: string,
): Promise<ActionResult> {
  const denied = await ensureCan(['inquilinos.reactivar_usuario']);
  if (denied) return denied;
  const res = await apiFetch(`/usuarios/${usuarioId}/reactivate`, { method: 'POST' });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo reactivar el usuario.') };
  return { ok: true };
}

/** Dispara un reset de contraseña por email (T-029 vía T-059-bis). */
export async function adminResetUsuarioPasswordAction(
  usuarioId: string,
): Promise<ActionResult> {
  const denied = await ensureCan(['inquilinos.resetear_clave']);
  if (denied) return denied;
  const res = await apiFetch(`/usuarios/${usuarioId}/reset-password`, { method: 'POST' });
  if (!res.ok) {
    return {
      ok: false,
      error: await errorFrom(res, 'No se pudo disparar el reset de contraseña.'),
    };
  }
  return { ok: true };
}

/**
 * Edita nombre y teléfono de un usuario inquilino.
 *
 * Nota: el catálogo no tiene `inquilinos.editar_usuario` específico; usamos
 * `inquilinos.editar` como permiso paraguas (la operación afecta datos del
 * inquilino o de su usuario asociado).
 */
export async function updateUsuarioInquilinoAction(
  usuarioId: string,
  input: UpdateUsuarioInput,
): Promise<ActionResult> {
  const denied = await ensureCan(['inquilinos.editar']);
  if (denied) return denied;
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