'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { AppRole } from './nav-config';
import type { PlazaLite } from './plaza-selector';
import { Sidebar, type ShellPlaza, type ShellUser } from './sidebar';
import { Topbar } from './topbar';

interface AppShellProps {
  role: AppRole;
  user: ShellUser;
  plaza: ShellPlaza | null;
  /** Solo superadmin: lista de plazas y selección actual para el selector. */
  plazas?: PlazaLite[];
  selectedPlazaId?: string | null;
  children: React.ReactNode;
}

const COLLAPSE_KEY = 'sidebar-collapsed';

/**
 * Shell de la consola: sidebar navy + topbar + main. Mantiene el estado de UI
 * (colapsado/persistido y drawer móvil). Los datos llegan ya resueltos por el
 * layout servidor; aquí solo vive la interacción (decisión BFF del proyecto).
 */
export function AppShell({ role, user, plaza, plazas, selectedPlazaId, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sincroniza el estado inicial desde localStorage (sistema externo). Se hace
  // en effect a propósito para no romper la hidratación: el server no conoce la
  // preferencia, así que arranca expandida y se ajusta tras montar.
  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_KEY) === '1') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sync único desde localStorage al montar
        setCollapsed(true);
      }
    } catch {
      /* sin almacenamiento: arranca expandida */
    }
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className={cn('shell', collapsed && 'collapsed', mobileOpen && 'mobile-open')}>
      <Sidebar
        role={role}
        user={user}
        plazaName={plaza?.nombreComercial ?? null}
        onNavigate={() => setMobileOpen(false)}
      />
      <div className="main-col">
        <Topbar
          role={role}
          user={user}
          plaza={plaza}
          plazas={plazas}
          selectedPlazaId={selectedPlazaId ?? null}
          onToggleCollapse={toggleCollapse}
          onToggleMobile={() => setMobileOpen((p) => !p)}
        />
        <main className="main">{children}</main>
      </div>

      {/* Backdrop del drawer móvil */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          style={{ zIndex: 39 }}
        />
      )}
    </div>
  );
}
