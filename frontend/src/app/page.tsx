import Link from 'next/link';
import { ArrowRight, Building2, FileText, Inbox, LayoutDashboard, type LucideIcon } from 'lucide-react';
import type { PlazaOutput } from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';
import { brandingStyle } from '@/lib/branding';
import { ThemeToggle } from '@/components/client/theme-toggle';
import { logoutAction } from './logout-action';

interface MeResponse {
  email: string;
  nombre: string;
  rol: string;
  plazaId: string | null;
}

const DESTINO: Record<string, { href: string; icon: LucideIcon; title: string; desc: string; tint: string }> = {
  superadmin: {
    href: '/superadmin/plazas',
    icon: Building2,
    title: 'Consola de plataforma',
    desc: 'Gestiona las plazas y sus administradores.',
    tint: 'tint-violet',
  },
  admin_plaza: {
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    title: 'Administrar la plaza',
    desc: 'Dashboard, solicitudes, locales, contratos y más.',
    tint: 'tint-primary',
  },
  inquilino: {
    href: '/inquilino/solicitudes',
    icon: Inbox,
    title: 'Portal del inquilino',
    desc: 'Tus solicitudes, contratos y calendario.',
    tint: 'tint-info',
  },
};

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="home-entry">
        <div className="home-theme">
          <ThemeToggle />
        </div>
        <div className="card card-pad home-card text-center">
          <div className="side-logo mx-auto mb-4" style={{ width: 44, height: 44, fontSize: 18 }}>
            P
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
            Plazapp
          </h1>
          <p className="muted mt-2 text-sm">
            Plataforma de gestión de solicitudes para centros comerciales.
          </p>
          <Link href="/login" className="btn btn-primary btn-lg mt-6">
            Iniciar sesión
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  // Perfil vía BFF (/auth/me).
  let me: MeResponse | null = null;
  const meRes = await apiFetch('/auth/me');
  if (meRes.ok) me = (await meRes.json()) as MeResponse;

  // Branding por plaza (T-042): admin_plaza ve el color/logo de su plaza.
  let plaza: PlazaOutput | null = null;
  if (session.user.rol === 'admin_plaza' && session.user.plazaId) {
    const plazaRes = await apiFetch(`/plazas/${session.user.plazaId}`);
    if (plazaRes.ok) plaza = (await plazaRes.json()) as PlazaOutput;
  }

  const rol = me?.rol ?? session.user.rol ?? 'inquilino';
  const destino = DESTINO[rol];
  const css = brandingStyle(plaza?.colorPrimario);

  return (
    <main className="home-entry">
      {css && <style>{css}</style>}
      <div className="home-theme">
        <ThemeToggle />
      </div>
      <div className="card card-pad home-card">
        <div className="home-plaza">
          {plaza?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={plaza.logoUrl} alt={plaza.nombreComercial} className="h-10 object-contain" />
          ) : (
            <div className="side-logo" style={{ width: 40, height: 40 }}>
              {(plaza?.nombreComercial ?? 'P').charAt(0)}
            </div>
          )}
          <div>
            <b>{plaza?.nombreComercial ?? 'Plazapp'}</b>
            <span>{me?.email ?? session.user.email}</span>
          </div>
        </div>

        <p className="home-greet">Hola, {me?.nombre ?? session.user.name}</p>
        <p className="muted mb-4 text-sm capitalize">{rol.replace('_', ' ')}</p>

        <div className="home-dest">
          {destino && (
            <Link href={destino.href} className="home-dest-card">
              <span className={`kpi-ic ${destino.tint}`}>
                <destino.icon />
              </span>
              <div>
                <b>{destino.title}</b>
                <span>{destino.desc}</span>
              </div>
              <ArrowRight />
            </Link>
          )}
          {rol === 'inquilino' && (
            <Link href="/inquilino/contratos" className="home-dest-card">
              <span className="kpi-ic tint-ok">
                <FileText />
              </span>
              <div>
                <b>Mis contratos</b>
                <span>Consulta y descarga tus contratos.</span>
              </div>
              <ArrowRight />
            </Link>
          )}
        </div>

        <form action={logoutAction} className="mt-6">
          <button type="submit" className="btn btn-secondary btn-block">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
