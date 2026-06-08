import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AppShell } from '@/components/shell/app-shell';
import { brandingStyle, loadPlazaBranding } from '@/lib/branding';

/**
 * Layout del admin de plaza (T-057/T-059/T-060). Verifica el rol en el
 * servidor; la API también lo exige (defensa en profundidad).
 * superadmin puede navegar (la API le exige plaza, pero el panel es de plaza).
 */
export default async function AdminPlazaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.rol !== 'admin_plaza' && session.user.rol !== 'superadmin') redirect('/');

  const plaza = await loadPlazaBranding();
  const css = brandingStyle(plaza?.colorPrimario);

  return (
    <>
      {css && <style>{css}</style>}
      <AppShell
        role="admin_plaza"
        user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
        plaza={
          plaza
            ? {
                nombreComercial: plaza.nombreComercial,
                colorPrimario: plaza.colorPrimario,
                logoUrl: plaza.logoUrl ?? null,
              }
            : null
        }
      >
        {children}
      </AppShell>
    </>
  );
}
