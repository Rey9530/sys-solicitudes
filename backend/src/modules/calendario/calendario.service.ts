import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import type {
  CalendarioEventoOutput,
  CalendarioQuery,
  ChoqueOutput,
  ChoquesQuery,
  IcsQuery,
  MoverEventoFechas,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/** Colores por tipo (T-133); `evento` usa el color de la fila. */
const COLOR_MANTENIMIENTO = '#f59e0b';
const COLOR_HITO_CONTRATO = '#8b5cf6';

/** Offset fijo de la plaza (T-V08: America/El_Salvador, UTC-6 sin DST). */
const PLAZA_UTC_OFFSET_MS = 6 * 3_600_000;

/**
 * Módulo 10 — feed del calendario (T-129), export iCal (T-130), choques
 * (T-131) y drag-and-drop del admin (decisión owner 2026-06-07).
 *
 * Scope por rol: `inquilino` solo ve eventos/mantenimientos/hitos de SUS
 * locales y contratos; `admin_plaza` ve toda la plaza. Todo corre bajo
 * `withTenant` (RLS segunda capa).
 */
@Injectable()
export class CalendarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
  ) {}

  // ── T-129: feed FullCalendar ─────────────────────────────────────────────────

  async feed(query: CalendarioQuery, actor: AuthenticatedUser): Promise<CalendarioEventoOutput[]> {
    const plazaId = this.requirePlaza(actor);
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (to <= from) {
      throw new BadRequestException({
        code: 'RANGO_INVALIDO',
        title: 'Solicitud inválida',
        message: '`to` debe ser posterior a `from`.',
      });
    }
    const tipos = query.tipo ?? ['evento', 'mantenimiento', 'hito_contrato'];
    const inquilinoScope = actor.rol === 'inquilino' ? this.requireInquilino(actor) : null;

    return this.prisma.withTenant(plazaId, async (tx) => {
      const items: CalendarioEventoOutput[] = [];

      if (tipos.includes('evento')) {
        items.push(...(await this.eventosAprobados(tx, query, from, to, inquilinoScope)));
      }
      if (tipos.includes('mantenimiento')) {
        items.push(...(await this.mantenimientos(tx, query, from, to, inquilinoScope)));
      }
      if (tipos.includes('hito_contrato')) {
        const config = await tx.configuracion.findUnique({ where: { plaza_id: plazaId } });
        if (config?.calendar_mostrar_hitos_contrato) {
          items.push(...(await this.hitosContractuales(tx, query, from, to, inquilinoScope)));
        }
      }

      this.marcarChoques(items);
      return items;
    });
  }

  /** Eventos aprobados (evento_calendario vivo) con join a solicitud. */
  private async eventosAprobados(
    tx: Prisma.TransactionClient,
    query: Pick<CalendarioQuery, 'localId' | 'inquilinoId'>,
    from: Date,
    to: Date,
    inquilinoScope: string | null,
  ): Promise<CalendarioEventoOutput[]> {
    const eventos = await tx.evento_calendario.findMany({
      where: {
        deleted_at: null,
        inicio: { lt: to },
        fin: { gt: from },
        solicitud: {
          ...(inquilinoScope ? { inquilino_id: inquilinoScope } : {}),
          ...(query.inquilinoId?.length ? { inquilino_id: { in: query.inquilinoId } } : {}),
          ...(query.localId?.length ? { local_id: { in: query.localId } } : {}),
        },
      },
      include: {
        solicitud: {
          select: {
            id: true,
            codigo: true,
            local_id: true,
            inquilino_id: true,
            local: { select: { codigo: true } },
          },
        },
      },
      orderBy: { inicio: 'asc' },
    });
    return eventos.map((e) => ({
      id: `evt-${e.id}`,
      title: e.titulo,
      start: e.inicio.toISOString(),
      end: e.fin.toISOString(),
      color: e.color,
      extendedProps: {
        tipo: 'evento' as const,
        solicitudId: e.solicitud.id,
        solicitudCodigo: e.solicitud.codigo,
        localId: e.solicitud.local_id,
        localCodigo: e.solicitud.local.codigo,
        inquilinoId: e.solicitud.inquilino_id,
      },
    }));
  }

  /** Locales en mantenimiento con ventana programada (T-103). */
  private async mantenimientos(
    tx: Prisma.TransactionClient,
    query: Pick<CalendarioQuery, 'localId'>,
    from: Date,
    to: Date,
    inquilinoScope: string | null,
  ): Promise<CalendarioEventoOutput[]> {
    const locales = await tx.local.findMany({
      where: {
        estado: 'en_mantenimiento',
        deleted_at: null,
        fecha_inicio_mantenimiento: { not: null, lt: to },
        fecha_fin_mantenimiento: { not: null, gt: from },
        ...(query.localId?.length ? { id: { in: query.localId } } : {}),
        ...(inquilinoScope
          ? { contratos: { some: { inquilino_id: inquilinoScope, estado: 'vigente' } } }
          : {}),
      },
      select: {
        id: true,
        codigo: true,
        fecha_inicio_mantenimiento: true,
        fecha_fin_mantenimiento: true,
      },
    });
    return locales.map((l) => ({
      id: `mnt-${l.id}`,
      title: `Mantenimiento · ${l.codigo}`,
      start: this.soloFecha(l.fecha_inicio_mantenimiento as Date),
      end: this.soloFecha(l.fecha_fin_mantenimiento as Date),
      color: COLOR_MANTENIMIENTO,
      allDay: true,
      extendedProps: { tipo: 'mantenimiento' as const, localId: l.id, localCodigo: l.codigo },
    }));
  }

  /** Contratos por vencer en los próximos 30 días (RN del feed, T-129). */
  private async hitosContractuales(
    tx: Prisma.TransactionClient,
    query: Pick<CalendarioQuery, 'localId' | 'inquilinoId'>,
    from: Date,
    to: Date,
    inquilinoScope: string | null,
  ): Promise<CalendarioEventoOutput[]> {
    const hoy = new Date();
    const limite30d = new Date(hoy.getTime() + 30 * 86_400_000);
    const desde = from > hoy ? from : hoy;
    const hasta = to < limite30d ? to : limite30d;
    if (hasta <= desde) return [];

    const contratos = await tx.contrato.findMany({
      where: {
        estado: 'vigente',
        fecha_fin: { not: null, gte: desde, lte: hasta },
        ...(inquilinoScope ? { inquilino_id: inquilinoScope } : {}),
        ...(query.inquilinoId?.length ? { inquilino_id: { in: query.inquilinoId } } : {}),
        ...(query.localId?.length ? { local_id: { in: query.localId } } : {}),
      },
      include: {
        local: { select: { codigo: true } },
        inquilino: { select: { razon_social: true } },
      },
    });
    return contratos.map((c) => ({
      id: `cto-${c.id}`,
      title: `Vence contrato · ${c.local.codigo} (${c.inquilino.razon_social})`,
      start: this.soloFecha(c.fecha_fin as Date),
      end: null,
      color: COLOR_HITO_CONTRATO,
      allDay: true,
      extendedProps: {
        tipo: 'hito_contrato' as const,
        contratoId: c.id,
        localId: c.local_id,
        localCodigo: c.local.codigo,
        inquilinoId: c.inquilino_id,
      },
    }));
  }

  /** T-131 (en feed): marca `choque` en eventos del mismo local que se solapan. */
  private marcarChoques(items: CalendarioEventoOutput[]): void {
    const eventos = items.filter((i) => i.extendedProps.tipo === 'evento');
    for (let i = 0; i < eventos.length; i++) {
      for (let j = i + 1; j < eventos.length; j++) {
        const a = eventos[i];
        const b = eventos[j];
        if (!a || !b || a.extendedProps.localId !== b.extendedProps.localId) continue;
        if (this.seSolapan(a, b)) {
          a.extendedProps.choque = true;
          b.extendedProps.choque = true;
        }
      }
    }
  }

  // ── T-131: endpoint de choques ───────────────────────────────────────────────

  async choques(query: ChoquesQuery, actor: AuthenticatedUser): Promise<ChoqueOutput[]> {
    const plazaId = this.requirePlaza(actor);
    const from = new Date(query.from);
    const to = new Date(query.to);
    const inquilinoScope = actor.rol === 'inquilino' ? this.requireInquilino(actor) : null;

    return this.prisma.withTenant(plazaId, async (tx) => {
      const eventos = await this.eventosAprobados(
        tx,
        { localId: query.localId },
        from,
        to,
        inquilinoScope,
      );
      const pares: ChoqueOutput[] = [];
      for (let i = 0; i < eventos.length; i++) {
        for (let j = i + 1; j < eventos.length; j++) {
          const a = eventos[i];
          const b = eventos[j];
          if (!a || !b || a.extendedProps.localId !== b.extendedProps.localId) continue;
          if (this.seSolapan(a, b)) {
            pares.push({
              localId: a.extendedProps.localId as string,
              localCodigo: a.extendedProps.localCodigo ?? null,
              eventoAId: a.id,
              eventoBId: b.id,
            });
          }
        }
      }
      return pares;
    });
  }

  // ── T-130: export iCal (RFC 5545, generado inline sin librería) ─────────────

  async exportIcs(
    query: IcsQuery,
    actor: AuthenticatedUser,
  ): Promise<{ filename: string; contenido: string }> {
    const plazaId = this.requirePlaza(actor);
    const inquilinoScope = actor.rol === 'inquilino' ? this.requireInquilino(actor) : null;
    const frontendUrl = this.config
      .get<string>('FRONTEND_URL', 'http://localhost:3000')
      .replace(/\/$/, '');

    const { plaza, eventos } = await this.prisma.withTenant(plazaId, async (tx) => {
      const plaza = await tx.plaza.findUniqueOrThrow({
        where: { id: plazaId },
        select: { slug: true, nombre_comercial: true, email_contacto: true },
      });
      const eventos = await tx.evento_calendario.findMany({
        where: {
          deleted_at: null,
          solicitud: {
            ...(inquilinoScope ? { inquilino_id: inquilinoScope } : {}),
            ...(query.localId?.length ? { local_id: { in: query.localId } } : {}),
          },
        },
        include: {
          solicitud: {
            select: { id: true, codigo: true, local: { select: { codigo: true } } },
          },
        },
        orderBy: { inicio: 'asc' },
      });
      return { plaza, eventos };
    });

    const ahora = this.icsFecha(new Date());
    const rutaDetalle = actor.rol === 'inquilino' ? '/inquilino/solicitudes' : '/admin/solicitudes';
    const lineas: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Plazapp//Calendario//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${this.icsEscape(`Plazapp · ${plaza.nombre_comercial}`)}`,
    ];
    for (const e of eventos) {
      lineas.push(
        'BEGIN:VEVENT',
        `UID:evt-${e.id}@plazapp`,
        `DTSTAMP:${ahora}`,
        `DTSTART:${this.icsFecha(e.inicio)}`,
        `DTEND:${this.icsFecha(e.fin)}`,
        `SUMMARY:${this.icsEscape(e.titulo)}`,
        `DESCRIPTION:${this.icsEscape(`Solicitud ${e.solicitud.codigo}: ${frontendUrl}${rutaDetalle}/${e.solicitud.id}`)}`,
        `LOCATION:${this.icsEscape(e.solicitud.local.codigo)}`,
        `ORGANIZER;CN=${this.icsEscape(plaza.nombre_comercial)}:mailto:${plaza.email_contacto ?? 'noreply@plazapp.com'}`,
        'END:VEVENT',
      );
    }
    lineas.push('END:VCALENDAR');

    // RFC 5545: CRLF y folding a 75 octetos.
    const contenido = lineas.map((l) => this.icsFold(l)).join('\r\n') + '\r\n';
    return { filename: `plazapp-${plaza.slug}.ics`, contenido };
  }

  // ── Drag-and-drop del admin (M10-b) ──────────────────────────────────────────

  /**
   * Mueve un evento aprobado (decisión owner 2026-06-07): actualiza
   * `evento_calendario` y las fechas/horas de la solicitud SIN tocar el
   * estado, y deja rastro en historial + auditoría.
   */
  async moverEvento(
    eventoId: string,
    dto: MoverEventoFechas,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<CalendarioEventoOutput> {
    if (actor.rol === 'inquilino') {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        title: 'Acceso denegado',
        message: 'Solo un administrador puede mover eventos del calendario.',
      });
    }
    const plazaId = this.requirePlaza(actor);
    const inicio = new Date(dto.inicio);
    const fin = new Date(dto.fin);

    const actualizado = await this.prisma.withTenant(plazaId, async (tx) => {
      const evento = await tx.evento_calendario.findFirst({
        where: { id: eventoId, deleted_at: null },
        include: { solicitud: { select: { id: true, codigo: true, estado: true } } },
      });
      if (!evento) {
        throw new NotFoundException({
          code: 'EVENTO_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'El evento de calendario no existe en esta plaza.',
        });
      }
      const updated = await tx.evento_calendario.update({
        where: { id: eventoId },
        data: { inicio, fin },
        include: {
          solicitud: {
            select: {
              id: true,
              codigo: true,
              local_id: true,
              inquilino_id: true,
              local: { select: { codigo: true } },
            },
          },
        },
      });
      // Mantener la solicitud consistente (fecha civil + hora de la plaza).
      await tx.solicitud.update({
        where: { id: evento.solicitud.id },
        data: {
          fecha_evento_inicio: this.fechaCivilPlaza(inicio),
          fecha_evento_fin: this.fechaCivilPlaza(fin),
          hora_inicio: this.horaPlaza(inicio),
          hora_fin: this.horaPlaza(fin),
        },
      });
      await tx.solicitud_historial.create({
        data: {
          plaza_id: plazaId,
          solicitud_id: evento.solicitud.id,
          usuario_id: actor.sub,
          evento: 'comentario',
          comentario: `Evento movido en el calendario: ${inicio.toISOString()} → ${fin.toISOString()}`,
        },
      });
      return updated;
    });

    await this.auditoria.record({
      accion: 'calendario.mover_evento',
      entidadTipo: 'evento_calendario',
      entidadId: eventoId,
      plazaId,
      usuarioId: actor.sub,
      despues: { inicio: inicio.toISOString(), fin: fin.toISOString() },
      ...meta,
    });

    return {
      id: `evt-${actualizado.id}`,
      title: actualizado.titulo,
      start: actualizado.inicio.toISOString(),
      end: actualizado.fin.toISOString(),
      color: actualizado.color,
      extendedProps: {
        tipo: 'evento',
        solicitudId: actualizado.solicitud.id,
        solicitudCodigo: actualizado.solicitud.codigo,
        localId: actualizado.solicitud.local_id,
        localCodigo: actualizado.solicitud.local.codigo,
        inquilinoId: actualizado.solicitud.inquilino_id,
      },
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private seSolapan(a: CalendarioEventoOutput, b: CalendarioEventoOutput): boolean {
    const aStart = new Date(a.start).getTime();
    const aEnd = a.end ? new Date(a.end).getTime() : aStart;
    const bStart = new Date(b.start).getTime();
    const bEnd = b.end ? new Date(b.end).getTime() : bStart;
    return aStart < bEnd && bStart < aEnd; // [inicio, fin) intersectan
  }

  /** Fecha civil YYYY-MM-DD (las columnas DATE vienen a medianoche UTC). */
  private soloFecha(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /** Fecha civil de la plaza (UTC-6 fija) como Date a medianoche UTC. */
  private fechaCivilPlaza(instante: Date): Date {
    const enPlaza = new Date(instante.getTime() - PLAZA_UTC_OFFSET_MS);
    return new Date(
      Date.UTC(enPlaza.getUTCFullYear(), enPlaza.getUTCMonth(), enPlaza.getUTCDate()),
    );
  }

  /** "HH:MM" en hora de la plaza (UTC-6 fija). */
  private horaPlaza(instante: Date): string {
    const enPlaza = new Date(instante.getTime() - PLAZA_UTC_OFFSET_MS);
    return enPlaza.toISOString().slice(11, 16);
  }

  /** Fecha-hora UTC en formato iCal básico: 20261201T180000Z. */
  private icsFecha(d: Date): string {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  /** Escape RFC 5545: backslash, salto de línea, coma y punto y coma. */
  private icsEscape(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
  }

  /** Folding a 75 octetos (continuación con espacio inicial, RFC 5545 §3.1). */
  private icsFold(linea: string): string {
    const bytes = Buffer.from(linea, 'utf8');
    if (bytes.length <= 75) return linea;
    const partes: string[] = [];
    let resto = linea;
    let primera = true;
    while (Buffer.byteLength(resto, 'utf8') > (primera ? 75 : 74)) {
      const max = primera ? 75 : 74;
      let corte = max;
      while (corte > 0 && Buffer.byteLength(resto.slice(0, corte), 'utf8') > max) corte--;
      partes.push((primera ? '' : ' ') + resto.slice(0, corte));
      resto = resto.slice(corte);
      primera = false;
    }
    partes.push(' ' + resto);
    return partes.join('\r\n');
  }

  private requirePlaza(actor: AuthenticatedUser): string {
    if (!actor.plazaId) {
      throw new ForbiddenException({
        code: 'PLAZA_SCOPE_VIOLATION',
        title: 'Acceso denegado',
        message: 'El calendario requiere un usuario con plaza asignada.',
      });
    }
    return actor.plazaId;
  }

  private requireInquilino(actor: AuthenticatedUser): string {
    if (!actor.inquilinoId) {
      throw new ForbiddenException({
        code: 'INQUILINO_SCOPE_VIOLATION',
        title: 'Acceso denegado',
        message: 'El usuario inquilino no tiene inquilino asociado.',
      });
    }
    return actor.inquilinoId;
  }
}
