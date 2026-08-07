import 'server-only';

import { cache } from 'react';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

/**
 * T-RBAC-1 (fix login 502, 2026-08-07) · Resolver server-side de los permisos
 * efectivos del usuario autenticado.
 *
 * Por qué existe:
 *  - Los permisos NO se persisten en el JWT de NextAuth (ver `frontend/src/auth.ts`).
 *  - `PermissionGuard` del backend es la ÚNICA fuente de verdad de seguridad.
 *    El frontend solo los necesita para UI gating (sidebar, `<Can>`,
 *    `assertCan()`).
 *
 * Rendimiento:
 *  - `cache()` (React) deduplica la llamada por request. Si un Server Component
 *    layout pide los permisos y luego un `assertCan()` del Server Action los
 *    pide de nuevo, se hace UNA sola llamada al backend.
 *  - Dentro de un mismo render, todos los componentes ven el mismo array.
 *
 * Uso:
 *   import { getPermisosEfectivos } from '@/lib/server/permisos';
 *
 *   // Server Component / layout
 *   const permisos = await getPermisosEfectivos();
 *
 *   // Server Action
 *   const permisos = await getPermisosEfectivos();
 *   if (!can(permisos, 'solicitudes.aprobar')) throw new ForbiddenError(...);
 *
 * Sin sesión → `[]` (los layouts ya redirigen a /login con `auth()`; aquí
 * solo devolvemos vacío para que `can()` niegue el acceso en lugar de hacer
 * un fetch con un Bearer undefined).
 */
export const getPermisosEfectivos = cache(async (): Promise<string[]> => {
  const session = await auth();
  if (!session?.user) return [];

  try {
    const res = await apiFetch('/auth/me/permisos');
    if (!res.ok) {
      // Si el backend está caído o el token está revocado, no rompemos el render
      // — devolvemos [] y el gating fino se ocupa de denegar. El backend
      // además rechaza la acción en `PermissionsGuard`.
      return [];
    }
    const data = (await res.json()) as { permisos: string[] };
    return Array.isArray(data.permisos) ? data.permisos : [];
  } catch {
    // Fallo de red o parseo: tratar como sin permisos. El backend siempre
    // re-valida en cada endpoint.
    return [];
  }
});
