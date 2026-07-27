import type { Metadata } from 'next';
import Link from 'next/link';
import type { ListarPermisosOutput, RolStaffOutput, UsuarioOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { UsuariosPlazaTable } from '@/components/client/usuarios-plaza-table';
import { UsuariosPlazaFiltros } from '@/components/client/usuarios-plaza-filtros';
import { RolesStaffTable } from '@/components/client/roles-staff-table';
import { RolStaffFormDialog } from '@/components/client/rol-staff-form-dialog';
import { AltaUsuarioPlazaDialog } from '@/components/client/alta-usuario-plaza-dialog';
import { UsuariosPlazaTabs } from '@/components/client/usuarios-plaza-tabs';
import { Pager } from '@/components/ui/pager';

export const metadata: Metadata = { title: 'Usuarios de plaza' };

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type UsuarioPlazaRow = UsuarioOutput & {
  rolStaffActivo: boolean | null;
  rolStaffNombre: string | null;
};

interface RolesStaffConAsignaciones extends RolStaffOutput {
  usuariosAsignados: number;
}

type RolesStaffList = Paginated<RolStaffOutput>;

/**
 * Módulo "Usuarios de plaza" — gestión de usuarios `admin_plaza`, catálogo
 * de `rol_staff` (T-035 + T-059-ter) y matriz de permisos (T-RBAC-1).
 *
 * Tres pestañas:
 *  - "Usuarios": altas/bajas/reset y asignación de rol de staff.
 *  - "Roles de staff": CRUD de `rol_staff` por plaza.
 *  - "Permisos": matriz granular rol × permiso (solo si el usuario tiene
 *    `permisos.ver_matriz`; en caso contrario la pestaña se muestra como
 *    un link a `/admin/usuarios-plaza/permisos` o se oculta).
 */
export default async function UsuariosPlazaPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    activo?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;

  // ── Tab Usuarios ─────────────────────────────────────────────────────────
  const usrQs = new URLSearchParams({
    rol: 'admin_plaza',
    page: sp.page ?? '1',
    pageSize: '20',
  });
  if (sp.search) usrQs.set('search', sp.search);

  const [usrRes, rsActivosRes, rsTodosRes, catalogoRes] = await Promise.all([
    apiFetch(`/usuarios?${usrQs.toString()}`),
    apiFetch('/roles-staff?activo=true&pageSize=100'),
    apiFetch('/roles-staff?pageSize=100'),
    // T-RBAC-1: nº de permisos del catálogo (chip de la pestaña).
    apiFetch('/permisos'),
  ]);

  const usuarios: Paginated<UsuarioPlazaRow> = usrRes.ok
    ? ((await usrRes.json()) as Paginated<UsuarioPlazaRow>)
    : { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };

  const rolesActivos: RolStaffOutput[] = rsActivosRes.ok
    ? ((await rsActivosRes.json()) as Paginated<RolStaffOutput>).items
    : [];

  const rolesTodos: RolesStaffConAsignaciones[] = rsTodosRes.ok
    ? ((await rsTodosRes.json()) as { items: RolesStaffConAsignaciones[] }).items ?? []
    : [];

  const catalogo: ListarPermisosOutput | null = catalogoRes.ok
    ? ((await catalogoRes.json()) as ListarPermisosOutput)
    : null;
  const totalPermisos = catalogo?.total ?? 0;

  // ── Tab Roles de staff ──────────────────────────────────────────────────
  const rsQs = new URLSearchParams({
    page: sp.page ?? '1',
    pageSize: '50',
  });
  if (sp.activo === 'true' || sp.activo === 'false') rsQs.set('activo', sp.activo);
  const rsListRes = await apiFetch(`/roles-staff?${rsQs.toString()}`);
  const rolesStaff: RolesStaffList = rsListRes.ok
    ? ((await rsListRes.json()) as RolesStaffList)
    : { items: [], total: 0, page: 1, pageSize: 50, totalPages: 0 };

  const hrefForUsuarios = (page: number) =>
    `/admin/usuarios-plaza?${new URLSearchParams({ tab: 'usuarios', ...sp, page: String(page) }).toString()}`;
  const hrefForRoles = (page: number) =>
    `/admin/usuarios-plaza?${new URLSearchParams({ tab: 'roles', ...sp, page: String(page) }).toString()}`;

  return (
    <div className="page wide">
      <PageHeader
        title="Usuarios de plaza"
        subtitle="Administra los usuarios con rol admin_plaza, el catálogo de roles de staff y la matriz de permisos granulares."
      />

      <UsuariosPlazaTabs
        tabs={[
          {
            key: 'usuarios',
            label: 'Usuarios',
            count: usuarios.total,
            content: (
              <>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <UsuariosPlazaFiltros search={sp.search} />
                  <AltaUsuarioPlazaDialog rolesStaff={rolesActivos} />
                </div>
                <UsuariosPlazaTable usuarios={usuarios.items} rolesStaff={rolesActivos} />
                <div className="mt-4">
                  <Pager
                    page={usuarios.page}
                    totalPages={usuarios.totalPages}
                    hrefFor={hrefForUsuarios}
                  />
                </div>
              </>
            ),
          },
          {
            key: 'roles',
            label: 'Roles de staff',
            count: rolesStaff.total,
            content: (
              <>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <p className="text-sm text-gray-500">
                    Catálogo de roles operativos que se asignan a cada admin_plaza
                    (técnico, ingeniero, supervisor, etc.). Cada plaza crea los que
                    necesite.
                  </p>
                  <RolStaffFormDialog mode="create" />
                </div>
                <RolesStaffTable
                  roles={rolesStaff.items}
                  usuariosAsignadosPorRol={Object.fromEntries(
                    rolesTodos.map((r) => [r.id, r.usuariosAsignados]),
                  )}
                />
                <div className="mt-4">
                  <Pager
                    page={rolesStaff.page}
                    totalPages={rolesStaff.totalPages}
                    hrefFor={hrefForRoles}
                  />
                </div>
              </>
            ),
          },
          {
            // T-RBAC-1 · Pestaña "Permisos": la gestión granular vive en
            // /admin/usuarios-plaza/permisos (Server Component dedicado).
            // Esta pestaña solo muestra un link + resumen; el gating fino se
            // aplica dentro de la página destino (assertCan all cargar).
            key: 'permisos',
            label: 'Permisos',
            count: totalPermisos,
            content: <PermisosTabLink />,
          },
        ]}
      />
    </div>
  );
}

/**
 * Contenido resumido de la pestaña Permisos. La gestión real ocurre en
 * `/admin/usuarios-plaza/permisos` (página dedicada con la matriz).
 * Mostrar este resumen aquí evita cargar todos los permisos + roles + permisos
 * por rol en cada navegación a /usuarios-plaza (la pestaña Usuarios no lo
 * necesita). El link lleva a la página completa con su propio assertCan.
 */
function PermisosTabLink() {
  return (
    <div className="card card-pad" style={{ maxWidth: 720, margin: '20px auto' }}>
      <h2 className="text-[17px] font-semibold">Matriz de permisos granulares</h2>
      <p className="muted mt-2 text-sm">
        Asigna permisos específicos a cada rol de staff (aprobar solicitudes,
        editar locales, ver auditoría, etc.). Los cambios afectan a todos los
        usuarios con ese rol.
      </p>
      <p className="muted mt-2 text-sm">
        El rol <code className="mono">admin</code> es del sistema y siempre tiene
        todos los permisos; no se puede modificar.
      </p>
      <div className="mt-4 flex justify-end">
        <Link href="/admin/usuarios-plaza/permisos" className="btn btn-primary">
          Abrir matriz de permisos →
        </Link>
      </div>
    </div>
  );
}
