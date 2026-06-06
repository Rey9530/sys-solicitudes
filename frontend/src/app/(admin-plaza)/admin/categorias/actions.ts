'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  CreateCategoriaSchema,
  UpdateCategoriaSchema,
  CreateSubcategoriaSchema,
  UpdateSubcategoriaSchema,
} from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

// Tipos de ENTRADA (pre-coerción de Zod): lo que envían los formularios.
type CreateCategoriaFormInput = z.input<typeof CreateCategoriaSchema>;
type UpdateCategoriaFormInput = z.input<typeof UpdateCategoriaSchema>;
type CreateSubcategoriaFormInput = z.input<typeof CreateSubcategoriaSchema>;
type UpdateSubcategoriaFormInput = z.input<typeof UpdateSubcategoriaSchema>;

/** Solo admin_plaza/superadmin operan el panel (el backend también lo exige). */
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
  await assertAdminPlaza();
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
  await assertAdminPlaza();
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
  await assertAdminPlaza();
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
  await assertAdminPlaza();
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
  await assertAdminPlaza();
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
  await assertAdminPlaza();
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
  await assertAdminPlaza();
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
  await assertAdminPlaza();
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
  await assertAdminPlaza();
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
