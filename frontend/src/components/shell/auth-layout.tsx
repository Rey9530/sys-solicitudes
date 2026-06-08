import { CalendarCheck, ShieldCheck, Zap } from 'lucide-react';
import { ThemeToggle } from '@/components/client/theme-toggle';

/**
 * Layout split de autenticación (login / reset): panel de marca navy a la
 * izquierda + tarjeta de formulario a la derecha. En móvil el panel se oculta.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="auth">
      <aside className="auth-brand">
        <div className="auth-brand-top">
          <div className="auth-logo">
            <div className="side-logo">P</div>
            <b>Plazapp</b>
          </div>
          <ThemeToggle />
        </div>
        <div className="auth-brand-mid">
          <h2>Gestión operativa de tu plaza, sin fricción.</h2>
          <p>
            Solicitudes, contratos, calendario y reportes de tu centro comercial en un solo lugar,
            con flujo de aprobación y SLA.
          </p>
          <div className="auth-feats">
            <span>
              <ShieldCheck /> Multi-tenant seguro por plaza
            </span>
            <span>
              <Zap /> Flujo de solicitudes con semáforo SLA
            </span>
            <span>
              <CalendarCheck /> Calendario de eventos y mantenimientos
            </span>
          </div>
        </div>
        <div className="auth-brand-foot">
          <span className="dot" style={{ background: 'var(--primary)' }} />
          Plazapp · Helixsys
        </div>
      </aside>

      <main className="auth-form-col">
        <div className="auth-card">
          <div className="auth-head">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer}
      </main>
    </div>
  );
}
