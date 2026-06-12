'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { UpdateSolicitudTipoConfigSchema } from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

type UpdateFormInput = z.input<typeof UpdateSolicitudTipoConfigSchema>;

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
  await assertAdminPlaza();
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

