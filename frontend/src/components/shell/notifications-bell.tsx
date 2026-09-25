'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  Ban,
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  Eye,
  FileWarning,
  Flag,
  Inbox,
  type LucideIcon,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Send,
  UserCheck,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { NotificacionOutput, NotificacionTipo } from '@app/contracts';
import {
  getNotificacionesConteoAction,
  getNotificacionesInboxAction,
  marcarNotificacionLeidaAction,
  marcarTodasLeidasAction,
} from '@/lib/server/notificaciones-inbox-actions';
import { formatInPlazaTz } from '@/lib/datetime';
import { cn } from '@/lib/utils';
import type { AppRole } from './nav-config';

/** Intervalo del polling del conteo (decisión owner 2026-09-25: 30–60 s). */
const POLL_MS = 45_000;
const MENU_W = 360;
const MARGIN = 12;

type Tone = 'ok' | 'danger' | 'warn' | 'info' | 'neutral' | 'violet';

const TIPO_META: Record<NotificacionTipo, { icon: LucideIcon; tone: Tone }> = {
  solicitud_asignada: { icon: UserCheck, tone: 'info' },
  solicitud_nueva_supervisor: { icon: Users, tone: 'info' },
  solicitud_reasignada: { icon: ArrowLeftRight, tone: 'info' },
  solicitud_desasignada: { icon: ArrowLeftRight, tone: 'neutral' },
  solicitud_en_revision: { icon: Eye, tone: 'info' },
  solicitud_aprobada: { icon: CheckCircle2, tone: 'ok' },
  solicitud_rechazada: { icon: XCircle, tone: 'danger' },
  solicitud_subsanacion: { icon: Wrench, tone: 'warn' },
  solicitud_cerrada: { icon: Flag, tone: 'violet' },
  solicitud_pausada: { icon: PauseCircle, tone: 'warn' },
  solicitud_reanudada: { icon: PlayCircle, tone: 'info' },
  solicitud_liberada: { icon: RotateCcw, tone: 'neutral' },
  solicitud_cancelada: { icon: Ban, tone: 'neutral' },
  solicitud_reenviada: { icon: Send, tone: 'info' },
  comentario_nuevo: { icon: MessageSquare, tone: 'violet' },
  contrato_por_vencer: { icon: FileWarning, tone: 'warn' },
};

/** Destino del clic según entidad + rol del usuario. */
function hrefFor(n: NotificacionOutput, role: AppRole): string | null {
  if (n.solicitudId) {
    return role === 'inquilino'
      ? `/inquilino/solicitudes/${n.solicitudId}`
      : `/admin/solicitudes/${n.solicitudId}`;
  }
  if (n.contratoId) return `/admin/contratos/${n.contratoId}`;
  return null;
}

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

function tiempoRelativo(iso: string, now: number): string {
  const diffS = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffS);
  if (abs < 45) return 'hace un momento';
  if (abs < 3600) return rtf.format(Math.round(diffS / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(diffS / 3600), 'hour');
  if (abs < 7 * 86_400) return rtf.format(Math.round(diffS / 86_400), 'day');
  // Fecha absoluta SIEMPRE en la TZ de la plaza (T-V08), nunca la del navegador/UTC.
  return formatInPlazaTz(iso, 'dd/MM/yyyy hh:mmaaa');
}

interface Pos {
  top: number;
  right: number;
}

/**
 * Campana de notificaciones in-app (PLANIFICACION/16). Polling del conteo
 * cada 45 s solo con la pestaña visible; al abrir carga las 20 más recientes.
 * Clic en un ítem → marca leída + navega a la solicitud/contrato.
 * Popover en portal (mismo patrón que `PlazaSelector`).
 */
export function NotificationsBell({ role }: { role: AppRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [items, setItems] = useState<NotificacionOutput[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Referencia para el tiempo relativo; se fija al cargar la bandeja. */
  const [now, setNow] = useState(0);
  const [loading, startLoading] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const refrescarConteo = useCallback(async () => {
    try {
      const r = await getNotificacionesConteoAction();
      if (r.ok) setNoLeidas(r.data.noLeidas);
    } catch {
      // Red caída / sesión expirando: se reintenta en el siguiente tick.
    }
  }, []);

  // Polling del conteo, pausado con la pestaña oculta.
  useEffect(() => {
    // Primer conteo diferido (fuera del cuerpo del efecto: sin render en cascada).
    const primero = setTimeout(() => void refrescarConteo(), 0);
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer === null) timer = setInterval(() => void refrescarConteo(), POLL_MS);
    };
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refrescarConteo();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(primero);
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refrescarConteo]);

  function place() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const menuW = Math.min(MENU_W, vw - MARGIN * 2);
    const right = Math.min(Math.max(MARGIN, vw - r.right), Math.max(MARGIN, vw - menuW - MARGIN));
    setPos({ top: r.bottom + 8, right });
  }

  function cargar() {
    startLoading(async () => {
      try {
        const r = await getNotificacionesInboxAction();
        if (r.ok) {
          setNow(Date.now());
          setItems(r.data.items);
          setNoLeidas(r.data.noLeidas);
          setError(null);
        } else {
          setError(r.error);
        }
      } catch {
        setError('No se pudieron cargar las notificaciones.');
      }
    });
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    place();
    setOpen(true);
    cargar();
  }

  useEffect(() => {
    if (!open) return;
    const reposition = () => place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
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

  function abrirNotificacion(n: NotificacionOutput) {
    // Optimista: la UI refleja "leída" de inmediato.
    if (!n.leida) {
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, leida: true } : x)) ?? null);
      setNoLeidas((c) => Math.max(0, c - 1));
      void marcarNotificacionLeidaAction(n.id).catch(() => undefined);
    }
    setOpen(false);
    const href = hrefFor(n, role);
    if (href) router.push(href);
  }

  function marcarTodas() {
    setItems((prev) => prev?.map((x) => ({ ...x, leida: true })) ?? null);
    setNoLeidas(0);
    void marcarTodasLeidasAction()
      .then((r) => {
        if (!r.ok) void refrescarConteo();
      })
      .catch(() => void refrescarConteo());
  }

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const opts = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('.notif-item') ?? [],
    );
    if (opts.length === 0) return;
    e.preventDefault();
    const idx = opts.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === 'ArrowDown'
        ? opts[(idx + 1) % opts.length]
        : opts[(idx - 1 + opts.length) % opts.length];
    next?.focus();
  }

  const badge = noLeidas > 9 ? '9+' : String(noLeidas);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="icon-btn"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={noLeidas > 0 ? `Notificaciones: ${noLeidas} sin leer` : 'Notificaciones'}
      >
        <Bell />
        {noLeidas > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="plaza-menu notif-menu"
            role="menu"
            aria-label="Notificaciones"
            style={{ position: 'fixed', top: pos.top, right: pos.right }}
            onKeyDown={onMenuKeyDown}
          >
            <div className="notif-head">
              <div>
                <b>Notificaciones</b>
                <span>{noLeidas > 0 ? `${noLeidas} sin leer` : 'Estás al día'}</span>
              </div>
              {noLeidas > 0 && (
                <button type="button" className="notif-mark-all" onClick={marcarTodas}>
                  <CheckCheck />
                  Marcar todas como leídas
                </button>
              )}
            </div>

            <div className="notif-list">
              {error ? (
                <div className="notif-empty">
                  <BellOff />
                  <span>{error}</span>
                </div>
              ) : items === null ? (
                <div className="notif-empty" aria-busy={loading}>
                  <span>Cargando…</span>
                </div>
              ) : items.length === 0 ? (
                <div className="notif-empty">
                  <Inbox />
                  <span>No tienes notificaciones</span>
                </div>
              ) : (
                items.map((n) => {
                  const meta = TIPO_META[n.tipo] ?? { icon: Bell, tone: 'neutral' as Tone };
                  const Icon = meta.icon;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      role="menuitem"
                      className={cn('notif-item', !n.leida && 'unread')}
                      onClick={() => abrirNotificacion(n)}
                    >
                      <span className={`notif-icon tone-${meta.tone}`}>
                        <Icon />
                      </span>
                      <span className="notif-text">
                        <span className="notif-title">{n.titulo}</span>
                        <span className="notif-msg">{n.mensaje}</span>
                        <time
                          className="notif-time"
                          dateTime={n.createdAt}
                          title={formatInPlazaTz(n.createdAt, 'dd/MM/yyyy hh:mmaaa')}
                        >
                          {tiempoRelativo(n.createdAt, now)}
                        </time>
                      </span>
                      {!n.leida && <span className="notif-dot" aria-label="Sin leer" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
