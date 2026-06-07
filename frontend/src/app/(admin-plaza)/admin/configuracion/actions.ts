'use server';

import { revalidatePath } from 'next/cache';
import {
  UpdateConfiguracionSchema,
  UpdatePlazaSchema,
  type UpdateConfiguracionInput,
  type UpdatePlazaInput,
} from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function assertAdminPlaza(): Promise<string> {
  const session = await auth();
  const rol = session?.user?.rol;
  if (rol !== 'admin_plaza' && rol !== 'superadmin') throw new Error('Forbidden');
  const plazaId = session?.user?.plazaId;
  if (!plazaId) throw new Error('Sin plaza asignada');
  return plazaId;
}

async function errorFrom(res: Response, fallback: string): Promise<string> {
  const err = (await res.json().catch(() => ({}))) as { message?: string; detail?: string };
  return err.message ?? err.detail ?? fallback;
}

/** T-145: SLA, MIME, tamaño, calendario (PATCH /configuracion de T-044). */
export async function updateConfiguracionAction(
  input: UpdateConfiguracionInput,
): Promise<ActionResult> {
  await assertAdminPlaza();
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
  const plazaId = await assertAdminPlaza();
  const parsed = UpdatePlazaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const res = await apiFetch(`/plazas/${plazaId}`, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo guardar la plaza.') };
  revalidatePath('/admin/configuracion');
  return { ok: true };
}

/** T-145: logo de la plaza (POST /plazas/:id/logo, reutiliza T-041). */
export async function uploadLogoAction(formData: FormData): Promise<ActionResult> {
  const plazaId = await assertAdminPlaza();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Selecciona un archivo PNG o SVG.' };
  }
  const res = await apiFetch(`/plazas/${plazaId}/logo`, { method: 'POST', body: formData });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo subir el logo.') };
  revalidatePath('/admin/configuracion');
  return { ok: true };
}
