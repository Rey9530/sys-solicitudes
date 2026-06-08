'use client';

import { Moon, Sun } from 'lucide-react';

/**
 * Toggle de tema claro/oscuro. El tema inicial lo fija un script inline en
 * `app/layout.tsx` (anti-flash). Aquí solo leemos/escribimos `data-theme` en
 * `<html>` al hacer click y persistimos en localStorage. El icono visible se
 * decide por CSS según `[data-theme]` (sin estado React → sin mismatch de
 * hidratación ni setState en effects).
 */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* almacenamiento no disponible: el cambio se mantiene solo en memoria */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={className ?? 'icon-btn'}
      aria-label="Cambiar tema"
      title="Cambiar tema"
    >
      <Moon className="theme-ic-moon" />
      <Sun className="theme-ic-sun" />
    </button>
  );
}
