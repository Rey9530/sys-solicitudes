import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppShell } from '@/components/shell/app-shell';
import { PermisosProvider } from '@/components/client/permisos-provider';
import { brandingStyle } from '@/lib/branding';
import { loadSuperadminShell } from '@/lib/superadmin-shell';
import { getPermisosEfectivos } from '@/lib/server/permisos';

/**
 * Layout del admin-plataform (superadmin). Verifica el rol en el servidor;
 * la API también lo exige (defensa en profundidad). T-046.
 *
 * T-RBAC-1 (fix login 502, 2026-08-07): los permisos se resuelven via
 * `getPermisosEfectivos()` (server-side, cacheado por request) y se exponen
 * a los Client Components descendientes con `PermisosProvider`. superadmin
 * recibe wildcard `['*']` desde el backend.
 */
export default async function AdminPlataformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.rol !== 'superadmin') redirect('/');

  const { plazas, selected } = await loadSuperadminShell();
  const css = brandingStyle(selected?.colorPrimario);
  const permisos = await getPermisosEfectivos();

  return (
    <>
      {css && <style>{css}</style>}
      <PermisosProvider permisos={permisos}>
        <AppShell
          role="superadmin"
          user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
          plaza={null}
          plazas={plazas}
          selectedPlazaId={selected?.id ?? null}
          permisos={permisos}
        >
          {children}
        </AppShell>
      </PermisosProvider>
    </>
  );
}
