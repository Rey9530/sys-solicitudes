'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  AprobarSolicitudSchema,
  RechazarSolicitudSchema,
  SubsanarSolicitudAdminSchema,
  ReasignarSolicitudSchema,
  LiberarSolicitudSchema,
  PausarSolicitudSchema,
  UpdatePrioridadSchema,
  CreateComentarioSchema,
  CerrarSolicitudSchema,
} from '@app/contracts';
import { ForbiddenError, assertAnyCan } from '@/lib/server/assert-can';
import { apiFetch, errorFromResponse } from '@/lib/api';

/**
 * T-RBAC-1 · Server Actions de Solicitudes (panel admin).
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
  // Si el body trae un array (ej: validation issues), lo unimos con '; '.
  const raw = await errorFromResponse(res, fallback, 'legacy');
  return Array.isArray(raw) ? raw.join('; ') : raw;
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
  permiso: string,
): Promise<ActionResult> {
  const denied = await ensureCan([permiso]);
  if (denied) return denied;
  const res = await apiFetch(`/solicitudes/${id}/${accion}`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, fallback) };
  revalidate(id);
  return { ok: true };
}

export async function tomarAction(id: string): Promise<ActionResult> {
  return postAccion(id, 'tomar', {}, 'No se pudo tomar la solicitud.', 'solicitudes.tomar');
}

export async function liberarAction(id: string, motivo?: string): Promise<ActionResult> {
  const denied = await ensureCan(['solicitudes.liberar']);
  if (denied) return denied;
  const parsed = LiberarSolicitudSchema.safeParse({ motivo: motivo || undefined });
  if (!parsed.success) return { ok: false, error: 'Motivo inválido' };
  return postAccion(id, 'liberar', parsed.data, 'No se pudo liberar.', 'solicitudes.liberar');
}

/** T-091d-pausar: pausar solicitud activa (asignado|en_revision). */
export async function pausarAction(id: string, motivo?: string): Promise<ActionResult> {
  const denied = await ensureCan(['solicitudes.pausar']);
  if (denied) return denied;
  const parsed = PausarSolicitudSchema.safeParse({ motivo: motivo?.trim() || undefined });
  if (!parsed.success) return { ok: false, error: 'Motivo inválido' };
  return postAccion(id, 'pausar', parsed.data, 'No se pudo pausar.', 'solicitudes.pausar');
}

/** T-091d-pausar: reanudar solicitud pausada (vuelve a en_revision). */
export async function reanudarAction(id: string): Promise<ActionResult> {
  return postAccion(id, 'reanudar', {}, 'No se pudo reanudar.', 'solicitudes.reanudar');
}

export async function aprobarAction(id: string, comentario?: string): Promise<ActionResult> {
  const denied = await ensureCan(['solicitudes.aprobar']);
  if (denied) return denied;
  const parsed = AprobarSolicitudSchema.safeParse({ comentario: comentario || undefined });
  if (!parsed.success) return { ok: false, error: 'Comentario inválido' };
  return postAccion(id, 'aprobar', parsed.data, 'No se pudo aprobar.', 'solicitudes.aprobar');
}

/**
 * T-091e-cerrar: cerrar una solicitud aprobada. Resultado de cierre obligatorio
 * (exitoso/parcial/fallido/no_realizado). Comentario obligatorio cuando el
 * resultado ≠ `exitoso`. Solo el admin asignado o superadmin puede cerrar.
 */
export async function cerrarAction(
  id: string,
  input: z.input<typeof CerrarSolicitudSchema>,
): Promise<ActionResult> {
  const denied = await ensureCan(['solicitudes.cerrar']);
  if (denied) return denied;
  const parsed = CerrarSolicitudSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Datos inválidos';
    return { ok: false, error: first };
  }
  return postAccion(
    id,
    'cerrar',
    parsed.data,
    'No se pudo cerrar la solicitud.',
    'solicitudes.cerrar',
  );
}

export async function rechazarAction(id: string, comentario: string): Promise<ActionResult> {
  const denied = await ensureCan(['solicitudes.rechazar']);
  if (denied) return denied;
  const parsed = RechazarSolicitudSchema.safeParse({ comentario });
  if (!parsed.success) return { ok: false, error: 'El comentario es obligatorio.' };
  return postAccion(id, 'rechazar', parsed.data, 'No se pudo rechazar.', 'solicitudes.rechazar');
}

export async function pedirSubsanacionAction(
  id: string,
  comentario: string,
): Promise<ActionResult> {
  const denied = await ensureCan(['solicitudes.pedir_subsanacion']);
  if (denied) return denied;
  const parsed = SubsanarSolicitudAdminSchema.safeParse({ comentario });
  if (!parsed.success) return { ok: false, error: 'El comentario es obligatorio.' };
  return postAccion(
    id,
    'pedir-subsanacion',
    parsed.data,
    'No se pudo pedir subsanación.',
    'solicitudes.pedir_subsanacion',
  );
}

export async function reasignarAction(
  id: string,
  input: z.input<typeof ReasignarSolicitudSchema>,
): Promise<ActionResult> {
  const denied = await ensureCan(['solicitudes.reasignar']);
  if (denied) return denied;
  const parsed = ReasignarSolicitudSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Datos inválidos' };
  return postAccion(id, 'reasignar', parsed.data, 'No se pudo reasignar.', 'solicitudes.reasignar');
}

export async function cancelarAdminAction(id: string, motivo?: string): Promise<ActionResult> {
  return postAccion(
    id,
    'cancelar',
    { motivo: motivo || undefined },
    'No se pudo cancelar.',
    'solicitudes.cancelar',
  );
}

export async function cambiarPrioridadAction(
  id: string,
  prioridad: string,
): Promise<ActionResult> {
  const denied = await ensureCan(['solicitudes.cambiar_prioridad']);
  if (denied) return denied;
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
  const denied = await ensureCan(['solicitudes.comentar']);
  if (denied) return denied;
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
  const denied = await ensureCan(['solicitudes.adjuntos.descargar']);
  if (denied) return denied;
  const res = await apiFetch(`/adjuntos/${adjuntoId}/download`);
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo descargar.') };
  const data = (await res.json()) as { url: string };
  return { ok: true, url: data.url };
}

/** T-117: subida de adjunto a una solicitud desde el panel admin. */
export async function subirAdjuntoAdminAction(
  solicitudId: string,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await ensureCan(['solicitudes.adjuntos.subir']);
  if (denied) return denied;
  const res = await apiFetch(`/solicitudes/${solicitudId}/adjuntos`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo subir.') };
  return { ok: true };
}

/** T-117: eliminar adjunto de una solicitud (admin). */
export async function eliminarAdjuntoAdminAction(
  solicitudId: string,
  adjuntoId: string,
): Promise<ActionResult> {
  const denied = await ensureCan(['solicitudes.adjuntos.eliminar']);
  if (denied) return denied;
  const res = await apiFetch(`/adjuntos/${adjuntoId}`, { method: 'DELETE' });
  if (!res.ok) return { ok: false, error: await errorFrom(res, 'No se pudo eliminar.') };
  return { ok: true };
}