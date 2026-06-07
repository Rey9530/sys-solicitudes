'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  CreateSolicitudSchema,
  UpdateSolicitudSchema,
  CreateComentarioSchema,
  type SolicitudOutput,
  type SolicitudListItem,
} from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

type CreateSolicitudFormInput = z.input<typeof CreateSolicitudSchema>;
type UpdateSolicitudFormInput = z.input<typeof UpdateSolicitudSchema>;
type CreateComentarioFormInput = z.input<typeof CreateComentarioSchema>;

/** Las acciones del portal del inquilino exigen rol inquilino (BE también). */
async function assertInquilino(): Promise<void> {
  const session = await auth();
  if (session?.user?.rol !== 'inquilino') throw new Error('Forbidden');
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function errorFrom(res: Response, fallback: string): Promise<string> {
  const err = (await res.json().catch(() => ({}))) as { message?: string; detail?: string };
  const msg = err.message ?? err.detail ?? fallback;
  return Array.isArray(msg) ? msg.join('; ') : msg;
}

function revalidate(id?: string): void {
  revalidatePath('/inquilino/solicitudes');
  if (id) revalidatePath(`/inquilino/solicitudes/${id}`);
}

export async function createSolicitudAction(
  input: CreateSolicitudFormInput,
): Promise<ActionResult<SolicitudOutput>> {
  await assertInquilino();
  const parsed = CreateSolicitudSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch('/solicitudes', {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo crear la solicitud.') };
  const data = (await res.json()) as SolicitudOutput;
  revalidate();
  return { ok: true, data };
}

export async function updateSolicitudAction(
  id: string,
  input: UpdateSolicitudFormInput,
): Promise<ActionResult> {
  await assertInquilino();
  const parsed = UpdateSolicitudSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  const res = await apiFetch(`/solicitudes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo actualizar.') };
  revalidate(id);
  return { ok: true };
}

export async function enviarSolicitudAction(id: string): Promise<ActionResult> {
  await assertInquilino();
  const res = await apiFetch(`/solicitudes/${id}/enviar`, { method: 'POST' });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo enviar.') };
  revalidate(id);
  return { ok: true };
}

export async function cancelarSolicitudAction(
  id: string,
  motivo?: string,
): Promise<ActionResult> {
  await assertInquilino();
  const res = await apiFetch(`/solicitudes/${id}/cancelar`, {
    method: 'POST',
    body: JSON.stringify({ motivo: motivo || undefined }),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo cancelar.') };
  revalidate(id);
  return { ok: true };
}

/** T-083: reenvía tras subsanar (vuelve a la cola, T-V03). */
export async function subsanarSolicitudAction(id: string): Promise<ActionResult> {
  await assertInquilino();
  const res = await apiFetch(`/solicitudes/${id}/subsanar`, { method: 'POST' });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo reenviar.') };
  revalidate(id);
  return { ok: true };
}

export async function duplicarSolicitudAction(
  id: string,
): Promise<ActionResult<SolicitudOutput>> {
  await assertInquilino();
  const res = await apiFetch(`/solicitudes/${id}/duplicar`, { method: 'POST' });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo duplicar.') };
  const data = (await res.json()) as SolicitudOutput;
  revalidate();
  return { ok: true, data };
}

export async function addComentarioAction(
  id: string,
  input: CreateComentarioFormInput,
): Promise<ActionResult> {
  // Comentar pueden inquilino y admin; esta action es del portal inquilino.
  await assertInquilino();
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

export async function subirAdjuntoSolicitudAction(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await assertInquilino();
  const res = await apiFetch(`/solicitudes/${id}/adjuntos`, { method: 'POST', body: formData });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo subir el adjunto.') };
  revalidate(id);
  return { ok: true };
}

export async function descargarAdjuntoSolicitudAction(
  adjuntoId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await assertInquilino();
  const res = await apiFetch(`/adjuntos/${adjuntoId}/download`);
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo descargar.') };
  const data = (await res.json()) as { url: string };
  return { ok: true, url: data.url };
}

export async function eliminarAdjuntoSolicitudAction(
  adjuntoId: string,
  solicitudId: string,
): Promise<ActionResult> {
  await assertInquilino();
  const res = await apiFetch(`/adjuntos/${adjuntoId}`, { method: 'DELETE' });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo eliminar.') };
  revalidate(solicitudId);
  return { ok: true };
}

/** T-090: aviso NO bloqueante de solicitudes similares. */
export async function checkDuplicadosAction(
  localId: string,
  tipo: string,
): Promise<SolicitudListItem[]> {
  await assertInquilino();
  const res = await apiFetch(`/solicitudes/duplicados?localId=${localId}&tipo=${tipo}`);
  if (!res.ok) return [];
  return (await res.json()) as SolicitudListItem[];
}
