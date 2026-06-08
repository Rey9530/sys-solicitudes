/** Destino post-login (home del sistema) según rol. */
export function homeForRole(rol: string | undefined): string {
  switch (rol) {
    case 'superadmin':
      return '/superadmin/plazas';
    case 'admin_plaza':
      return '/admin/dashboard';
    case 'inquilino':
      return '/inquilino/solicitudes';
    default:
      return '/login';
  }
}
