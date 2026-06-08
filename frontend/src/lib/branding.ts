import type { PlazaOutput } from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';
import { getSelectedPlazaId } from '@/lib/selected-plaza';

/**
 * Branding por-tenant (T-042). El acento se inyecta como `--color-primary` en
 * `:root`; el sistema de diseño deriva toda la escala (`--primary-*`) desde ahí
 * (ver `globals.css`). T-V01: la plaza se resuelve por el JWT, no por la URL.
 */

/** Devuelve el CSS inline para sobreescribir el acento, o `null` si no aplica. */
export function brandingStyle(colorPrimario?: string | null): string | null {
  if (!colorPrimario) return null;
  return `:root{--color-primary:${colorPrimario};}`;
}

/**
 * Carga la plaza del usuario autenticado (solo `admin_plaza`) para branding.
 * Devuelve `null` para superadmin/inquilino o si la petición falla.
 */
export async function loadPlazaBranding(): Promise<PlazaOutput | null> {
  const session = await auth();
  if (session?.user?.rol !== 'admin_plaza' || !session.user.plazaId) return null;
  const res = await apiFetch(`/plazas/${session.user.plazaId}`);
  if (!res.ok) return null;
  return (await res.json()) as PlazaOutput;
}

/**
 * Plaza que el superadmin tiene "seleccionada" (impersonación). Null si no hay
 * selección. Usado por el shell del superadmin para el branding + el selector.
 */
export async function loadSelectedPlaza(): Promise<PlazaOutput | null> {
  const id = await getSelectedPlazaId();
  if (!id) return null;
  const res = await apiFetch(`/plazas/${id}`);
  if (!res.ok) return null;
  return (await res.json()) as PlazaOutput;
}
