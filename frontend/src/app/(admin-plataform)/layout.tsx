import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppShell } from '@/components/shell/app-shell';
import { brandingStyle } from '@/lib/branding';
import { loadSuperadminShell } from '@/lib/superadmin-shell';

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

  const { plazas, selected } = await loadSuperadminShell();
  const css = brandingStyle(selected?.colorPrimario);

  return (
    <>
      {css && <style>{css}</style>}
      <AppShell
        role="superadmin"
        user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
        plaza={null}
        plazas={plazas}
        selectedPlazaId={selected?.id ?? null}
      >
        {children}
      </AppShell>
    </>
  );
}
