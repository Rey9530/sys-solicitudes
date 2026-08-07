'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * T-RBAC-1 (fix login 502, 2026-08-07) · Provider de permisos efectivos.
 *
 * Contexto React que expone los permisos del usuario actual a TODOS los
 * Client Components descendientes, sin necesidad de pasarlos como prop
 * manualmente por cada nivel. Lo setea el Server Component layout
 * (`frontend/src/app/(admin-plaza)/layout.tsx`, `(admin-plataform)/layout.tsx`,
 * `(inquilino)/layout.tsx`) tras resolverlos con `getPermisosEfectivos()`
 * (cacheado por request con `React.cache`).
 *
 * Por qué:
 *  - Los Client Components como `<CategoriasTable>`, `<RolesStaffTable>`,
 *    `<SolicitudDetailAdmin>` etc. usan `<Can permiso="...">` docenas de
 *    veces. Pasar permisos como prop por cada uno crea prop-drilling masivo.
 *  - `useSession()` ya no expone permisos (se eliminaron del JWT para no
 *    fragmentar la cookie de Auth.js).
 *  - El Server Component layout es el ÚNICO punto que tiene permisos y
 *    puede inyectarlos.
 *
 * Uso:
 *   // Server Component layout:
 *   const permisos = await getPermisosEfectivos();
 *   return (
 *     <PermisosProvider permisos={permisos}>
 *       {children}
 *     </PermisosProvider>
 *   );
 *
 *   // Client Component (cualquier nivel):
 *   const permisos = usePermisos();
 *   if (!can(permisos, 'solicitudes.aprobar')) ...
 *
 *   // O con el wrapper declarativo:
 *   <Can permiso="solicitudes.aprobar">...</Can>
 *
 * Fuera del provider, `usePermisos()` devuelve `[]` (denegación segura).
 */
const PermisosContext = createContext<readonly string[] | undefined>(undefined);

export function PermisosProvider({
  permisos,
  children,
}: {
  permisos: readonly string[] | undefined | null;
  children: ReactNode;
}) {
  return (
    <PermisosContext.Provider value={permisos ?? undefined}>
      {children}
    </PermisosContext.Provider>
  );
}

export function usePermisos(): readonly string[] {
  return useContext(PermisosContext) ?? [];
}
