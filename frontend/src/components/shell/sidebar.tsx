'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { logoutAction } from '@/app/logout-action';
import { can } from '@/lib/can';
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
  /**
   * T-RBAC-1 · Permisos efectivos del usuario actual. Lo pasa el Server
   * Component layout (no `useSession()` aquí para evitar hydration mismatch
   * y un fetch redundante en cada navegación). Items sin `permisoRequerido`
   * son siempre visibles; los demás se filtran por este set.
   *
   * Si el rol es `superadmin`, el caller debe pasar `['*']` para que
   * `can()` autorice todos los ítems. Por defecto (admin_plaza sin
   * `rol_staff_id` del seed legacy) se pasa la lista completa del catálogo.
   */
  permisos?: readonly string[];
  /** Cierra el drawer móvil al navegar. */
  onNavigate?: () => void;
}

export function Sidebar({ role, user, plazaName, permisos, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const meta = SHELL_META[role];
  const groups = NAV[role];
  const brandSub = meta.tenant && plazaName ? plazaName : meta.brandSub;

  // Filtra ítems por permiso granular (T-RBAC-1). Los grupos sin ítems
  // visibles se descartan para no mostrar cabeceras huérfanas.
  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => !i.permisoRequerido || can(permisos, i.permisoRequerido)),
    }))
    .filter((g) => g.items.length > 0);

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
        {visibleGroups.map((group, gi) => (
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
