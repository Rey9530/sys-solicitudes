'use server';

import { apiFetch, errorFromResponse } from '@/lib/api';
import type { ListSolicitudesPlataformaQuery } from '@app/contracts';

export type DescargarCsvResult =
  | { ok: true; csv: string; filename: string; total: number; truncated: boolean }
  | { ok: false; error: string };

/**
 * T-V25 · Server Action que descarga el CSV cross-plaza y lo devuelve como
 * string. La razón de pasarlo al cliente (en vez de hacer redirect a una URL
 * pre-firmada o un link directo al backend) es que la cookie httpOnly de
 * NextAuth nunca llega al browser; el cliente no puede llamar a
 * `apiFetch` directamente.
 *
 * El `Blob` + `<a download>` se hace en el Client Component que invoca esta
 * action (ver `exportar-csv-button.tsx`).
 *
 * El superadmin tiene wildcard `*` en `PermissionsGuard`, así que no hace
 * falta chequear permisos granulares aquí.
 */
export async function descargarSolicitudesCsvAction(
  filtros: ListSolicitudesPlataformaQuery,
): Promise<DescargarCsvResult> {
  // No serializamos `page`/`pageSize` al backend (export va a cap fijo).
  const qs = new URLSearchParams();
  if (filtros.plazaId) qs.set('plazaId', filtros.plazaId);
  if (filtros.search) qs.set('search', filtros.search);
  if (filtros.estado) qs.set('estado', filtros.estado);
  if (filtros.tipo) qs.set('tipo', filtros.tipo);
  if (filtros.categoriaId) qs.set('categoriaId', filtros.categoriaId);
  if (filtros.subcategoriaId) qs.set('subcategoriaId', filtros.subcategoriaId);
  if (filtros.prioridad) qs.set('prioridad', filtros.prioridad);
  if (filtros.fechaDesde) qs.set('fechaDesde', filtros.fechaDesde);
  if (filtros.fechaHasta) qs.set('fechaHasta', filtros.fechaHasta);

  const res = await apiFetch(`/admin/solicitudes/export.csv?${qs.toString()}`, {
    headers: { Accept: 'text/csv' },
  });

  if (!res.ok) {
    return { ok: false, error: await errorFromResponse(res, 'No se pudo exportar.', 'descargarCsv') };
  }

  // El controller hace `Content-Disposition: attachment; filename="..."`.
  // No podemos leer ese header desde `fetch` cuando el body se consume como
  // stream, así que extraemos el filename de `content-disposition` por si el
  // backend lo customiza en el futuro; fallback al nombre por defecto.
  const dispo = res.headers.get('content-disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(dispo);
  const filename = match?.[1] ?? `solicitudes-plataforma-${new Date().toISOString().slice(0, 10)}.csv`;

  const csv = await res.text();
  // No tenemos acceso a `total`/`truncated` desde aquí; el backend los emite
  // en headers `x-total-rows` y `x-truncated` (opcional v1). En esta versión
  // dejamos los valores en 0/false y se informará solo por el `total` del
  // listado en pantalla.
  return { ok: true, csv, filename, total: 0, truncated: false };
}
