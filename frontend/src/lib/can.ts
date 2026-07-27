/**
 * T-RBAC-1 · Helper de gating fino en frontend.
 *
 * Reglas:
 *  - `permisos.includes('*')` → superadmin: pasa siempre (wildcard).
 *  - Array de permisos requeridos = OR lógico: basta con uno.
 *  - `permisos` undefined/empty → no autorizado.
 *
 * Uso:
 *   // Server Components: pasar `session.user.permisos` desde el layout.
 *   can(session.user.permisos, 'solicitudes.aprobar')
 *
 *   // Client Components: importar `can` y recibir `permisos` como prop
 *   // desde el Server Component padre (evita `useSession()` redundante
 *   // y elimina hydration mismatch). Si no se recibe la prop, usar
 *   // `<Can permiso="...">` con `useSession()` dentro.
 */
export function can(
  permisos: readonly string[] | undefined | null,
  permiso: string | readonly string[],
): boolean {
  if (!permisos || permisos.length === 0) return false;
  if (permisos.includes('*')) return true;
  const required = Array.isArray(permiso) ? permiso : [permiso];
  return required.some((p) => permisos.includes(p));
}

/**
 * Variante "debe cumplir TODOS los permisos requeridos" (AND).
 * Documentada en `PERMISOS_README.md` §"Cómo aplicar AND" — caso poco
 * frecuente en el proyecto; mantener disponible para acciones compuestas.
 */
export function canAll(
  permisos: readonly string[] | undefined | null,
  permiso: readonly string[],
): boolean {
  if (!permisos || permisos.length === 0) return false;
  if (permisos.includes('*')) return true;
  return permiso.every((p) => permisos.includes(p));
}
