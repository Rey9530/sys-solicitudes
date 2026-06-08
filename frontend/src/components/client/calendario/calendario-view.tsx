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
import type { EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import Link from 'next/link';
import type { CalendarioEventoOutput } from '@app/contracts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { fetchCalendarioFeedAction, moverEventoAction } from '@/app/calendario-actions';

const TZ_PLAZA = 'America/El_Salvador';
const TIPOS = [
  { value: 'evento', label: 'Eventos', color: '#10b981' },
  { value: 'mantenimiento', label: 'Mantenimientos', color: '#f59e0b' },
  { value: 'hito_contrato', label: 'Hitos contractuales', color: '#8b5cf6' },
] as const;

export interface OpcionFiltro {
  id: string;
  label: string;
}

interface EventoSeleccionado {
  title: string;
  start: string;
  end: string | null;
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
  const eventosCache = useRef<CalendarioEventoOutput[]>([]);

  // ── Filtros desde la URL (T-134: compartibles por link) ─────────────────────
  const filtroLocales = useMemo(
    () => (searchParams.get('localId')?.split(',') ?? []).filter(Boolean),
    [searchParams],
  );
  const filtroInquilinos = useMemo(
    () => (searchParams.get('inquilinoId')?.split(',') ?? []).filter(Boolean),
    [searchParams],
  );
  const filtroTipos = useMemo(() => {
    const t = (searchParams.get('tipo')?.split(',') ?? []).filter(Boolean);
    return t.length ? t : TIPOS.map((x) => x.value as string);
  }, [searchParams]);
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
        tipo: filtroTipos.length === TIPOS.length ? undefined : filtroTipos,
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
          editable: rol === 'admin' && e.extendedProps.tipo === 'evento',
          extendedProps: e.extendedProps,
        })),
      );
    },
    [filtroLocales, filtroInquilinos, filtroTipos, rol],
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
  const wizardHref = (fecha: string, hora?: string) =>
    `/inquilino/solicitudes/nueva?tipo=evento&fecha=${fecha}${hora ? `&hora=${hora}` : ''}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[230px_1fr]">
      {/* ── Panel lateral de filtros (T-134) ── */}
      <aside className="card card-pad space-y-4 text-sm">
        <div>
          <p className="mb-1 font-medium text-gray-700">Tipo</p>
          {TIPOS.filter((t) => t.value !== 'hito_contrato' || mostrarHitosConfig).map((t) => (
            <label key={t.value} className="flex items-center gap-2 py-0.5">
              <input
                type="checkbox"
                checked={filtroTipos.includes(t.value)}
                onChange={() => {
                  const next = toggleEnLista(filtroTipos, t.value);
                  setParam('tipo', next.length === TIPOS.length ? null : next.join(','));
                }}
              />
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: t.color }}
              />
              {t.label}
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
      <div className="card card-pad">
        {error && (
          <p className="banner banner-danger mb-2">
            {error}
          </p>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, luxon3Plugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          locale={esLocale}
          timeZone={tzPlaza ? TZ_PLAZA : 'local'}
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
              <p className="text-gray-600">
                {new Date(seleccionado.start).toLocaleString('es-SV')}
                {seleccionado.end ? ` — ${new Date(seleccionado.end).toLocaleString('es-SV')}` : ''}
              </p>
              {seleccionado.props.localCodigo && (
                <p className="text-gray-600">Local: {seleccionado.props.localCodigo}</p>
              )}
              <p className="text-gray-500">
                Tipo: {TIPOS.find((t) => t.value === seleccionado.props.tipo)?.label}
              </p>
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
                {slotNuevo.hora ? ` a las ${slotNuevo.hora}` : ''}
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
