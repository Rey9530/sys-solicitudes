'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  CreateCategoriaSchema,
  UpdateCategoriaSchema,
  CreateSubcategoriaSchema,
  UpdateSubcategoriaSchema,
} from '@app/contracts';
import { ForbiddenError, assertAnyCan } from '@/lib/server/assert-can';
import { apiFetch, errorFromResponse } from '@/lib/api';

// Tipos de ENTRADA (pre-coerción de Zod): lo que envían los formularios.
type CreateCategoriaFormInput = z.input<typeof CreateCategoriaSchema>;
type UpdateCategoriaFormInput = z.input<typeof UpdateCategoriaSchema>;
type CreateSubcategoriaFormInput = z.input<typeof CreateSubcategoriaSchema>;
type UpdateSubcategoriaFormInput = z.input<typeof UpdateSubcategoriaSchema>;

/**
 * T-RBAC-1 · Server Actions de Categorías y Subcategorías.
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

function revalidateCategorias(categoriaId?: string): void {
  revalidatePath('/admin/categorias');
  if (categoriaId) {
    revalidatePath(`/admin/categorias/${categoriaId}`);
    revalidatePath(`/admin/categorias/${categoriaId}/subcategorias`);
  }
}

// ── Categorías (T-072) ──────────────────────────────────────────────────────────

export async function createCategoriaAction(
  input: CreateCategoriaFormInput,
): Promise<ActionResult> {
  const denied = await ensureCan(['categorias.crear']);
  if (denied) return denied;
  const parsed = CreateCategoriaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch('/categorias', { method: 'POST', body: JSON.stringify(parsed.data) });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo crear la categoría.') };
  revalidateCategorias();
  return { ok: true };
}

export async function updateCategoriaAction(
  id: string,
  input: UpdateCategoriaFormInput,
): Promise<ActionResult> {
  const denied = await ensureCan(['categorias.editar']);
  if (denied) return denied;
  const parsed = UpdateCategoriaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch(`/categorias/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo actualizar la categoría.') };
  }
  revalidateCategorias(id);
  return { ok: true };
}

export async function deleteCategoriaAction(id: string): Promise<ActionResult> {
  const denied = await ensureCan(['categorias.deshabilitar']);
  if (denied) return denied;
  const res = await apiFetch(`/categorias/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo desactivar la categoría.') };
  }
  revalidateCategorias(id);
  return { ok: true };
}

// ── Subcategorías (T-073) ───────────────────────────────────────────────────────

export async function createSubcategoriaAction(
  categoriaId: string,
  input: CreateSubcategoriaFormInput,
): Promise<ActionResult> {
  const denied = await ensureCan(['subcategorias.crear']);
  if (denied) return denied;
  const parsed = CreateSubcategoriaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch(`/categorias/${categoriaId}/subcategorias`, {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo crear la subcategoría.') };
  }
  revalidateCategorias(categoriaId);
  return { ok: true };
}

export async function updateSubcategoriaAction(
  categoriaId: string,
  subId: string,
  input: UpdateSubcategoriaFormInput,
): Promise<ActionResult> {
  const denied = await ensureCan(['subcategorias.editar']);
  if (denied) return denied;
  const parsed = UpdateSubcategoriaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch(`/categorias/${categoriaId}/subcategorias/${subId}`, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo actualizar la subcategoría.') };
  }
  revalidateCategorias(categoriaId);
  return { ok: true };
}

export async function deleteSubcategoriaAction(
  categoriaId: string,
  subId: string,
): Promise<ActionResult> {
  const denied = await ensureCan(['subcategorias.deshabilitar']);
  if (denied) return denied;
  const res = await apiFetch(`/categorias/${categoriaId}/subcategorias/${subId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo desactivar la subcategoría.') };
  }
  revalidateCategorias(categoriaId);
  return { ok: true };
}

export async function setResponsableAction(
  categoriaId: string,
  subId: string,
  responsableId: string,
): Promise<ActionResult> {
  const denied = await ensureCan(['subcategorias.asignar_responsable']);
  if (denied) return denied;
  const res = await apiFetch(`/categorias/${categoriaId}/subcategorias/${subId}/responsable`, {
    method: 'PATCH',
    body: JSON.stringify({ responsableId }),
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo cambiar el responsable.') };
  }
  revalidateCategorias(categoriaId);
  return { ok: true };
}

export async function addSupervisorAction(
  categoriaId: string,
  subId: string,
  usuarioId: string,
): Promise<ActionResult> {
  const denied = await ensureCan(['subcategorias.gestionar_supervisores']);
  if (denied) return denied;
  const res = await apiFetch(`/categorias/${categoriaId}/subcategorias/${subId}/supervisores`, {
    method: 'POST',
    body: JSON.stringify({ usuarioId }),
  });
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo agregar el supervisor.') };
  }
  revalidateCategorias(categoriaId);
  return { ok: true };
}

export async function removeSupervisorAction(
  categoriaId: string,
  subId: string,
  usuarioId: string,
): Promise<ActionResult> {
  const denied = await ensureCan(['subcategorias.gestionar_supervisores']);
  if (denied) return denied;
  const res = await apiFetch(
    `/categorias/${categoriaId}/subcategorias/${subId}/supervisores/${usuarioId}`,
    { method: 'DELETE' },
  );
  if (!res.ok) {
    return { ok: false, error: await errorFrom(res, 'No se pudo quitar el supervisor.') };
  }
  revalidateCategorias(categoriaId);
  return { ok: true };
}