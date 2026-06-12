import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { UsuarioOutput, RolStaffOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import { EditarUsuarioPlazaDialog } from '@/components/client/editar-usuario-plaza-dialog';

export const metadata: Metadata = { title: 'Detalle de usuario de plaza' };

type UsuarioPlazaDetalle = UsuarioOutput & {
  rolStaffActivo: boolean | null;
  rolStaffNombre: string | null;
};

/**
 * Detalle de un usuario `admin_plaza`. Resumen + edición inline. La pestaña
 * "Solicitudes asignadas" se deja como placeholder (los endpoints de
 * solicitudes por usuario llegan en otro módulo; el listado general ya
 * permite filtrar por responsable).
 */
export default async function UsuarioPlazaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [userRes, rolesRes] = await Promise.all([
    apiFetch(`/usuarios/${id}`),
    apiFetch('/roles-staff?pageSize=100'),
  ]);

  if (!userRes.ok) notFound();
  const usuario = (await userRes.json()) as UsuarioPlazaDetalle;

  const rolesStaff: RolStaffOutput[] = rolesRes.ok
    ? (((await rolesRes.json()) as { items: RolStaffOutput[] }).items ?? [])
    : [];

  return (
    <div className="page">
      <PageHeader
        breadcrumb={[
          { label: 'Usuarios de plaza', href: '/admin/usuarios-plaza' },
          { label: usuario.nombre },
        ]}
        title={usuario.nombre}
        subtitle={usuario.email}
        actions={
          usuario.deletedAt === null && (
            <EditarUsuarioPlazaDialog
              usuarioId={usuario.id}
              nombreInicial={usuario.nombre}
              telefonoInicial={usuario.telefono}
              email={usuario.email}
              rolStaffIdInicial={usuario.rolStaffId}
              rolesStaff={rolesStaff}
            />
          )
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card card-pad space-y-2">
          <h3 className="text-sm font-semibold text-gray-500">Identidad</h3>
          <Row label="Email" value={usuario.email} mono />
          <Row label="Nombre" value={usuario.nombre} />
          <Row label="Teléfono" value={usuario.telefono ?? '—'} />
          <Row label="Rol global" value="admin_plaza" />
        </div>
        <div className="card card-pad space-y-2">
          <h3 className="text-sm font-semibold text-gray-500">Operación</h3>
          <Row
            label="Rol de staff"
            value={
              usuario.rolStaffNombre
                ? usuario.rolStaffActivo
                  ? usuario.rolStaffNombre
                  : `${usuario.rolStaffNombre} (inactivo)`
                : '—'
            }
          />
          <Row
            label="Último acceso"
            value={usuario.lastLoginAt ? new Date(usuario.lastLoginAt).toLocaleString() : 'Nunca'}
          />
          <Row
            label="Estado"
            value={
              usuario.deletedAt
                ? `Inactivo desde ${new Date(usuario.deletedAt).toLocaleString()}`
                : usuario.emailInvalido
                  ? 'Email inválido (hard bounce)'
                  : 'Activo'
            }
          />
        </div>
      </div>

      <div className="card card-pad mt-4">
        <h3 className="text-sm font-semibold text-gray-500">Solicitudes asignadas</h3>
        <p className="muted text-sm">
          Vista pendiente de integración. Por ahora filtra por responsable en{' '}
          <Link href="/admin/solicitudes" className="text-blue-600 hover:underline">
            Solicitudes
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 text-gray-500">{label}</span>
      <span className={mono ? 'mono' : ''}>{value}</span>
    </div>
  );
}
