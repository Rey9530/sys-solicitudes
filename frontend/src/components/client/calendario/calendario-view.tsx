'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import luxon3Plugin from '@fullcalendar/luxon3';
import esLocale from '@fullcalendar/core/locales/es';
import type { DateClickArg } from '@fullcalendar/interaction';
import type { EventClickArg, EventContentArg, EventDropArg, EventInput } from '@fullcalendar/core';
import type { VerboseFormattingArg } from '@fullcalendar/core/internal';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import type { CalendarioEventoOutput } from '@app/contracts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SolicitudEstadoBadge } from '@/components/estado-badge';
import { fetchCalendarioFeedAction, moverEventoAction } from '@/app/calendario-actions';
import { formatFechaHora12, formatHora12, hhmm12 } from '@/lib/datetime';

const TZ_PLAZA = 'America/El_Salvador';
/**
 * Tipos visualizados en el panel de filtros. Desde 2026-09-28 ambos roles
 * reciben items `solicitud` (el admin: todas las de la plaza con fecha).
 */
const TIPOS = [
  { value: 'evento', label: 'Eventos aprobados', color: '#10b981' },
  { value: 'mantenimiento', label: 'Mantenimientos', color: '#f59e0b' },
  { value: 'hito_contrato', label: 'Hitos contractuales', color: '#8b5cf6' },
  { value: 'solicitud', label: 'Solicitudes', color: '#a78bfa' },
] as const;
type TipoValor = (typeof TIPOS)[number]['value'];
const TIPOS_VALORES: readonly TipoValor[] = TIPOS.map((t) => t.value);

function tipoLabel(tipo: TipoValor, rol: 'admin' | 'inquilino'): string {
  if (tipo === 'solicitud' && rol === 'inquilino') return 'Mis solicitudes';
  return TIPOS.find((t) => t.value === tipo)?.label ?? tipo;
}

/** FullCalendar: horas SIEMPRE en 12h ("2:00 pm"), en la TZ activa del calendario. */
function formatoHoraFc(arg: VerboseFormattingArg): string {
  const ini = hhmm12(arg.start.hour, arg.start.minute);
  if (!arg.end || arg.end.marker.valueOf() === arg.start.marker.valueOf()) return ini;
  return `${ini} – ${hhmm12(arg.end.hour, arg.end.minute)}`;
}
function formatoSlotFc(arg: VerboseFormattingArg): string {
  return hhmm12(arg.date.hour, arg.date.minute);
}

/**
 * Contenido de cada evento: el número de solicitud va SIEMPRE visible y en
 * negrita, antes del título (pedido del cliente 2026-09-28), en todas las vistas.
 */
function renderEvento(arg: EventContentArg) {
  const props = arg.event.extendedProps as CalendarioEventoOutput['extendedProps'];
  const codigo = props.solicitudCodigo;
  const titulo =
    codigo && arg.event.title.startsWith(codigo)
      ? arg.event.title.slice(codigo.length).replace(/^\s*·\s*/, '')
      : arg.event.title;
  return (
    <div className="cal-evt" title={arg.event.title}>
      {arg.timeText && <span className="cal-evt-time">{arg.timeText}</span>}
      {codigo && <strong className="cal-evt-codigo">{codigo}</strong>}
      <span className="cal-evt-title">{titulo}</span>
    </div>
  );
}

export interface OpcionFiltro {
  id: string;
  label: string;
}

interface EventoSeleccionado {
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  props: CalendarioEventoOutput['extendedProps'];
}

/**
 * T-133/T-134: vista FullCalendar (Client Component). Filtros persistidos en
 * la URL, switch de TZ (browser ↔ plaza, vía plugin luxon3), choques con
 * borde rojo, drag-and-drop solo admin, refetch cada 5 min.
 */
export function CalendarioView({
  rol,
  locales,
  inquilinos = [],
  mostrarHitosConfig,
}: {
  rol: 'admin' | 'inquilino';
  locales: OpcionFiltro[];
  inquilinos?: OpcionFiltro[];
  mostrarHitosConfig: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const calendarRef = useRef<FullCalendar>(null);
  const [error, setError] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<EventoSeleccionado | null>(null);
  const [slotNuevo, setSlotNuevo] = useState<{ fecha: string; hora?: string } | null>(null);
  const [slotOcupado, setSlotOcupado] = useState(false);
  /** Panel de filtros desplegado (solo aplica bajo 992 px; ver globals.css). */
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const eventosCache = useRef<CalendarioEventoOutput[]>([]);
  // Vista inicial según ancho (móvil → lista). Calculada solo en cliente para
  // evitar mismatch de hidratación.
  const [vistaInicial] = useState<'dayGridMonth' | 'listWeek'>(() => {
    if (typeof window === 'undefined') return 'dayGridMonth';
    return window.matchMedia('(max-width: 767.98px)').matches ? 'listWeek' : 'dayGridMonth';
  });

  // ── Filtros desde la URL (T-134: compartibles por link) ─────────────────────
  const filtroLocales = useMemo(
    () => (searchParams.get('localId')?.split(',') ?? []).filter(Boolean),
    [searchParams],
  );
  const filtroInquilinos = useMemo(
    () => (searchParams.get('inquilinoId')?.split(',') ?? []).filter(Boolean),
    [searchParams],
  );
  const visibles = TIPOS_VALORES;
  const filtroTipos = useMemo(() => {
    const t = (searchParams.get('tipo')?.split(',') ?? []).filter(Boolean);
    // Si el link compartido trae tipos no visibles para el rol actual, los
    // descartamos silenciosamente (e.g. un admin abriendo ?tipo=solicitud,...).
    const filtrados = t.filter((v): v is TipoValor => visibles.includes(v as TipoValor));
    return filtrados.length ? filtrados : [...visibles];
  }, [searchParams, visibles]);
  const tzPlaza = searchParams.get('tz') === 'plaza';

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const toggleEnLista = (lista: string[], valor: string): string[] =>
    lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];

  // ── Carga de eventos (server action → BFF) ──────────────────────────────────
  const cargarEventos = useCallback(
    async (
      info: { startStr: string; endStr: string },
      success: (events: EventInput[]) => void,
      failure: (error: Error) => void,
    ) => {
      const res = await fetchCalendarioFeedAction({
        from: info.startStr,
        to: info.endStr,
        localId: filtroLocales.length ? filtroLocales : undefined,
        inquilinoId: filtroInquilinos.length ? filtroInquilinos : undefined,
        // Omite el param si están todos los tipos visibles activos (reduce ruido en la URL).
        tipo: filtroTipos.length === visibles.length ? undefined : filtroTipos,
      });
      if (!res.ok) {
        setError(res.error);
        failure(new Error(res.error));
        return;
      }
      setError(null);
      eventosCache.current = res.eventos;
      success(
        res.eventos.map((e) => ({
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end ?? undefined,
          allDay: e.allDay ?? false,
          backgroundColor: e.color,
          // T-131: choque → borde rojo visible
          borderColor: e.extendedProps.choque ? '#dc2626' : e.color,
          classNames: e.extendedProps.choque ? ['evento-choque'] : [],
          // Solo eventos aprobados; los de solicitudes cerradas se ven pero no se mueven.
          editable:
            rol === 'admin' &&
            e.extendedProps.tipo === 'evento' &&
            e.extendedProps.estado !== 'cerrada',
          extendedProps: e.extendedProps,
        })),
      );
    },
    [filtroLocales, filtroInquilinos, filtroTipos, rol, visibles.length],
  );

  // Refetch al cambiar filtros + auto-refresh cada 5 min (T-133).
  useEffect(() => {
    calendarRef.current?.getApi().refetchEvents();
  }, [cargarEventos]);
  useEffect(() => {
    const timer = setInterval(() => calendarRef.current?.getApi().refetchEvents(), 5 * 60_000);
    return () => clearInterval(timer);
  }, []);

  // ── Interacciones ────────────────────────────────────────────────────────────
  const onEventClick = (arg: EventClickArg) => {
    setSeleccionado({
      title: arg.event.title,
      start: arg.event.start?.toISOString() ?? '',
      end: arg.event.end?.toISOString() ?? null,
      allDay: arg.event.allDay,
      props: arg.event.extendedProps as CalendarioEventoOutput['extendedProps'],
    });
  };

  /** T-132: click en slot vacío → modal de nueva solicitud de evento. */
  const onDateClick = (arg: DateClickArg) => {
    if (rol !== 'inquilino') return; // el wizard de solicitudes es del inquilino
    const inicioSlot = arg.date.getTime();
    const finSlot = inicioSlot + (arg.allDay ? 86_400_000 : 3_600_000);
    const ocupado = eventosCache.current.some((e) => {
      if (e.extendedProps.tipo !== 'evento') return false;
      const s = new Date(e.start).getTime();
      const f = e.end ? new Date(e.end).getTime() : s;
      return s < finSlot && inicioSlot < f;
    });
    setSlotOcupado(ocupado);
    setSlotNuevo({
      fecha: arg.dateStr.slice(0, 10),
      hora: arg.allDay ? undefined : arg.dateStr.slice(11, 16),
    });
  };

  /** Drag-and-drop / resize (solo admin): PATCH fechas con revert en error. */
  const onEventoMovido = async (arg: EventDropArg | EventResizeDoneArg) => {
    const id = String(arg.event.id).replace(/^evt-/, '');
    const inicio = arg.event.start?.toISOString();
    const fin = arg.event.end?.toISOString() ?? inicio;
    if (!inicio || !fin) return arg.revert();
    const res = await moverEventoAction(id, inicio, fin);
    if (!res.ok) {
      setError(res.error);
      arg.revert();
    } else {
      calendarRef.current?.getApi().refetchEvents();
    }
  };

  const detalleHref =
    rol === 'inquilino' ? '/inquilino/solicitudes' : '/admin/solicitudes';
  const icsQuery = filtroLocales.length ? `?localId=${filtroLocales.join(',')}` : '';
  /** Nº de filtros activos (chip del botón "Filtros" en pantallas estrechas). */
  const filtrosActivos =
    (filtroTipos.length === visibles.length ? 0 : 1) +
    (filtroLocales.length ? 1 : 0) +
    (filtroInquilinos.length ? 1 : 0);
  const wizardHref = (fecha: string, hora?: string) =>
    `/inquilino/solicitudes/nueva?tipo=evento&fecha=${fecha}${hora ? `&hora=${hora}` : ''}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[230px_1fr] cal-wrap">
      {/* Teléfonos/tablets: los filtros van plegados para que el calendario
          quede a la vista (en escritorio el botón se oculta por CSS). */}
      <button
        type="button"
        className="btn btn-secondary cal-filters-toggle"
        aria-expanded={filtrosAbiertos}
        aria-controls="cal-filtros"
        onClick={() => setFiltrosAbiertos((v) => !v)}
      >
        <SlidersHorizontal />
        {filtrosAbiertos ? 'Ocultar filtros' : 'Filtros'}
        {filtrosActivos > 0 && <span className="cnt">{filtrosActivos}</span>}
      </button>

      {/* ── Panel lateral de filtros (T-134) ── */}
      <aside
        id="cal-filtros"
        className={`card card-pad space-y-4 text-sm cal-filters${filtrosAbiertos ? '' : ' collapsed'}`}
      >
        <div>
          <p className="mb-1 font-medium text-gray-700">Tipo</p>
          {TIPOS.filter((t) => t.value !== 'hito_contrato' || mostrarHitosConfig)
            .filter((t) => visibles.includes(t.value))
            .map((t) => (
              <label key={t.value} className="flex items-center gap-2 py-0.5">
                <input
                  type="checkbox"
                  checked={filtroTipos.includes(t.value)}
                  onChange={() => {
                    const next = toggleEnLista(filtroTipos, t.value);
                    setParam(
                      'tipo',
                      next.length === visibles.length ? null : next.join(','),
                    );
                  }}
                />
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: t.color }}
                />
                {tipoLabel(t.value, rol)}
              </label>
            ))}
        </div>
        <div>
          <p className="mb-1 font-medium text-gray-700">Local</p>
          <div className="max-h-44 space-y-0.5 overflow-y-auto">
            {locales.map((l) => (
              <label key={l.id} className="flex items-center gap-2 py-0.5">
                <input
                  type="checkbox"
                  checked={filtroLocales.includes(l.id)}
                  onChange={() =>
                    setParam('localId', toggleEnLista(filtroLocales, l.id).join(',') || null)
                  }
                />
                {l.label}
              </label>
            ))}
          </div>
        </div>
        {rol === 'admin' && inquilinos.length > 0 && (
          <div>
            <p className="mb-1 font-medium text-gray-700">Inquilino</p>
            <div className="max-h-44 space-y-0.5 overflow-y-auto">
              {inquilinos.map((i) => (
                <label key={i.id} className="flex items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    checked={filtroInquilinos.includes(i.id)}
                    onChange={() =>
                      setParam(
                        'inquilinoId',
                        toggleEnLista(filtroInquilinos, i.id).join(',') || null,
                      )
                    }
                  />
                  {i.label}
                </label>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="mb-1 font-medium text-gray-700">Zona horaria</p>
          <label className="flex items-center gap-2 py-0.5">
            <input type="radio" checked={!tzPlaza} onChange={() => setParam('tz', null)} />
            Mi zona horaria
          </label>
          <label className="flex items-center gap-2 py-0.5">
            <input type="radio" checked={tzPlaza} onChange={() => setParam('tz', 'plaza')} />
            Zona de la plaza (GMT-6)
          </label>
        </div>
        <div className="space-y-2 border-t pt-3">
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href={`/api/calendario/export.ics${icsQuery}`} download>
              Exportar iCal
            </a>
          </Button>
          {rol === 'inquilino' && (
            <Button asChild size="sm" className="w-full">
              <Link href="/inquilino/solicitudes/nueva?tipo=evento">
                Nueva solicitud de evento
              </Link>
            </Button>
          )}
        </div>
      </aside>

      {/* ── Calendario ── */}
      <div className="card card-pad cal-main">
        {error && (
          <p className="banner banner-danger mb-2">
            {error}
          </p>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, luxon3Plugin]}
          initialView={vistaInicial}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          locale={esLocale}
          timeZone={tzPlaza ? TZ_PLAZA : 'local'}
          eventTimeFormat={formatoHoraFc}
          slotLabelFormat={formatoSlotFc}
          eventContent={renderEvento}
          // Bloques de color en la vista mes. En semana/día se limita cuántos
          // eventos solapados se apilan (el resto va a "+N", cuyo popover los
          // lista completos) para que el número de solicitud se lea entero.
          eventDisplay="block"
          views={{ timeGridWeek: { eventMaxStack: 1 }, timeGridDay: { eventMaxStack: 4 } }}
          events={cargarEventos}
          eventClick={onEventClick}
          dateClick={onDateClick}
          editable={rol === 'admin'}
          eventDrop={onEventoMovido}
          eventResize={onEventoMovido}
          height="auto"
          dayMaxEventRows={4}
        />
      </div>

      {/* ── Modal detalle de evento ── */}
      <Dialog open={seleccionado !== null} onOpenChange={(o) => !o && setSeleccionado(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{seleccionado?.title}</DialogTitle>
          </DialogHeader>
          {seleccionado && (
            <div className="space-y-2 text-sm">
              {seleccionado.props.choque && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                  ⚠️ Este evento se solapa con otro en el mismo local.
                </p>
              )}
              {seleccionado.props.solicitudCodigo && (
                <p className="text-gray-700">
                  N.º solicitud:{' '}
                  <strong className="mono">{seleccionado.props.solicitudCodigo}</strong>
                </p>
              )}
              <p className="text-gray-600">{rangoSeleccionado(seleccionado, tzPlaza)}</p>
              {seleccionado.props.localCodigo && (
                <p className="text-gray-600">Local: {seleccionado.props.localCodigo}</p>
              )}
              <p className="text-gray-500">
                Tipo: {tipoLabel(seleccionado.props.tipo, rol)}
              </p>
              {/* Estado de la solicitud (items `solicitud`, eventos aprobados/cerrados
                  y mantenimientos originados por una remodelación). */}
              {seleccionado.props.estado && (
                <div className="flex items-center gap-2 text-gray-600">
                  <span>Estado:</span>
                  <SolicitudEstadoBadge estado={seleccionado.props.estado} />
                </div>
              )}
              {seleccionado.props.solicitudId && (
                <Button asChild size="sm">
                  <Link href={`${detalleHref}/${seleccionado.props.solicitudId}`}>
                    Ver solicitud {seleccionado.props.solicitudCodigo}
                  </Link>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal nueva solicitud desde slot (T-132) ── */}
      <Dialog open={slotNuevo !== null} onOpenChange={(o) => !o && setSlotNuevo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva solicitud de evento en este horario</DialogTitle>
          </DialogHeader>
          {slotNuevo && (
            <div className="space-y-3 text-sm">
              <p className="text-gray-600">
                {slotNuevo.fecha}
                {slotNuevo.hora ? ` a las ${formatHora12(slotNuevo.hora)}` : ''}
              </p>
              {slotOcupado ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  Ya hay un evento aprobado en este horario. Elige otro slot del calendario.
                </p>
              ) : (
                <Button asChild className="w-full">
                  <Link href={wizardHref(slotNuevo.fecha, slotNuevo.hora)}>
                    Crear solicitud de evento
                  </Link>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Rango legible del evento seleccionado en la TZ activa, con horas en 12h. */
function rangoSeleccionado(ev: EventoSeleccionado, tzPlaza: boolean): string {
  const tz = tzPlaza ? TZ_PLAZA : undefined;
  if (ev.allDay) {
    const ini = formatFechaHora12(ev.start, tz, false);
    // FullCalendar: el `end` de un evento de día completo es exclusivo.
    const finIncl = ev.end ? new Date(new Date(ev.end).getTime() - 86_400_000) : null;
    const fin = finIncl ? formatFechaHora12(finIncl, tz, false) : ini;
    return fin === ini ? `${ini} (todo el día)` : `${ini} — ${fin} (todo el día)`;
  }
  const ini = formatFechaHora12(ev.start, tz);
  return ev.end ? `${ini} — ${formatFechaHora12(ev.end, tz)}` : ini;
}
