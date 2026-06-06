import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { logoutAction } from '@/app/logout-action';
import { Button } from '@/components/ui/button';

/** Layout del portal del inquilino (T-060). Solo rol `inquilino`. */
export default async function InquilinoLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.rol !== 'inquilino') redirect('/');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-primary">Plazapp</span>
            <nav className="flex gap-4 text-sm">
              <Link href="/inquilino/contratos" className="text-gray-600 hover:text-primary">
                Mis contratos
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
