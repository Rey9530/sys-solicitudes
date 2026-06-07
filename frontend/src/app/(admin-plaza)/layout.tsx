import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { logoutAction } from '@/app/logout-action';
import { Button } from '@/components/ui/button';

/**
 * Layout del admin de plaza (T-057/T-059/T-060). Verifica el rol en el
 * servidor; la API también lo exige (defensa en profundidad).
 * superadmin puede navegar (la API le exige plaza, pero el panel es de plaza).
 */
export default async function AdminPlazaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.rol !== 'admin_plaza' && session.user.rol !== 'superadmin') redirect('/');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-primary">Plazapp</span>
            <nav className="flex gap-4 text-sm">
              <Link href="/admin/locales" className="text-gray-600 hover:text-primary">
                Locales
              </Link>
              <Link href="/admin/inquilinos" className="text-gray-600 hover:text-primary">
                Inquilinos
              </Link>
              <Link href="/admin/contratos" className="text-gray-600 hover:text-primary">
                Contratos
              </Link>
              <Link href="/admin/categorias" className="text-gray-600 hover:text-primary">
                Categorías
              </Link>
              <Link href="/admin/solicitudes" className="text-gray-600 hover:text-primary">
                Solicitudes
              </Link>
              <Link href="/admin/notificaciones" className="text-gray-600 hover:text-primary">
                Notificaciones
              </Link>
              <Link href="/admin/calendario" className="text-gray-600 hover:text-primary">
                Calendario
              </Link>
            </nav>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
