import 'server-only';
import { cookies } from 'next/headers';

/**
 * Plaza seleccionada por un superadmin (impersonación de tenant). Se persiste
 * en una cookie httpOnly; el BFF (`apiFetch`) la reenvía al backend como header
 * `x-plaza-id` SOLO si el usuario es superadmin. El backend la acepta solo para
 * superadmin (ver PlazaScopeGuard) y RLS aísla por plaza.
 *
 * Módulo hoja a propósito: NO importa `lib/api` (evita ciclos). El cargador de
 * la plaza (nombre/color) vive en `lib/branding.ts` (`loadSelectedPlaza`).
 */
export const SELECTED_PLAZA_COOKIE = 'sa_plaza';

/** UUID de la plaza elegida por el superadmin, o null. */
export async function getSelectedPlazaId(): Promise<string | null> {
  return (await cookies()).get(SELECTED_PLAZA_COOKIE)?.value ?? null;
}
