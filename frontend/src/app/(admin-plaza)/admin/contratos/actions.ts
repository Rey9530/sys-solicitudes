'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  CreateContratoSchema,
  CerrarContratoSchema,
  RenovarContratoSchema,
} from '@app/contracts';

// Tipos de ENTRADA (pre-defaults/coerción de Zod): lo que envían los formularios.
type CreateContratoFormInput = z.input<typeof CreateContratoSchema>;
type CerrarContratoFormInput = z.input<typeof CerrarContratoSchema>;
type RenovarContratoFormInput = z.input<typeof RenovarContratoSchema>;
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

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

function revalidateContratos(id?: string): void {
  revalidatePath('/admin/contratos');
  revalidatePath('/admin/locales');
  if (id) revalidatePath(`/admin/contratos/${id}`);
}

export async function createContratoAction(
  input: CreateContratoFormInput,
): Promise<ActionResult> {
  await assertAdminPlaza();
  const parsed = CreateContratoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch('/contratos', {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo crear el contrato.') };
  revalidateContratos();
  return { ok: true };
}

export async function cerrarContratoAction(
  id: string,
  input: CerrarContratoFormInput,
): Promise<ActionResult> {
  await assertAdminPlaza();
  const parsed = CerrarContratoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch(`/contratos/${id}/cerrar`, {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo cerrar el contrato.') };
  revalidateContratos(id);
  return { ok: true };
}

export async function renovarContratoAction(
  id: string,
  input: RenovarContratoFormInput,
): Promise<ActionResult> {
  await assertAdminPlaza();
  const parsed = RenovarContratoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch(`/contratos/${id}/renovar`, {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo renovar el contrato.') };
  }
  revalidateContratos(id);
  return { ok: true };
}

/** Subida del PDF firmado (T-062). El FormData viaja tal cual al backend. */
export async function subirAdjuntoContratoAction(
  contratoId: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: 'No autenticado' };
  const res = await apiFetch(`/contratos/${contratoId}/adjuntos`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo subir el archivo.') };
  revalidatePath(`/admin/contratos/${contratoId}`);
  revalidatePath(`/inquilino/contratos/${contratoId}`);
  return { ok: true };
}

export type DownloadResult = { ok: true; url: string } | { ok: false; error: string };

export async function descargarAdjuntoAction(adjuntoId: string): Promise<DownloadResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: 'No autenticado' };
  const res = await apiFetch(`/adjuntos/${adjuntoId}/download`);
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo descargar.') };
  const data = (await res.json()) as { url: string };
  return { ok: true, url: data.url };
}

export async function eliminarAdjuntoAction(
  adjuntoId: string,
  contratoId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: 'No autenticado' };
  const res = await apiFetch(`/adjuntos/${adjuntoId}`, { method: 'DELETE' });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo eliminar.') };
  revalidatePath(`/admin/contratos/${contratoId}`);
  revalidatePath(`/inquilino/contratos/${contratoId}`);
  return { ok: true };
}
