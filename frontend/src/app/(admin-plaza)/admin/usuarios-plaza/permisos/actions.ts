'use server';

import { revalidatePath } from 'next/cache';
import { ForbiddenError, assertCan } from '@/lib/server/assert-can';
import { apiFetch } from '@/lib/api';

/**
 * T-RBAC-1 · Server Actions de la pestaña "Permisos" en
 * `/admin/usuarios-plaza/permisos`.
 *
 * Todas validan el permiso granular con `assertCan(...)` ANTES de llamar
 * al backend. La defensa real vive en el `PermissionsGuard` global del
 * backend (espejo de seguridad); el helper local es solo UX para evitar
 * round-trips innecesarios y mensajes claros en el toast.
 */

export interface AsignarPermisosResult {
  ok: boolean;
  error?: string;
}

/**
 * Reemplaza el set completo de permisos de un rol (PUT idempotente).
 * El backend rechaza si el rol es `es_sistema=true` con
 * `ROL_SISTEMA_NO_MODIFICABLE`; ese caso se traduce a un mensaje claro.
 */
export async function asignarPermisosRolAction(
  rolStaffId: string,
  permisoIds: string[],
): Promise<AsignarPermisosResult> {
  try {
    await assertCan(['roles_staff.gestionar_permisos', 'permisos.asignar_a_roles']);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const res = await apiFetch(`/permisos/roles/${rolStaffId}`, {
    method: 'PUT',
    body: JSON.stringify({ permisoIds }),
  });

  if (!res.ok) {
    const code = await extractCode(res);
    if (code === 'ROL_SISTEMA_NO_MODIFICABLE') {
      return {
        ok: false,
        error: 'El rol del sistema es inamovible. No se pueden modificar sus permisos.',
      };
    }
    if (code === 'PERMISO_NO_ENCONTRADO' || code === 'ROL_STAFF_NO_ENCONTRADO') {
      return { ok: false, error: 'Algunos permisos o el rol seleccionado ya no existen. Recarga la página.' };
    }
    if (code === 'PERMISSION_DENIED') {
      return { ok: false, error: 'No tienes permiso para modificar permisos de roles.' };
    }
    return { ok: false, error: `Error al guardar permisos (${res.status}).` };
  }

  revalidatePath('/admin/usuarios-plaza/permisos');
  revalidatePath('/admin/usuarios-plaza');
  return { ok: true };
}

/**
 * Asigna un permiso individual (alternativa deprecada por la matriz UI;
 * mantenida por compatibilidad y para uso programático).
 */
export async function agregarPermisoRolAction(
  rolStaffId: string,
  permisoId: string,
): Promise<AsignarPermisosResult> {
  try {
    await assertCan(['roles_staff.gestionar_permisos', 'permisos.asignar_a_roles']);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const res = await apiFetch(`/permisos/roles/${rolStaffId}/permisos/${permisoId}`, {
    method: 'POST',
  });

  if (!res.ok) {
    const code = await extractCode(res);
    return { ok: false, error: code === 'ROL_SISTEMA_NO_MODIFICABLE'
      ? 'El rol del sistema es inamovible.'
      : `Error al asignar permiso (${res.status}).` };
  }

  revalidatePath('/admin/usuarios-plaza/permisos');
  return { ok: true };
}

/**
 * Quita un permiso individual de un rol. El backend rechaza si el rol es
 * `es_sistema=true`.
 */
export async function quitarPermisoRolAction(
  rolStaffId: string,
  permisoId: string,
): Promise<AsignarPermisosResult> {
  try {
    await assertCan(['roles_staff.gestionar_permisos', 'permisos.asignar_a_roles']);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const res = await apiFetch(`/permisos/roles/${rolStaffId}/permisos/${permisoId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const code = await extractCode(res);
    return { ok: false, error: code === 'ROL_SISTEMA_NO_MODIFICABLE'
      ? 'El rol del sistema es inamovible. No se pueden quitar sus permisos.'
      : `Error al quitar permiso (${res.status}).` };
  }

  revalidatePath('/admin/usuarios-plaza/permisos');
  return { ok: true };
}

/**
 * Extrae `code` del body de error RFC 7807 del backend. Tolera fallos
 * de parseo (respuesta vacía o HTML).
 */
async function extractCode(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { code?: string };
    return body.code;
  } catch {
    return undefined;
  }
}
