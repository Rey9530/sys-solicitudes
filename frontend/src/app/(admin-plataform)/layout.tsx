import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { logoutAction } from '@/app/logout-action';
import { Button } from '@/components/ui/button';

/**
 * Layout del admin-plataform (superadmin). Verifica el rol en el servidor;
 * la API también lo exige (defensa en profundidad). T-046.
 */
export default async function AdminPlataformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.rol !== 'superadmin') redirect('/');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-primary">Plazapp</span>
            <nav className="flex gap-4 text-sm">
              <Link href="/superadmin/plazas" className="text-gray-600 hover:text-primary">
                Plazas
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
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
