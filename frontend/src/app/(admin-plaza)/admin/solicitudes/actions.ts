'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  AprobarSolicitudSchema,
  RechazarSolicitudSchema,
  SubsanarSolicitudAdminSchema,
  ReasignarSolicitudSchema,
  LiberarSolicitudSchema,
  UpdatePrioridadSchema,
  CreateComentarioSchema,
} from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

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
  const msg = err.message ?? err.detail ?? fallback;
  return Array.isArray(msg) ? msg.join('; ') : msg;
}

function revalidate(id?: string): void {
  revalidatePath('/admin/solicitudes');
  if (id) revalidatePath(`/admin/solicitudes/${id}`);
}

async function postAccion(
  id: string,
  accion: string,
  body: unknown,
  fallback: string,
): Promise<ActionResult> {
  await assertAdminPlaza();
  const res = await apiFetch(`/solicitudes/${id}/${accion}`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, fallback) };
  revalidate(id);
  return { ok: true };
}

export async function tomarAction(id: string): Promise<ActionResult> {
  return postAccion(id, 'tomar', {}, 'No se pudo tomar la solicitud.');
}

export async function liberarAction(id: string, motivo?: string): Promise<ActionResult> {
  const parsed = LiberarSolicitudSchema.safeParse({ motivo: motivo || undefined });
  if (!parsed.success) return { ok: false, error: 'Motivo inválido' };
  return postAccion(id, 'liberar', parsed.data, 'No se pudo liberar.');
}

export async function aprobarAction(id: string, comentario?: string): Promise<ActionResult> {
  const parsed = AprobarSolicitudSchema.safeParse({ comentario: comentario || undefined });
  if (!parsed.success) return { ok: false, error: 'Comentario inválido' };
  return postAccion(id, 'aprobar', parsed.data, 'No se pudo aprobar.');
}

export async function rechazarAction(id: string, comentario: string): Promise<ActionResult> {
  const parsed = RechazarSolicitudSchema.safeParse({ comentario });
  if (!parsed.success) return { ok: false, error: 'El comentario es obligatorio.' };
  return postAccion(id, 'rechazar', parsed.data, 'No se pudo rechazar.');
}

export async function pedirSubsanacionAction(
  id: string,
  comentario: string,
): Promise<ActionResult> {
  const parsed = SubsanarSolicitudAdminSchema.safeParse({ comentario });
  if (!parsed.success) return { ok: false, error: 'El comentario es obligatorio.' };
  return postAccion(id, 'pedir-subsanacion', parsed.data, 'No se pudo pedir subsanación.');
}

export async function reasignarAction(
  id: string,
  input: z.input<typeof ReasignarSolicitudSchema>,
): Promise<ActionResult> {
  const parsed = ReasignarSolicitudSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  return postAccion(id, 'reasignar', parsed.data, 'No se pudo reasignar.');
}

export async function cancelarAdminAction(id: string, motivo?: string): Promise<ActionResult> {
  return postAccion(id, 'cancelar', { motivo: motivo || undefined }, 'No se pudo cancelar.');
}

export async function cambiarPrioridadAction(
  id: string,
  prioridad: string,
): Promise<ActionResult> {
  await assertAdminPlaza();
  const parsed = UpdatePrioridadSchema.safeParse({ prioridad });
  if (!parsed.success) return { ok: false, error: 'Prioridad inválida' };
  const res = await apiFetch(`/solicitudes/${id}/prioridad`, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo cambiar.') };
  revalidate(id);
  return { ok: true };
}

export async function comentarAdminAction(
  id: string,
  input: z.input<typeof CreateComentarioSchema>,
): Promise<ActionResult> {
  await assertAdminPlaza();
  const parsed = CreateComentarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Comentario inválido' };
  const res = await apiFetch(`/solicitudes/${id}/comentarios`, {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo comentar.') };
  revalidate(id);
  return { ok: true };
}

export async function descargarAdjuntoAdminAction(
  adjuntoId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await assertAdminPlaza();
  const res = await apiFetch(`/adjuntos/${adjuntoId}/download`);
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo descargar.') };
  const data = (await res.json()) as { url: string };
  return { ok: true, url: data.url };
}
