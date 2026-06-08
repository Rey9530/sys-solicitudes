'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { logoutAction } from '@/app/logout-action';
import { type AppRole, initials, NAV, SHELL_META } from './nav-config';

export interface ShellUser {
  name: string | null;
  email: string | null;
}

export interface ShellPlaza {
  nombreComercial: string;
  colorPrimario: string | null;
  logoUrl: string | null;
}

interface SidebarProps {
  role: AppRole;
  user: ShellUser;
  /** Nombre de plaza para la cabecera (admin/inquilino); null = usa meta. */
  plazaName: string | null;
  /** Cierra el drawer móvil al navegar. */
  onNavigate?: () => void;
}

export function Sidebar({ role, user, plazaName, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const meta = SHELL_META[role];
  const groups = NAV[role];
  const brandSub = meta.tenant && plazaName ? plazaName : meta.brandSub;

  return (
    <aside className="side">
      <div className="side-head">
        <div className="side-logo">P</div>
        <div className="side-brand">
          <b>Plazapp</b>
          <span>{brandSub}</span>
        </div>
      </div>

      <nav className="side-scroll">
        {groups.map((group, gi) => (
          <div className="side-sec" key={group.label ?? `g${gi}`}>
            {group.label && <div className="side-sec-label">{group.label}</div>}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={active ? 'nav-link active' : 'nav-link'}
                  onClick={onNavigate}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="side-foot">
        <div className="side-user">
          <span className="avatar avatar-sm" style={{ background: 'linear-gradient(150deg, var(--primary-300), var(--primary))' }}>
            {initials(user.name)}
          </span>
          <div className="side-foot-txt">
            <b>{user.name ?? 'Usuario'}</b>
            <span>{meta.roleLabel}</span>
          </div>
          <form action={logoutAction} className="ml-auto">
            <button type="submit" className="icon-btn" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
