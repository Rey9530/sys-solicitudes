'use server';

import { revalidatePath } from 'next/cache';
import {
  UpdateConfiguracionSchema,
  UpdatePlazaSchema,
  type UpdateConfiguracionInput,
  type UpdatePlazaInput,
} from '@app/contracts';
import { auth } from '@/auth';
import { ForbiddenError, assertAnyCan } from '@/lib/server/assert-can';
import { apiFetch, errorFromResponse } from '@/lib/api';
import { getSelectedPlazaId } from '@/lib/selected-plaza';

/**
 * T-RBAC-1 · Server Actions de Configuración de plaza.
 *
 * Cada acción valida el permiso granular con `assertAnyCan(...)` ANTES de
 * llamar al backend. La defensa real vive en el `PermissionsGuard` global
 * del backend; este helper es solo UX para evitar round-trips innecesarios
 * y emitir mensajes claros cuando el toast del cliente muestra el 403.
 *
 * Para `updateConfiguracionAction` y `updatePlazaAction` se acepta un OR de
 * varios permisos porque el formulario permite editar múltiples dominios
 * (SLA / MIME / tamaño / calendario en un solo PATCH; branding + datos
 * generales en otro). El backend enforces la granularidad fina por campo.
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

/**
 * Plaza objetivo de las acciones de branding/datos generales. Se resuelve en el
 * servidor (nunca desde el cliente): admin_plaza → `plazaId` de su sesión;
 * superadmin → la plaza que eligió en el selector. No existe `/plazas/me` en el
 * backend, por lo que sin id la acción falla con un mensaje claro.
 */
async function resolvePlazaId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.rol === 'superadmin') return getSelectedPlazaId();
  return session.user.plazaId ?? null;
}

async function errorFrom(res: Response, fallback: string): Promise<string> {
  // Wrapper: delega en errorFromResponse para tener logging + code/requestId en consola.
  return errorFromResponse(res, fallback, 'legacy');
}

/** T-145: SLA, MIME, tamaño, calendario (PATCH /configuracion de T-044). */
export async function updateConfiguracionAction(
  input: UpdateConfiguracionInput,
): Promise<ActionResult> {
  const denied = await ensureCan([
    'configuracion.editar_sla',
    'configuracion.editar_adjuntos',
    'configuracion.editar_calendario',
  ]);
  if (denied) return denied;
  const parsed = UpdateConfiguracionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await apiFetch('/configuracion', {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo guardar la configuración.') };
  }
  revalidatePath('/admin/configuracion');
  return { ok: true };
}

/** T-145: datos generales y branding de la plaza (PATCH /plazas/:id, T-V08). */
export async function updatePlazaAction(input: UpdatePlazaInput): Promise<ActionResult> {
  const denied = await ensureCan([
    'configuracion.editar_general',
    'configuracion.editar_branding',
  ]);
  if (denied) return denied;
  const parsed = UpdatePlazaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const plazaId = await resolvePlazaId();
  if (!plazaId) return { ok: false, error: 'No hay una plaza seleccionada.' };
  const path = `/plazas/${plazaId}`;
  const res = await apiFetch(path, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo guardar la plaza.') };
  revalidatePath('/admin/configuracion');
  return { ok: true };
}

/** T-145: logo de la plaza (POST /plazas/:id/logo, reutiliza T-041). */
export async function uploadLogoAction(formData: FormData): Promise<ActionResult> {
  const denied = await ensureCan(['configuracion.editar_branding']);
  if (denied) return denied;
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Selecciona un archivo PNG o SVG.' };
  }
  const plazaId = await resolvePlazaId();
  if (!plazaId) return { ok: false, error: 'No hay una plaza seleccionada.' };
  const path = `/plazas/${plazaId}/logo`;
  const res = await apiFetch(path, { method: 'POST', body: formData });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo subir el logo.') };
  revalidatePath('/admin/configuracion');
  return { ok: true };
}