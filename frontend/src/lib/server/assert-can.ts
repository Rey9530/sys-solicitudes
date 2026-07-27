import 'server-only';

import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';
import { auth } from '@/auth';
import { can } from '@/lib/can';

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
 *  - Si pasa → devuelve la sesión para que el caller acceda a
 *    `session.user.plazaId` u otros claims sin re-leer el cookie.
 *
 * NOTA: la verificación del JWT del backend (defensa en profundidad)
 * ocurre SIEMPRE en el endpoint del backend mediante `PermissionsGuard`
 * global. Este helper es solo UX — evita que el usuario vea opciones
 * para las que no tiene permiso o que un fetch directo desde el cliente
 * gaste un round-trip antes de ser rechazado.
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

export async function assertCan(permiso: string | string[]): Promise<Session> {
  const session = (await auth()) as Session | null;
  if (!session?.user) {
    redirect('/login');
  }
  if (!can(session.user.permisos, permiso)) {
    throw new ForbiddenError(permiso);
  }
  return session;
}

/**
 * Variante "OR explícito" — útil cuando un mismo Server Action sirve a
 * varios botones con permisos distintos y conviene declararlos todos al
 * inicio. Lanza `ForbiddenError` solo si el usuario NO tiene NINGUNO
 * de los permisos del array.
 */
export async function assertAnyCan(permisos: string[]): Promise<Session> {
  const session = (await auth()) as Session | null;
  if (!session?.user) {
    redirect('/login');
  }
  if (!can(session.user.permisos, permisos)) {
    throw new ForbiddenError(permisos);
  }
  return session;
}
