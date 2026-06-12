import type { Metadata } from 'next';
import type { RolStaffOutput, UsuarioOutput } from '@app/contracts';
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
 * Módulo "Usuarios de plaza" — gestión de usuarios `admin_plaza` y del
 * catálogo de `rol_staff` (T-035 + T-059-ter, derivado de T-059-bis).
 *
 * CU-AU-1 (docs/03-modulos-del-sistema.md): un `admin_plaza` da de alta
 * usuarios `admin_plaza` adicionales para operar la plaza (toman para
 * revisión, aprueban, rechazan, supervisan subcategorías, etc.).
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

  const [usrRes, rsActivosRes, rsTodosRes] = await Promise.all([
    apiFetch(`/usuarios?${usrQs.toString()}`),
    apiFetch('/roles-staff?activo=true&pageSize=100'),
    apiFetch('/roles-staff?pageSize=100'),
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
        subtitle="Administra los usuarios con rol admin_plaza y el catálogo de roles de staff que se les asigna."
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
        ]}
      />
    </div>
  );
}
