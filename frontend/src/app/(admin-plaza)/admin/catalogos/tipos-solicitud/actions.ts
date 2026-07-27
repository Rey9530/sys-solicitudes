'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { UpdateSolicitudTipoConfigSchema } from '@app/contracts';
import { ForbiddenError, assertAnyCan } from '@/lib/server/assert-can';
import { apiFetch, errorFromResponse } from '@/lib/api';

type UpdateFormInput = z.input<typeof UpdateSolicitudTipoConfigSchema>;

/**
 * T-RBAC-1 · Server Actions de Tipos de Solicitud.
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
  // Wrapper: delega en errorFromResponse.
  return errorFromResponse(res, fallback, 'legacy');
}

function revalidateTipos(id?: string): void {
  revalidatePath('/admin/catalogos/tipos-solicitud');
  if (id) revalidatePath(`/admin/catalogos/tipos-solicitud/${id}`);
  // Wizard + reportes consumen `loadTiposSolicitud` en cada server-render;
  // revalidar la raíz garantiza que el siguiente GET refresque la lista.
  revalidatePath('/inquilino/solicitudes/nueva');
  revalidatePath('/admin/reportes');
}

/**
 * Actualiza la configuración de un tipo de solicitud (T-V20).
 * El backend enforces:
 *  - `otro` no se puede desactivar (TIPO_INMUTABLE).
 *  - Tipo con solicitudes activas no se puede desactivar (TIPO_CON_SOLICITUDES_ACTIVAS).
 */
export async function updateTipoSolicitudAction(
  id: string,
  input: UpdateFormInput,
): Promise<ActionResult> {
  const denied = await ensureCan(['tipos_solicitud.editar']);
  if (denied) return denied;
  const parsed = UpdateSolicitudTipoConfigSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch(`/admin/tipos-solicitud/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo actualizar el tipo.') };
  }
  revalidateTipos(id);
  return { ok: true };
}