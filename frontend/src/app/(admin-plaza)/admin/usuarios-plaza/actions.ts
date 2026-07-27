'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import {
  CreateRolStaffSchema,
  CreateUsuarioSchema,
  DisableUsuarioSchema,
  UpdateRolStaffSchema,
  UpdateUsuarioSchema,
  type CreateRolStaffInput,
  type CreateUsuarioInput,
  type UpdateRolStaffInput,
  type UpdateUsuarioInput,
} from '@app/contracts';
import { ForbiddenError, assertAnyCan } from '@/lib/server/assert-can';
import { apiFetch, errorFromResponse } from '@/lib/api';

/**
 * T-RBAC-1 · Server Actions de Usuarios-Plaza (staff) y Roles de Staff.
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

// ─────────────────────────────────────────────────────────────────────────────
// Usuarios admin_plaza (T-059-ter, derivado de T-059-bis pero para staff de plaza)

export type AltaUsuarioPlazaResult =
  | { ok: true; passwordTemporal: string }
  | { ok: false; error: string };

/**
 * Alta de usuario `admin_plaza` con `rol_staff` obligatorio. Genera contraseña
 * temporal segura, llama al backend con `rol: 'admin_plaza'` + `rolStaffId`, y
 * devuelve la contraseña al admin para que la comparta (mismo flujo que T-059
 * para inquilinos).
 */
export async function createUsuarioPlazaAction(input: {
  email: string;
  nombre: string;
  telefono?: string;
  rolStaffId: string;
}): Promise<AltaUsuarioPlazaResult> {
  const denied = await ensureCan(['usuarios_plaza.crear']);
  if (denied) return denied;
  const dto: CreateUsuarioInput = {
    email: input.email,
    nombre: input.nombre,
    telefono: input.telefono,
    password: `Tmp${randomBytes(9).toString('base64url')}1a`,
    rol: 'admin_plaza',
    rolStaffId: input.rolStaffId,
  };
  const parsed = CreateUsuarioSchema.safeParse(dto);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos' };
  }
  const res = await apiFetch('/usuarios', {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo crear el usuario.') };
  revalidatePath('/admin/usuarios-plaza');
  return { ok: true, passwordTemporal: dto.password };
}

/** Edita nombre, teléfono y/o rol_staff de un admin_plaza. */
export async function updateUsuarioPlazaAction(
  id: string,
  input: UpdateUsuarioInput,
): Promise<ActionResult> {
  const denied = await ensureCan(['usuarios_plaza.editar']);
  if (denied) return denied;
  const parsed = UpdateUsuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch(`/usuarios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo actualizar el usuario.') };
  }
  revalidatePath('/admin/usuarios-plaza');
  revalidatePath(`/admin/usuarios-plaza/${id}`);
  return { ok: true };
}

/**
 * Deshabilita un admin_plaza con motivo obligatorio. El backend aplica RN-AU-5
 * (rechaza 409 si es el último admin activo) y persiste el motivo en auditoría.
 */
export async function disableUsuarioPlazaAction(
  id: string,
  motivo: string,
): Promise<ActionResult> {
  const denied = await ensureCan(['usuarios_plaza.deshabilitar']);
  if (denied) return denied;
  const parsed = DisableUsuarioSchema.safeParse({ motivo });
  if (!parsed.success) {
    return { ok: false, error: 'Indica el motivo (mínimo 3 caracteres).' };
  }
  const res = await apiFetch(`/usuarios/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo deshabilitar el usuario.') };
  }
  revalidatePath('/admin/usuarios-plaza');
  return { ok: true };
}

/** Reactiva un admin_plaza previamente deshabilitado. */
export async function reactivateUsuarioPlazaAction(id: string): Promise<ActionResult> {
  const denied = await ensureCan(['usuarios_plaza.reactivar']);
  if (denied) return denied;
  const res = await apiFetch(`/usuarios/${id}/reactivate`, { method: 'POST' });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo reactivar el usuario.') };
  }
  revalidatePath('/admin/usuarios-plaza');
  return { ok: true };
}

/** Dispara un reset de contraseña por email al usuario (T-029 vía T-059-bis). */
export async function adminResetUsuarioPlazaAction(usuarioId: string): Promise<ActionResult> {
  const denied = await ensureCan(['usuarios_plaza.resetear_clave']);
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

// ─────────────────────────────────────────────────────────────────────────────
// Roles de staff (T-035)

export async function createRolStaffAction(input: CreateRolStaffInput): Promise<ActionResult> {
  const denied = await ensureCan(['roles_staff.crear']);
  if (denied) return denied;
  const parsed = CreateRolStaffSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Datos inválidos' };
  }
  const res = await apiFetch('/roles-staff', {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo crear el rol de staff.') };
  }
  revalidatePath('/admin/usuarios-plaza');
  return { ok: true };
}

export async function updateRolStaffAction(
  id: string,
  input: UpdateRolStaffInput,
): Promise<ActionResult> {
  const denied = await ensureCan(['roles_staff.editar']);
  if (denied) return denied;
  const parsed = UpdateRolStaffSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch(`/roles-staff/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo actualizar el rol de staff.') };
  }
  revalidatePath('/admin/usuarios-plaza');
  return { ok: true };
}

export type DisableRolStaffResult =
  | { ok: true; usuariosAsignados: number }
  | { ok: false; error: string };

/**
 * Soft delete de `rol_staff`. Devuelve `usuariosAsignados` para que el FE
 * muestre el warning de RN-RS-3 (los usuarios quedan con el FK inactivo
 * visible en la UI).
 */
export async function disableRolStaffAction(id: string): Promise<DisableRolStaffResult> {
  const denied = await ensureCan(['roles_staff.deshabilitar']);
  if (denied) return denied;
  const res = await apiFetch(`/roles-staff/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo desactivar el rol de staff.') };
  }
  const data = (await res.json().catch(() => ({}))) as { usuariosAsignados?: number };
  revalidatePath('/admin/usuarios-plaza');
  return { ok: true, usuariosAsignados: data.usuariosAsignados ?? 0 };
}