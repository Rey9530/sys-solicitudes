'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Globe, Search } from 'lucide-react';
import { selectPlazaAction } from '@/app/(admin-plataform)/superadmin/plazas/actions';

export interface PlazaLite {
  id: string;
  nombreComercial: string;
  slug?: string;
  colorPrimario: string | null;
}

interface Pos {
  top: number;
  right: number;
}

/**
 * Selector de plaza del superadmin (impersonación). Popover renderizado en un
 * portal (escapa al stacking/clipping del topbar) con búsqueda, punto de color,
 * estado activo y check. Persiste la elección vía `selectPlazaAction`.
 */
export function PlazaSelector({
  plazas,
  selectedPlazaId,
}: {
  plazas: PlazaLite[];
  selectedPlazaId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = plazas.find((p) => p.id === selectedPlazaId) ?? null;
  const conBusqueda = plazas.length > 7;
  const q = query.trim().toLowerCase();
  const filtradas = q
    ? plazas.filter(
        (p) =>
          p.nombreComercial.toLowerCase().includes(q) || (p.slug ?? '').toLowerCase().includes(q),
      )
    : plazas;

  function place() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) });
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    place();
    setQuery('');
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) });
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function choose(value: string | null) {
    setOpen(false);
    if (value === selectedPlazaId) return;
    startTransition(async () => {
      await selectPlazaAction(value);
      router.push(value ? '/admin/dashboard' : '/superadmin/dashboard');
      router.refresh();
    });
  }

  return (
    <div className="tenant-wrap">
      <button
        ref={triggerRef}
        type="button"
        className="top-tenant tenant-btn"
        onClick={toggle}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Cambiar de plaza"
      >
        {selected ? (
          <span className="tt-dot" style={{ background: selected.colorPrimario ?? 'var(--primary)' }} />
        ) : (
          <Globe style={{ width: 15, height: 15, color: 'var(--text-muted)', flex: 'none' }} />
        )}
        <span className="tt-name">{selected ? selected.nombreComercial : 'Todas las plazas'}</span>
        <ChevronDown className="tt-chev" />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="plaza-menu"
            role="menu"
            style={{ position: 'fixed', top: pos.top, right: pos.right }}
          >
            <div className="plaza-menu-head">
              <b>Cambiar de plaza</b>
              <span>Elige sobre qué plaza ver y operar.</span>
            </div>

            {conBusqueda && (
              <div className="plaza-search">
                <Search />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar plaza…"
                  aria-label="Buscar plaza"
                />
              </div>
            )}

            <div className="plaza-list">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={!selectedPlazaId}
                className={`plaza-opt${!selectedPlazaId ? ' active' : ''}`}
                onClick={() => choose(null)}
              >
                <span className="po-globe">
                  <Globe />
                </span>
                <span className="po-text">
                  <span className="po-name">Todas las plazas</span>
                  <span className="po-sub">Vista global de la plataforma</span>
                </span>
                {!selectedPlazaId && <Check className="po-check" />}
              </button>

              <div className="plaza-sep" />

              {filtradas.length === 0 ? (
                <div className="plaza-empty">Sin plazas que coincidan.</div>
              ) : (
                filtradas.map((p) => {
                  const active = p.id === selectedPlazaId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      className={`plaza-opt${active ? ' active' : ''}`}
                      onClick={() => choose(p.id)}
                    >
                      <span className="po-dot">
                        <i style={{ background: p.colorPrimario ?? 'var(--primary)' }} />
                      </span>
                      <span className="po-text">
                        <span className="po-name">{p.nombreComercial}</span>
                        {p.slug && <span className="po-sub">{p.slug}</span>}
                      </span>
                      {active && <Check className="po-check" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
