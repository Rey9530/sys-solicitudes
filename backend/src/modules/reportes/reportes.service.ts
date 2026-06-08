import { Readable } from 'node:stream';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  DashboardChartsOutput,
  KpisOutput,
  ReporteInquilinosFiltros,
  ReporteLocalesFiltros,
  ReporteSolicitudesFiltros,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import { JsreportService } from './jsreport.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

type Db = Prisma.TransactionClient | PrismaAdminService;

/** Límite duro para XLSX/PDF (S-AsyncReport: en v1 se rechaza, no hay cola). */
const MAX_FILAS_REPORTE = 10_000;
/** Rango máximo de la vista rápida (S-Exportación). */
const MAX_RANGO_MESES = 12;
/** Offset fijo de la plaza (T-V08). */
const PLAZA_UTC_OFFSET_MS = 6 * 3_600_000;

interface FilaSolicitud {
  codigo: string;
  tipo: string;
  titulo: string;
  local: string;
  estado: string;
  prioridad: string;
  enviadaAt: string;
  decisionAt: string;
  asignadoA: string;
}
interface FilaLocal {
  codigo: string;
  nombre: string;
  piso: string;
  sector: string;
  metraje: string;
  estado: string;
  inquilino: string;
  contratoVence: string;
}
interface FilaInquilino {
  razonSocial: string;
  identificacion: string;
  contacto: string;
  email: string;
  telefono: string;
  contratosVigentes: number;
  locales: string;
}

/**
 * Módulo 11 — reportes (T-138..T-141). CSV inline (streaming, BOM UTF-8);
 * XLSX/PDF delegados a jsreport (T-136). KPIs del dashboard (T-141).
 *
 * Scope: `admin_plaza` su plaza (withTenant + RLS); `superadmin` agregado
 * global (admin client) en KPIs/charts. Los exports SIEMPRE requieren plaza
 * (un CSV "de todas las plazas" no existe en v1).
 */
@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly jsreport: JsreportService,
  ) {}

  // ── Datos por entidad ────────────────────────────────────────────────────────

  private async datosSolicitudes(db: Db, filtros: ReporteSolicitudesFiltros) {
    const where = this.whereSolicitudes(filtros);
    const rows = await db.solicitud.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: MAX_FILAS_REPORTE + 1,
      include: {
        local: { select: { codigo: true } },
        admin_asignado: { select: { nombre: true } },
      },
    });
    return rows.map(
      (s): FilaSolicitud => ({
        codigo: s.codigo,
        tipo: s.tipo,
        titulo: s.titulo,
        local: s.local.codigo,
        estado: s.estado,
        prioridad: s.prioridad,
        enviadaAt: s.enviada_at?.toISOString().slice(0, 16).replace('T', ' ') ?? '',
        decisionAt: s.decision_at?.toISOString().slice(0, 16).replace('T', ' ') ?? '',
        asignadoA: s.admin_asignado?.nombre ?? '',
      }),
    );
  }

  private whereSolicitudes(filtros: ReporteSolicitudesFiltros): Prisma.solicitudWhereInput {
    const { desde, hasta } = this.rangoValidado(filtros);
    return {
      created_at: { gte: desde, lt: hasta },
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.prioridad ? { prioridad: filtros.prioridad } : {}),
      ...(filtros.localId ? { local_id: filtros.localId } : {}),
      ...(filtros.inquilinoId ? { inquilino_id: filtros.inquilinoId } : {}),
    };
  }

  /** S-Exportación: 12 meses máx; sin fechas → últimos 12 meses. */
  private rangoValidado(f: { fechaDesde?: string; fechaHasta?: string }): {
    desde: Date;
    hasta: Date;
  } {
    const hasta = f.fechaHasta ? new Date(`${f.fechaHasta}T24:00:00.000Z`) : new Date();
    const desde = f.fechaDesde
      ? new Date(`${f.fechaDesde}T00:00:00.000Z`)
      : new Date(hasta.getTime() - 365 * 86_400_000);
    const meses = (hasta.getTime() - desde.getTime()) / (30.44 * 86_400_000);
    if (meses > MAX_RANGO_MESES + 0.5) {
      throw new PayloadTooLargeException({
        code: 'RANGO_EXCEDIDO',
        title: 'Rango demasiado grande',
        message: `El rango máximo de exportación es ${MAX_RANGO_MESES} meses; reduce las fechas.`,
      });
    }
    return { desde, hasta };
  }

  private async datosLocales(db: Db, filtros: ReporteLocalesFiltros) {
    const rows = await db.local.findMany({
      where: { deleted_at: null, ...(filtros.estado ? { estado: filtros.estado } : {}) },
      orderBy: { codigo: 'asc' },
      include: {
        contratos: {
          where: { estado: 'vigente' },
          include: { inquilino: { select: { razon_social: true } } },
          take: 1,
        },
      },
    });
    return rows.map((l): FilaLocal => {
      const vigente = l.contratos[0];
      return {
        codigo: l.codigo,
        nombre: l.nombre ?? '',
        piso: l.piso ?? '',
        sector: l.sector ?? '',
        metraje: l.metraje_m2?.toString() ?? '',
        estado: l.estado,
        inquilino: vigente?.inquilino.razon_social ?? '',
        contratoVence: vigente?.fecha_fin?.toISOString().slice(0, 10) ?? '',
      };
    });
  }

  private async datosInquilinos(db: Db, filtros: ReporteInquilinosFiltros) {
    const rows = await db.inquilino.findMany({
      where: {
        deleted_at: null,
        ...(filtros.search
          ? { razon_social: { contains: filtros.search, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { razon_social: 'asc' },
      include: {
        contratos: {
          where: { estado: 'vigente' },
          include: { local: { select: { codigo: true } } },
        },
      },
    });
    return rows.map(
      (i): FilaInquilino => ({
        razonSocial: i.razon_social,
        identificacion: i.identificacion ?? '',
        contacto: i.contacto_nombre ?? '',
        email: i.contacto_email ?? '',
        telefono: i.contacto_telefono ?? '',
        contratosVigentes: i.contratos.length,
        locales: i.contratos.map((c) => c.local.codigo).join(' | '),
      }),
    );
  }

  private async filasDeEntidad(
    db: Db,
    entidad: 'solicitudes' | 'locales' | 'inquilinos',
    filtros: ReporteSolicitudesFiltros & ReporteLocalesFiltros & ReporteInquilinosFiltros,
  ): Promise<Array<Record<string, unknown>>> {
    if (entidad === 'solicitudes') {
      return (await this.datosSolicitudes(db, filtros)) as unknown as Array<
        Record<string, unknown>
      >;
    }
    if (entidad === 'locales') {
      return (await this.datosLocales(db, filtros)) as unknown as Array<Record<string, unknown>>;
    }
    return (await this.datosInquilinos(db, filtros)) as unknown as Array<Record<string, unknown>>;
  }

  // ── T-138: CSV inline (streaming, BOM) ───────────────────────────────────────

  async exportCsv(
    entidad: 'solicitudes' | 'locales' | 'inquilinos',
    filtros: Record<string, unknown>,
    actor: AuthenticatedUser,
  ): Promise<{ filename: string; stream: Readable }> {
    const plazaId = this.requirePlaza(actor);
    const filas = await this.prisma.withTenant(plazaId, (tx) =>
      this.filasDeEntidad(tx, entidad, filtros as never),
    );
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    function* generar(): Generator<string> {
      yield '﻿'; // BOM UTF-8 (Excel)
      if (filas.length === 0) return;
      const headers = Object.keys(filas[0] as object);
      yield `${headers.map(escaparCsv).join(',')}\r\n`;
      for (const fila of filas) {
        yield `${headers
          .map((h) => escaparCsv(String((fila as Record<string, unknown>)[h] ?? '')))
          .join(',')}\r\n`;
      }
    }
    return { filename: `${entidad}-${fecha}.csv`, stream: Readable.from(generar()) };
  }

  // ── T-139/T-140: XLSX y PDF vía jsreport ─────────────────────────────────────

  async exportJsreport(
    entidad: 'solicitudes' | 'locales' | 'inquilinos',
    formato: 'xlsx' | 'pdf',
    filtros: Record<string, unknown>,
    actor: AuthenticatedUser,
  ): Promise<{ filename: string; buffer: Buffer; contentType: string }> {
    const plazaId = this.requirePlaza(actor);
    const { plaza, filas } = await this.prisma.withTenant(plazaId, async (tx) => ({
      plaza: await this.plazaBranding(tx, plazaId),
      filas: await this.filasDeEntidad(tx, entidad, filtros as never),
    }));
    if (filas.length > MAX_FILAS_REPORTE) {
      // S-AsyncReport: en v1 sin job asíncrono — se rechaza con sugerencia.
      throw new PayloadTooLargeException({
        code: 'REPORTE_DEMASIADO_GRANDE',
        title: 'Reporte demasiado grande',
        message: `El reporte supera ${MAX_FILAS_REPORTE.toLocaleString()} filas; reduce el rango de fechas o aplica más filtros.`,
      });
    }
    const payload = {
      plaza,
      generadoEl: this.fechaLegibleSv(),
      total: filas.length,
      rango: this.describirRango(filtros),
      items: filas,
    };
    const key = `${entidad}-${formato}`;
    const buffer =
      formato === 'pdf'
        ? await this.jsreport.renderPdf(key, payload)
        : await this.jsreport.renderXlsx(key, payload);
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return {
      filename: `${entidad}-${fecha}.${formato}`,
      buffer,
      contentType:
        formato === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /** T-140: PDF de detalle de un local (ficha + contratos + solicitudes). */
  async exportLocalDetallePdf(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const plazaId = this.requirePlaza(actor);
    const data = await this.prisma.withTenant(plazaId, async (tx) => {
      const local = await tx.local.findFirst({
        where: { id, deleted_at: null },
        include: {
          contratos: {
            orderBy: { fecha_inicio: 'desc' },
            include: { inquilino: { select: { razon_social: true } } },
          },
          solicitudes: { orderBy: { created_at: 'desc' }, take: 50 },
        },
      });
      if (!local) {
        throw new NotFoundException({
          code: 'LOCAL_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'El local no existe en esta plaza.',
        });
      }
      return {
        plaza: await this.plazaBranding(tx, plazaId),
        generadoEl: this.fechaLegibleSv(),
        local: {
          codigo: local.codigo,
          nombre: local.nombre ?? '',
          piso: local.piso ?? '',
          sector: local.sector ?? '',
          metraje: local.metraje_m2?.toString() ?? '',
          estado: local.estado,
        },
        contratos: local.contratos.map((c) => ({
          inquilino: c.inquilino.razon_social,
          fechaInicio: c.fecha_inicio?.toISOString().slice(0, 10) ?? '',
          fechaFin: c.fecha_fin?.toISOString().slice(0, 10) ?? 'Indefinido',
          monto: c.monto_mensual ? `${c.moneda} ${c.monto_mensual}` : '',
          estado: c.estado,
        })),
        solicitudes: local.solicitudes.map((s) => ({
          codigo: s.codigo,
          tipo: s.tipo,
          titulo: s.titulo,
          estado: s.estado,
          enviadaAt: s.enviada_at?.toISOString().slice(0, 10) ?? '',
        })),
      };
    });
    const buffer = await this.jsreport.renderPdf('local-detalle-pdf', data);
    return { filename: `local-${data.local.codigo}.pdf`, buffer };
  }

  /** T-140: PDF de detalle de un inquilino. */
  async exportInquilinoDetallePdf(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const plazaId = this.requirePlaza(actor);
    const data = await this.prisma.withTenant(plazaId, async (tx) => {
      const inquilino = await tx.inquilino.findFirst({
        where: { id, deleted_at: null },
        include: {
          contratos: {
            orderBy: { fecha_inicio: 'desc' },
            include: { local: { select: { codigo: true } } },
          },
          solicitudes: {
            orderBy: { created_at: 'desc' },
            take: 50,
            include: { local: { select: { codigo: true } } },
          },
        },
      });
      if (!inquilino) {
        throw new NotFoundException({
          code: 'INQUILINO_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'El inquilino no existe en esta plaza.',
        });
      }
      return {
        plaza: await this.plazaBranding(tx, plazaId),
        generadoEl: this.fechaLegibleSv(),
        inquilino: {
          razonSocial: inquilino.razon_social,
          identificacion: inquilino.identificacion ?? '',
          contacto: inquilino.contacto_nombre ?? '',
          email: inquilino.contacto_email ?? '',
          telefono: inquilino.contacto_telefono ?? '',
          direccion: inquilino.direccion ?? '',
        },
        contratos: inquilino.contratos.map((c) => ({
          local: c.local.codigo,
          fechaInicio: c.fecha_inicio?.toISOString().slice(0, 10) ?? '',
          fechaFin: c.fecha_fin?.toISOString().slice(0, 10) ?? 'Indefinido',
          monto: c.monto_mensual ? `${c.moneda} ${c.monto_mensual}` : '',
          estado: c.estado,
        })),
        solicitudes: inquilino.solicitudes.map((s) => ({
          codigo: s.codigo,
          tipo: s.tipo,
          titulo: s.titulo,
          local: s.local.codigo,
          estado: s.estado,
          enviadaAt: s.enviada_at?.toISOString().slice(0, 10) ?? '',
        })),
      };
    });
    const buffer = await this.jsreport.renderPdf('inquilino-detalle-pdf', data);
    return { filename: `inquilino-${id.slice(0, 8)}.pdf`, buffer };
  }

  /** T-144: primeros 10 registros para la previsualización (sin descarga). */
  async preview(
    entidad: 'solicitudes' | 'locales' | 'inquilinos',
    filtros: Record<string, unknown>,
    actor: AuthenticatedUser,
  ): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const plazaId = this.requirePlaza(actor);
    const filas = await this.prisma.withTenant(plazaId, (tx) =>
      this.filasDeEntidad(tx, entidad, filtros as never),
    );
    return { items: filas.slice(0, 10), total: filas.length };
  }

  // ── T-141: KPIs ──────────────────────────────────────────────────────────────

  async kpis(actor: AuthenticatedUser): Promise<KpisOutput> {
    // superadmin SIN plaza elegida → dashboard global (agregado de todas las
    // plazas). Con plaza elegida (impersonación), cae al scope por RLS.
    if (actor.rol === 'superadmin' && !actor.plazaId) {
      return this.calcularKpis(this.prismaAdmin);
    }
    const plazaId = this.requirePlaza(actor);
    return this.prisma.withTenant(plazaId, (tx) => this.calcularKpis(tx));
  }

  /** Cálculo de KPIs sobre un client ya scoped (tx con RLS o admin global). */
  async calcularKpis(db: Db): Promise<KpisOutput> {
    const inicioHoy = this.inicioDelDiaSvEnUtc();
    const ahora = new Date();
    const en7d = new Date(ahora.getTime() + 7 * 86_400_000);
    const en30d = new Date(ahora.getTime() + 30 * 86_400_000);

    const [
      pendientes,
      aprobadasHoy,
      rechazadasHoy,
      eventosProximos7d,
      contratosPorVencer30d,
      aprobadasTotal,
      rechazadasTotal,
      subsanadas,
      top5,
      promedio,
    ] = await Promise.all([
      db.solicitud.count({
        where: { estado: { in: ['enviada', 'asignado', 'en_revision', 'requerida_subsanacion'] } },
      }),
      db.solicitud.count({ where: { estado: 'aprobada', decision_at: { gte: inicioHoy } } }),
      db.solicitud.count({ where: { estado: 'rechazada', decision_at: { gte: inicioHoy } } }),
      db.evento_calendario.count({
        where: { deleted_at: null, inicio: { gte: ahora, lte: en7d } },
      }),
      db.contrato.count({
        where: { estado: 'vigente', fecha_fin: { not: null, gte: ahora, lte: en30d } },
      }),
      db.solicitud.count({ where: { estado: 'aprobada' } }),
      db.solicitud.count({ where: { estado: 'rechazada' } }),
      db.solicitud_historial.findMany({
        where: { evento: 'subsanada' },
        distinct: ['solicitud_id'],
        select: { solicitud_id: true },
      }),
      db.solicitud.findMany({
        where: {
          estado: { in: ['enviada', 'asignado', 'en_revision', 'requerida_subsanacion'] },
          enviada_at: { not: null },
        },
        orderBy: { enviada_at: 'asc' },
        take: 5,
        select: { id: true, codigo: true, titulo: true, enviada_at: true },
      }),
      // Tiempo medio de respuesta: AVG(decision_at - enviada_at) en horas.
      db.$queryRaw<Array<{ horas: number | null }>>`
        SELECT EXTRACT(EPOCH FROM AVG(decision_at - enviada_at)) / 3600 AS horas
        FROM solicitud WHERE decision_at IS NOT NULL AND enviada_at IS NOT NULL`,
    ]);

    const decididas = aprobadasTotal + rechazadasTotal;
    return {
      pendientes,
      aprobadasHoy,
      rechazadasHoy,
      eventosProximos7d,
      contratosPorVencer30d,
      tasaAprobacion: decididas > 0 ? Number((aprobadasTotal / decididas).toFixed(2)) : null,
      tiempoMedioRespuestaHoras:
        promedio[0]?.horas != null ? Number(Number(promedio[0].horas).toFixed(1)) : null,
      solicitudesConSubsanacion: subsanadas.length,
      top5Antiguedad: top5.map((s) => ({
        id: s.id,
        codigo: s.codigo,
        titulo: s.titulo,
        enviadaAt: s.enviada_at?.toISOString() ?? '',
      })),
    };
  }

  // ── T-143: datos de gráficos del dashboard ───────────────────────────────────

  async dashboardCharts(actor: AuthenticatedUser): Promise<DashboardChartsOutput> {
    if (actor.rol === 'superadmin' && !actor.plazaId) {
      return this.calcularCharts(this.prismaAdmin);
    }
    const plazaId = this.requirePlaza(actor);
    return this.prisma.withTenant(plazaId, (tx) => this.calcularCharts(tx));
  }

  private async calcularCharts(db: Db): Promise<DashboardChartsOutput> {
    const hace6m = new Date();
    hace6m.setUTCMonth(hace6m.getUTCMonth() - 5);
    hace6m.setUTCDate(1);
    hace6m.setUTCHours(0, 0, 0, 0);

    const mensual = await db.$queryRaw<Array<{ mes: string; estado: string; total: bigint }>>`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes, estado::text, COUNT(*) AS total
      FROM solicitud WHERE created_at >= ${hace6m}
      GROUP BY 1, 2 ORDER BY 1`;

    const porMes = new Map<string, Record<string, number | string>>();
    for (const r of mensual) {
      const fila = porMes.get(r.mes) ?? { mes: r.mes };
      fila[r.estado] = Number(r.total);
      porMes.set(r.mes, fila);
    }

    const [porTipo, porPrioridad, actividad] = await Promise.all([
      db.solicitud.groupBy({ by: ['tipo'], _count: { _all: true } }),
      db.solicitud.groupBy({ by: ['prioridad'], _count: { _all: true } }),
      db.solicitud_historial.findMany({
        orderBy: { created_at: 'desc' },
        take: 10,
        include: {
          solicitud: { select: { id: true, codigo: true } },
          usuario: { select: { nombre: true } },
        },
      }),
    ]);

    return {
      tendenciaMensual: [...porMes.values()] as DashboardChartsOutput['tendenciaMensual'],
      porTipo: porTipo.map((t) => ({ tipo: t.tipo, total: t._count._all })),
      porPrioridad: porPrioridad.map((p) => ({ prioridad: p.prioridad, total: p._count._all })),
      actividadReciente: actividad.map((a) => ({
        id: a.id,
        solicitudId: a.solicitud.id,
        solicitudCodigo: a.solicitud.codigo,
        evento: a.evento,
        usuario: a.usuario?.nombre ?? null,
        createdAt: a.created_at.toISOString(),
      })),
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async plazaBranding(
    db: Db,
    plazaId: string,
  ): Promise<{ nombreComercial: string; logoUrl: string | null; colorPrimario: string }> {
    const plaza = await db.plaza.findUnique({
      where: { id: plazaId },
      select: { nombre_comercial: true, logo_url: true, color_primario: true },
    });
    return {
      nombreComercial: plaza?.nombre_comercial ?? 'Plazapp',
      logoUrl: plaza?.logo_url ?? null,
      colorPrimario: plaza?.color_primario ?? '#2563eb',
    };
  }

  private describirRango(filtros: Record<string, unknown>): string | null {
    const desde = typeof filtros.fechaDesde === 'string' ? filtros.fechaDesde : null;
    const hasta = typeof filtros.fechaHasta === 'string' ? filtros.fechaHasta : null;
    if (!desde && !hasta) return null;
    return `${desde ?? '…'} → ${hasta ?? 'hoy'}`;
  }

  private fechaLegibleSv(): string {
    return new Date(Date.now() - PLAZA_UTC_OFFSET_MS).toISOString().slice(0, 16).replace('T', ' ');
  }

  /** Instante UTC en que empieza el día actual de El Salvador. */
  private inicioDelDiaSvEnUtc(): Date {
    const ahoraSv = new Date(Date.now() - PLAZA_UTC_OFFSET_MS);
    return new Date(
      Date.UTC(ahoraSv.getUTCFullYear(), ahoraSv.getUTCMonth(), ahoraSv.getUTCDate()) +
        PLAZA_UTC_OFFSET_MS,
    );
  }

  private requirePlaza(actor: AuthenticatedUser): string {
    if (!actor.plazaId) {
      throw new ForbiddenException({
        code: 'PLAZA_SCOPE_VIOLATION',
        title: 'Acceso denegado',
        message: 'Los reportes exportables son por plaza; superadmin solo accede a los KPIs.',
      });
    }
    return actor.plazaId;
  }
}

/** Escape CSV RFC 4180: comillas dobles + envolver si hay coma/quote/salto. */
function escaparCsv(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
