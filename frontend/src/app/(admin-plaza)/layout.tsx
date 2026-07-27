import { redirect } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { auth } from '@/auth';
import { AppShell } from '@/components/shell/app-shell';
import { brandingStyle, loadPlazaBranding } from '@/lib/branding';
import { loadSuperadminShell } from '@/lib/superadmin-shell';

/**
 * Layout del admin de plaza (T-057/T-059/T-060). Verifica el rol en el
 * servidor; la API también lo exige (defensa en profundidad).
 * superadmin puede operar la consola de plaza "actuando como" una plaza
 * seleccionada (impersonación); sin selección se muestra un gate.
 *
 * T-RBAC-1: propaga `session.user.permisos` al shell para que la sidebar
 * filtre items según permisos granulares. superadmin recibe wildcard `['*']`
 * (en `TokenService.resolvePermisosEfectivos` del backend) → ve todo.
 */
export default async function AdminPlazaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.rol !== 'admin_plaza' && session.user.rol !== 'superadmin') redirect('/');

  const userPermisos = session.user.permisos ?? [];

  // ── Superadmin: consola de plaza por impersonación ──
  if (session.user.rol === 'superadmin') {
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
          permisos={userPermisos}
        >
          {selected ? (
            children
          ) : (
            <div className="page">
              <div className="card card-pad" style={{ maxWidth: 460, margin: '40px auto', textAlign: 'center' }}>
                <div className="empty-ic" style={{ margin: '0 auto 16px' }}>
                  <Building2 />
                </div>
                <h2 className="text-[17px] font-semibold">Selecciona una plaza para operar</h2>
                <p className="muted mt-2 text-sm">
                  Usa el selector de plaza en la barra superior para elegir sobre qué plaza quieres
                  ver y operar (Solicitudes, Locales, Contratos, etc.).
                </p>
              </div>
            </div>
          )}
        </AppShell>
      </>
    );
  }

  // ── admin_plaza: su propia plaza (branding del JWT) ──
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
        permisos={userPermisos}
      >
        {children}
      </AppShell>
    </>
  );
}
