'use client';

import { Globe, PanelLeft, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/client/theme-toggle';
import { type AppRole, initials, SHELL_META } from './nav-config';
import { PlazaSelector, type PlazaLite } from './plaza-selector';
import { NotificationsBell } from './notifications-bell';
import type { ShellPlaza, ShellUser } from './sidebar';

interface TopbarProps {
  role: AppRole;
  user: ShellUser;
  plaza: ShellPlaza | null;
  plazas?: PlazaLite[];
  selectedPlazaId?: string | null;
  onToggleCollapse: () => void;
  onToggleMobile: () => void;
}

export function Topbar({
  role,
  user,
  plaza,
  plazas,
  selectedPlazaId,
  onToggleCollapse,
  onToggleMobile,
}: TopbarProps) {
  const meta = SHELL_META[role];

  function handleToggle() {
    // En escritorio colapsa la sidebar; en móvil abre/cierra el drawer.
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 920px)').matches) {
      onToggleMobile();
    } else {
      onToggleCollapse();
    }
  }

  return (
    <header className="topbar">
      <button
        type="button"
        className="top-toggle"
        onClick={handleToggle}
        aria-label="Alternar menú"
      >
        <PanelLeft />
      </button>

      <div className="top-search">
        <Search />
        <input type="text" placeholder="Buscar…" aria-label="Buscar" />
        <kbd>⌘K</kbd>
      </div>

      <div className="top-right">
        {role === 'superadmin' && plazas ? (
          <PlazaSelector plazas={plazas} selectedPlazaId={selectedPlazaId ?? null} />
        ) : meta.tenant ? (
          <div className="top-tenant" title={plaza?.nombreComercial ?? 'Plaza'}>
            <span
              className="dot"
              style={{ background: plaza?.colorPrimario ?? 'var(--primary)' }}
            />
            <span className="tt-name">{plaza?.nombreComercial ?? 'Mi plaza'}</span>
          </div>
        ) : (
          <div className="top-tenant">
            <Globe />
            <span className="tt-name">Plataforma</span>
          </div>
        )}

        <ThemeToggle />

        {/* PLANIFICACION/16: bandeja in-app solo para admin_plaza e inquilino
            (superadmin no recibe notificaciones, tampoco al impersonar). */}
        {role !== 'superadmin' && <NotificationsBell role={role} />}

        <span className="top-avatar" title={user.name ?? undefined}>
          {initials(user.name)}
        </span>
      </div>
    </header>
  );
}
