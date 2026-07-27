'use client';

import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { can } from '@/lib/can';

/**
 * T-RBAC-1 · Gating fino para Client Components.
 *
 * Wrapper declarativo que oculta (o muestra un fallback) los children según
 * los permisos del usuario actual. Lee los permisos desde `useSession()`
 * (no hay prop drilling y siempre están frescos al revalidar `router.refresh`).
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
 *
 * ⚠️ Convención del proyecto (S-ARQ-F): preferir siempre que se pueda pasar
 * los permisos como **prop desde el Server Component padre** en lugar de
 * `useSession()` para evitar hydration mismatch y un fetch adicional. Este
 * componente existe para Client Components que ya tienen sesión disponible
 * vía `SessionProvider` o donde es aceptable un re-render tras hidratación.
 */
interface CanProps {
  /** Permiso o lista de permisos requeridos (OR). Acepta `'*'` para superadmin. */
  permiso: string | string[];
  /** Lo que se muestra cuando NO se cumple el permiso. Default: `null`. */
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can({ permiso, fallback = null, children }: CanProps) {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  return <>{can(permisos, permiso) ? children : fallback}</>;
}
