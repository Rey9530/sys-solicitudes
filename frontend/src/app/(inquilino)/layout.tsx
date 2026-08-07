import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppShell } from '@/components/shell/app-shell';
import { PermisosProvider } from '@/components/client/permisos-provider';
import { getPermisosEfectivos } from '@/lib/server/permisos';

/**
 * Layout del portal del inquilino (T-060). Solo rol `inquilino`.
 *
 * T-RBAC-1 (fix login 502, 2026-08-07): wrapea con `PermisosProvider` para
 * que los Client Components descendientes (formularios, listados) puedan
 * usar `<Can>` sin prop-drilling. `getPermisosEfectivos()` cachea por
 * request (una sola llamada a `/auth/me/permisos` por render).
 */
export default async function InquilinoLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.rol !== 'inquilino') redirect('/');

  const permisos = await getPermisosEfectivos();

  return (
    <PermisosProvider permisos={permisos}>
      <AppShell
        role="inquilino"
        user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
        plaza={null}
      >
        {children}
      </AppShell>
    </PermisosProvider>
  );
}
