import 'server-only';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { can } from '@/lib/can';
import { getPermisosEfectivos } from '@/lib/server/permisos';

/**
 * T-RBAC-1 · Helper server-side para gating fino en Server Actions y
 * Route Handlers.
 *
 * Uso:
 *   'use server';
 *   import { assertCan } from '@/lib/server/assert-can';
 *
 *   export async function deleteLocalAction(id: string) {
 *     await assertCan('locales.deshabilitar');
 *     // ... resto
 *   }
 *
 * Comportamiento:
 *  - Si no hay sesión → redirect a /login.
 *  - Si el usuario no tiene el permiso → throws `ForbiddenError` con mensaje
 *    legible. Los Server Actions de Next.js lo propagan al cliente y
 *    aparece en el toast (no es un redirect porque suele ser un
 *    flujo interactivo).
 *
 * (Fix login 502, 2026-08-07) Los permisos ya no viven en el JWT de NextAuth
 * (un admin_plaza con ~64 permisos generaba un JWE que Auth.js fragmentaba
 * en varias cookies, provocando 502 Bad Gateway en el login). Se resuelven
 * server-side con `getPermisosEfectivos()` (cacheado por request con
 * `React.cache()`). La verificación de seguridad REAL ocurre SIEMPRE en el
 * `PermissionsGuard` del backend; este helper es solo UX.
 */

export class ForbiddenError extends Error {
  readonly permisosRequeridos: string[];

  constructor(permiso: string | string[]) {
    const required = Array.isArray(permiso) ? permiso : [permiso];
    super(`Permiso denegado: requiere ${required.join(' o ')}`);
    this.name = 'ForbiddenError';
    this.permisosRequeridos = required;
  }
}

export async function assertCan(permiso: string | string[]): Promise<void> {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  const permisos = await getPermisosEfectivos();
  if (!can(permisos, permiso)) {
    throw new ForbiddenError(permiso);
  }
}

/**
 * Variante "OR explícito" — útil cuando un mismo Server Action sirve a
 * varios botones con permisos distintos y conviene declararlos todos al
 * inicio. Lanza `ForbiddenError` solo si el usuario NO tiene NINGUNO
 * de los permisos del array.
 */
export async function assertAnyCan(permisos: string[]): Promise<void> {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  const userPermisos = await getPermisosEfectivos();
  if (!can(userPermisos, permisos)) {
    throw new ForbiddenError(permisos);
  }
}
