'use client';

import type { ReactNode } from 'react';
import { can } from '@/lib/can';
import { usePermisos } from './permisos-provider';

/**
 * T-RBAC-1 · Gating fino para Client Components.
 *
 * Wrapper declarativo que oculta (o muestra un fallback) los children según
 * los permisos del usuario actual. Los permisos los toma del contexto
 * `PermisosProvider` (seteado por el Server Component layout con
 * `getPermisosEfectivos()`). Si NO está dentro del provider, `usePermisos()`
 * devuelve `[]` → `can()` niega → el componente se oculta (denegación segura
 * por defecto).
 *
 * No usamos `useSession()` aquí a propósito: los permisos NO están en la
 * cookie de NextAuth (ver `frontend/src/auth.ts`) — el fetch del backend es
 * la única fuente, y el Server Component layout es el único punto que puede
 * resolverlos una sola vez por request.
 *
 * Reglas:
 *  - Wildcard `*` (superadmin) → siempre muestra.
 *  - Array de permisos = OR lógico (basta con uno).
 *  - Sin sesión o sin permisos → oculta o muestra `fallback`.
 *
 * Uso básico:
 *   <Can permiso="solicitudes.aprobar">
 *     <Button onClick={aprobar}>Aprobar</Button>
 *   </Can>
 *
 * Con varios permisos (OR):
 *   <Can permiso={['usuarios_plaza.editar', 'usuarios_plaza.reactivar']}>
 *     <Button>Gestionar</Button>
 *   </Can>
 *
 * Con fallback (no ocultar silenciosamente):
 *   <Can permiso="auditoria.ver" fallback={<Tooltip>No tienes acceso</Tooltip>}>
 *     <AuditoriaLink />
 *   </Can>
 */
interface CanProps {
  /** Permiso o lista de permisos requeridos (OR). Acepta `'*'` para superadmin. */
  permiso: string | string[];
  /**
   * Override del contexto: pasar un array distinto de permisos. Útil cuando
   * el componente necesita chequear con un set diferente (ej. permisos de un
   * rol_staff concreto en la matriz de permisos). Si se omite, usa el
   * `PermisosProvider` del layout.
   */
  permisos?: readonly string[] | undefined | null;
  /** Lo que se muestra cuando NO se cumple el permiso. Default: `null`. */
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can({ permiso, permisos: permisosProp, fallback = null, children }: CanProps) {
  const permisosFromContext = usePermisos();
  const permisos = permisosProp ?? permisosFromContext;
  return <>{can(permisos, permiso) ? children : fallback}</>;
}
