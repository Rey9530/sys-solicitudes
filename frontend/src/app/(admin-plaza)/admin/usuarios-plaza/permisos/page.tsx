import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { ListarPermisosOutput, RolPermisosOutput } from '@app/contracts';
import { auth } from '@/auth';
import { assertCan } from '@/lib/server/assert-can';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { MatrizPermisos } from '@/components/client/admin/matriz-permisos';
import { ForbiddenError } from '@/lib/server/assert-can';

export const metadata: Metadata = { title: 'Permisos de roles' };

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface RolStaffLite {
  id: string;
  codigo: string;
  nombre: string;
}

/**
 * T-RBAC-1 · Página "/admin/usuarios-plaza/permisos" — matriz de permisos.
 *
 * Server Component que:
 *  1. `assertCan('permisos.ver_matriz')` — gating fino antes de cargar nada.
 *  2. Carga en paralelo: catálogo global de permisos + roles_staff de la plaza.
 *  3. Para cada rol, carga sus permisos efectivos (puede haber muchos roles,
 *     pero v1 espera ≤10 por plaza → loop secuencial aceptable).
 *  4. Detecta el rol "admin" por `codigo === 'admin'` (convención del seed).
 *  5. Pasa todo al Client Component `MatrizPermisos` para interacción.
 *
 * Si el usuario no tiene permiso → 403 via `ForbiddenError` (página de error
 * estándar de Next.js). Si no hay sesión → redirect a /login.
 */
export default async function PermisosRolesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  try {
    await assertCan(['permisos.ver_matriz', 'roles_staff.gestionar_permisos']);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      // Doble verificación fallida: el usuario está autenticado pero no tiene
      // permiso. Devolvemos un mensaje claro en lugar de un 500 genérico.
      return (
        <div className="page wide">
          <PageHeader title="Permisos de roles" />
          <div className="card card-pad" style={{ maxWidth: 520, margin: '40px auto' }}>
            <h2 className="text-[17px] font-semibold">Sin acceso</h2>
            <p className="muted mt-2 text-sm">{err.message}</p>
            <p className="muted mt-2 text-sm">
              Para gestionar permisos necesitas el permiso
              <code className="mono"> permisos.ver_matriz </code>
              (o <code className="mono">roles_staff.gestionar_permisos</code>).
              Pídele a un administrador con rol "admin" que te lo asigne.
            </p>
          </div>
        </div>
      );
    }
    throw err;
  }

  // Cargar catálogo + roles en paralelo.
  const [catalogoRes, rolesRes] = await Promise.all([
    apiFetch('/permisos'),
    apiFetch('/roles-staff?pageSize=100'),
  ]);

  if (!catalogoRes.ok) {
    return renderError('No se pudo cargar el catálogo de permisos', catalogoRes.status);
  }
  if (!rolesRes.ok) {
    return renderError('No se pudo cargar la lista de roles de la plaza', rolesRes.status);
  }

  const catalogo = (await catalogoRes.json()) as ListarPermisosOutput;
  const rolesList = (await rolesRes.json()) as Paginated<RolStaffLite>;
  const roles = rolesList.items;

  // Cargar permisos por rol en paralelo. Cada rol hace una request a
  // /permisos/roles/:id (lectura simple, sin RLS conflictivo). Para plazas
  // con muchos roles se podría agregar un endpoint batch en el futuro; v1 OK.
  const permisosPorRol = await Promise.all(
    roles.map(async (r) => {
      const res = await apiFetch(`/permisos/roles/${r.id}`);
      if (!res.ok) {
        return { rolStaffId: r.id, permisos: [] };
      }
      const data = (await res.json()) as RolPermisosOutput;
      return { rolStaffId: r.id, permisos: data.permisos };
    }),
  );

  // Detección del rol del sistema: por convención del seed, `codigo === 'admin'`.
  // Se hace server-side para que el frontend no hardcodee el string.
  const rolesSistemaIds = new Set(
    roles.filter((r) => r.codigo === 'admin').map((r) => r.id),
  );

  return (
    <div className="page wide">
      <PageHeader
        title="Permisos de roles"
        subtitle="Asigna permisos granulares a cada rol de la plaza. Los cambios afectan a todos los usuarios que tengan el rol."
      />

      <div className="card card-pad mb-4" style={{ background: 'var(--surface-2)' }}>
        <p className="text-sm">
          <strong>Convenciones del sistema RBAC</strong>
        </p>
        <ul className="muted text-sm" style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>
            El rol <code className="mono">admin</code> es del sistema e inamovible.
            Siempre tiene <strong>todos</strong> los permisos del catálogo.
          </li>
          <li>
            Los permisos del catálogo se actualizan ejecutando
            <code className="mono"> npx prisma db seed</code>; el seed es idempotente.
          </li>
          <li>
            Los cambios en permisos de un rol afectan a TODOS los usuarios con
            ese rol (pueden perder acceso a pantallas si les quitas un permiso).
          </li>
          <li>
            Añadir un nuevo permiso al catálogo requiere también aplicarlo en
            los endpoints via <code className="mono">@RequirePermission(...)</code> y en
            los Server Actions con <code className="mono">assertCan(...)</code>.
          </li>
        </ul>
      </div>

      <MatrizPermisos
        catalogo={catalogo}
        roles={roles}
        rolesSistemaIds={rolesSistemaIds}
        permisosPorRol={permisosPorRol}
      />
    </div>
  );
}

function renderError(mensaje: string, status: number) {
  return (
    <div className="page wide">
      <PageHeader title="Permisos de roles" />
      <div className="card card-pad" style={{ maxWidth: 520, margin: '40px auto' }}>
        <h2 className="text-[17px] font-semibold">Error al cargar</h2>
        <p className="muted mt-2 text-sm">{mensaje}</p>
        <p className="muted mt-2 text-xs">HTTP {status}</p>
      </div>
    </div>
  );
}
