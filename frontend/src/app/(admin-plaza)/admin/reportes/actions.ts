'use server';

import { ForbiddenError, assertAnyCan } from '@/lib/server/assert-can';
import { apiFetch, errorFromResponse } from '@/lib/api';

/**
 * T-RBAC-1 · Server Actions de Reportes.
 *
 * Cada acción valida el permiso granular con `assertAnyCan(...)` ANTES de
 * llamar al backend. La defensa real vive en el `PermissionsGuard` global
 * del backend; este helper es solo UX para evitar round-trips innecesarios
 * y emitir mensajes claros cuando el toast del cliente muestra el 403.
 *
 * Las exportaciones (CSV / XLSX / PDF / ficha) son consumidas vía Server
 * Action pero el flujo de "exportar" termina devolviendo una URL de
 * descarga del backend (`/reportes/...`). Solo `previewReporteAction`
 * está modelada como Server Action porque es la única que devuelve datos
 * al cliente; las exportaciones se hacen por navegación directa a un
 * endpoint del backend (protegido por `RequirePermission` en su controller).
 */

export interface PreviewResult {
  ok: boolean;
  error?: string;
  items?: Array<Record<string, unknown>>;
  total?: number;
}

/** T-144: previsualización de los primeros 10 registros del reporte. */
export async function previewReporteAction(
  entidad: string,
  filtros: Record<string, string>,
): Promise<PreviewResult> {
  try {
    await assertAnyCan(['reportes.preview']);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
  const qs = new URLSearchParams(
    Object.entries(filtros).filter(([, v]) => Boolean(v)),
  ).toString();
  const res = await apiFetch(`/reportes/${entidad}/preview${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    return { ok: false, error: await errorFromResponse(res, 'No se pudo previsualizar el reporte.', 'previewReporteAction') };
  }
  const data = (await res.json()) as { items: Array<Record<string, unknown>>; total: number };
  return { ok: true, items: data.items, total: data.total };
}