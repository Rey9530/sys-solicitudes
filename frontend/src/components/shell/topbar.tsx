'use client';

import { Bell, Globe, PanelLeft, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/client/theme-toggle';
import { type AppRole, initials, SHELL_META } from './nav-config';
import type { ShellPlaza, ShellUser } from './sidebar';

interface TopbarProps {
  role: AppRole;
  user: ShellUser;
  plaza: ShellPlaza | null;
  onToggleCollapse: () => void;
  onToggleMobile: () => void;
}

export function Topbar({ role, user, plaza, onToggleCollapse, onToggleMobile }: TopbarProps) {
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
      <button type="button" className="top-toggle" onClick={handleToggle} aria-label="Alternar menú">
        <PanelLeft />
      </button>

      <div className="top-search">
        <Search />
        <input type="text" placeholder="Buscar…" aria-label="Buscar" />
        <kbd>⌘K</kbd>
      </div>

      <div className="top-right">
        {meta.tenant ? (
          <div className="top-tenant" title={plaza?.nombreComercial ?? 'Plaza'}>
            <span
              className="dot"
              style={{ background: plaza?.colorPrimario ?? 'var(--primary)' }}
            />
            {plaza?.nombreComercial ?? 'Mi plaza'}
          </div>
        ) : (
          <div className="top-tenant">
            <Globe />
            Plataforma
          </div>
        )}

        <ThemeToggle />

        <button type="button" className="icon-btn" aria-label="Notificaciones">
          <Bell />
          <span className="ping" />
        </button>

        <span className="top-avatar" title={user.name ?? undefined}>
          {initials(user.name)}
        </span>
      </div>
    </header>
  );
}
