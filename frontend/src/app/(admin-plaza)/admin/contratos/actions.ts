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
import { ForbiddenError, assertAnyCan } from '@/lib/server/assert-can';
import { apiFetch, errorFromResponse } from '@/lib/api';

/**
 * T-RBAC-1 · Server Actions de Contratos.
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

function revalidateContratos(id?: string): void {
  revalidatePath('/admin/contratos');
  revalidatePath('/admin/locales');
  if (id) revalidatePath(`/admin/contratos/${id}`);
}

export async function createContratoAction(
  input: CreateContratoFormInput,
): Promise<ActionResult> {
  const denied = await ensureCan(['contratos.crear']);
  if (denied) return denied;
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
  const denied = await ensureCan(['contratos.cerrar']);
  if (denied) return denied;
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
  const denied = await ensureCan(['contratos.renovar']);
  if (denied) return denied;
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
  const denied = await ensureCan(['contratos.adjuntos.subir']);
  if (denied) return denied;
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

/**
 * Descarga de adjunto desde el módulo de contratos. El endpoint
 * `/adjuntos/:id/download` es polimórfico: el permiso concreto depende
 * del recurso padre. Aceptamos cualquiera de los permisos de descarga de
 * adjuntos del sistema (mismo criterio que el `PermissionsGuard` del BE).
 */
export async function descargarAdjuntoAction(adjuntoId: string): Promise<DownloadResult> {
  const denied = await ensureCan([
    'solicitudes.adjuntos.descargar',
    'locales.adjuntos.descargar',
    'contratos.adjuntos.descargar',
  ]);
  if (denied) return denied;
  const res = await apiFetch(`/adjuntos/${adjuntoId}/download`);
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo descargar.') };
  const data = (await res.json()) as { url: string };
  return { ok: true, url: data.url };
}

/**
 * Elimina un adjunto desde el módulo de contratos. Idem descargar: el
 * endpoint `/adjuntos/:id` es polimórfico. Aceptamos cualquiera de los
 * permisos de eliminación de adjuntos del sistema.
 */
export async function eliminarAdjuntoAction(
  adjuntoId: string,
  contratoId: string,
): Promise<ActionResult> {
  const denied = await ensureCan([
    'solicitudes.adjuntos.eliminar',
    'locales.adjuntos.eliminar',
    'contratos.adjuntos.eliminar',
  ]);
  if (denied) return denied;
  const res = await apiFetch(`/adjuntos/${adjuntoId}`, { method: 'DELETE' });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo eliminar.') };
  revalidatePath(`/admin/contratos/${contratoId}`);
  revalidatePath(`/inquilino/contratos/${contratoId}`);
  return { ok: true };
}