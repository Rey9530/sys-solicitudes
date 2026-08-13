import { Readable } from 'node:stream';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Prisma, solicitud_estado } from '@prisma/client';
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
/** Plazo de validez del "Permiso de Trabajos" (T-V21+). Hardcoded 30 días;
 *  futuro: mover a `configuracion.plazo_permisos_dias` por plaza. */
const PLAZO_PERMISO_DIAS = 30;
/** Campos de `campos_extra` que ya se imprimen en su propia sección del PDF
 *  (asistentes, datos del subcontratista, etc.) y por tanto se filtran del
 *  listado genérico para no duplicar la información. */
const CAMPOS_EXTRA_FILTRADOS_PARA_PDF = new Set<string>([
  'asistentes',
  'asistentes_estimados',
  'empresa_constructora',
  'requiere_aprobacion_especial',
]);

/**
 * Estados que cuentan como "aprobada" en los KPIs (T-091e-cerrar). Una
 * solicitud cerrada fue aprobada antes: si solo contáramos `aprobada` la
 * tasa de aprobación se desplomaría a medida que se cierran solicitudes.
 */
const APROBADAS: solicitud_estado[] = ['aprobada', 'cerrada'];

/** Etiquetas de estado para el PDF "Permiso de Trabajos". */const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  asignado: 'Asignada',
  en_revision: 'En revisión',
  requerida_subsanacion: 'Requiere subsanación',
  pausada: 'Pausada',
  aprobada: 'Aprobada',
  cerrada: 'Cerrada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};
/** Clase CSS del badge de estado (verde aprobada / rojo terminal negativo / neutro). */
const ESTADO_CLASE: Record<string, string> = {
  aprobada: '',
  cerrada: '',
  rechazada: 'rojo',
  cancelada: 'rojo',
};
const MESES_ABREV = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
/** Etiquetas legibles de campos_extra (espejo de solicitud-detail-inquilino.tsx).
 *  T-V21: quitados categoria_libre/descripcion_larga (interpretación B);
 *  agregado `asistentes` (lista de nombres) para el reporte. */
const CAMPOS_EXTRA_LABEL: Record<string, string> = {
  area_afectada: 'Área afectada',
  requiere_ingreso_a_local: 'Requiere ingreso al local',
  asistentes_estimados: 'Asistentes estimados',
  asistentes: 'Asistentes',
  fecha_inicio_estimada: 'Fecha de inicio estimada',
  duracion_dias: 'Duración (días)',
  empresa_constructora: 'Empresa constructora',
  monto_presupuesto: 'Monto presupuesto',
};

/** Formatea un valor de campos_extra para el PDF (booleanos → Sí/No). */
function formatCampoExtra(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  return String(v ?? 'n/a');
}

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
  modulo: string;
  nivel: string;
  area: string;
  medidorEnergia: string;
  medidorAgua: string;
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
        modulo: l.modulo ?? '',
        nivel: l.nivel ?? '',
        area: l.area_m2?.toString() ?? '',
        medidorEnergia: l.medidor_energia ?? '',
        medidorAgua: l.medidor_agua ?? '',
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
        contacto: i.contacto1_nombre ?? '',
        email: i.contacto1_email ?? '',
        telefono: i.contacto1_telefono ?? '',
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
          modulo: local.modulo ?? '',
          nivel: local.nivel ?? '',
          area: local.area_m2?.toString() ?? '',
          medidorEnergia: local.medidor_energia ?? '',
          medidorAgua: local.medidor_agua ?? '',
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
          contacto: inquilino.contacto1_nombre ?? '',
          email: inquilino.contacto1_email ?? '',
          telefono: inquilino.contacto1_telefono ?? '',
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

  /**
   * PDF "Permiso de Trabajos" de una sola solicitud (formato del cliente).
   * Accesible por admin_plaza/superadmin de la plaza e inquilino DUEÑO de la
   * solicitud (scope replicado de SolicitudesService.assertInquilinoScope).
   *
   * Datos que se imprimen:
   *  - Identificación: código, título, tipo, prioridad, estado, descripción,
   *    fechas (enviada, decisión, evento).
   *  - Solicitante: nombre, email, teléfono.
   *  - Cliente (inquilino): razón social, NIT, contacto, dirección.
   *  - Local: código, nombre, piso, sector, m², estado.
   *  - Contrato vigente: ID, fechas, monto, moneda.
   *  - Asistentes (T-V21): tabla nombre+documento.
   *  - Adjuntos vivos: nombre, MIME, tamaño.
   *  - Historial del flujo + comentarios (trazabilidad).
   *  - Autorizante: admin asignado + email + teléfono.
   *  - Cláusula de compromiso (literales A-G del cliente) + placeholders para
   *    firma física del solicitante y del responsable de obra.
   *
   *  Marca de agua según estado: APROBADO (verde) / BORRADOR (gris) /
   *  PENDIENTE (ámbar) / RECHAZADO/CANCELADA (rojo).
   *  Plazo de validez del permiso: `decision_at + PLAZO_PERMISO_DIAS` si la
   *  solicitud está aprobada; en otro caso `n/a` (placeholder).
   *
   *  NOTA: `adjuntos` (polimórfico) y `contrato` (relación local↔inquilino,
   *  no solicitud) se consultan por separado porque Prisma no tiene esas
   *  relaciones desde `solicitud`.
   */
  async exportSolicitudPermisoPdf(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const plazaId = this.requirePlaza(actor);
    const data = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await tx.solicitud.findFirst({
        where: { id },
        include: {
          local: {
            select: {
              codigo: true,
              modulo: true,
              nivel: true,
              area_m2: true,
              medidor_energia: true,
              medidor_agua: true,
              estado: true,
            },
          },
          inquilino: {
            select: {
              razon_social: true,
              identificacion: true,
              direccion: true,
              contacto1_nombre: true,
              contacto1_email: true,
              contacto1_telefono: true,
            },
          },
          categoria: { select: { nombre: true } },
          subcategoria: { select: { nombre: true, prioridad: true } },
          usuario_creador: {
            select: { nombre: true, email: true, telefono: true },
          },
          admin_asignado: {
            select: { nombre: true, email: true, telefono: true },
          },
          comentarios: {
            orderBy: { created_at: 'asc' },
            include: { usuario: { select: { nombre: true } } },
          },
          historial: {
            orderBy: { created_at: 'asc' },
            include: { usuario: { select: { nombre: true } } },
          },
        },
      });
      if (!solicitud) {
        throw new NotFoundException({
          code: 'SOLICITUD_NOT_FOUND',
          title: 'Recurso no encontrado',
          message: 'La solicitud no existe.',
        });
      }
      // Scope inquilino: solo el dueño puede generar su permiso.
      if (actor.rol === 'inquilino' && solicitud.inquilino_id !== actor.inquilinoId) {
        throw new NotFoundException({
          code: 'SOLICITUD_NOT_FOUND',
          title: 'Recurso no encontrado',
          message: 'La solicitud no existe.',
        });
      }

      // Adjuntos (polimórfico): consulta aparte.
      const adjuntos = await tx.adjunto.findMany({
        where: { entidad_tipo: 'solicitud', entidad_id: id, deleted_at: null },
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          nombre_original: true,
          mime_type: true,
          tamano_bytes: true,
          created_at: true,
        },
      });

      // Contrato vigente del (local, inquilino) de la solicitud.
      const contrato = await tx.contrato.findFirst({
        where: {
          local_id: solicitud.local_id,
          inquilino_id: solicitud.inquilino_id,
          estado: 'vigente',
        },
        orderBy: { fecha_inicio: 'desc' },
        select: {
          id: true,
          fecha_inicio: true,
          fecha_fin: true,
          monto_mensual: true,
          moneda: true,
          condiciones: true,
        },
      });

      const camposExtra = (solicitud.campos_extra ?? {}) as Record<string, unknown>;
      const empresa =
        typeof camposExtra.empresa_constructora === 'string'
          ? camposExtra.empresa_constructora
          : null;
      const esAprobada = solicitud.estado === 'aprobada';
      const fechaExpiracion =
        esAprobada && solicitud.decision_at
          ? this.fechaPermiso(
              new Date(solicitud.decision_at.getTime() + PLAZO_PERMISO_DIAS * 86_400_000),
            )
          : 'n/a';

      // Asistentes (T-V21) — derivado de campos_extra; el wizard garantiza
      // la coherencia N↔lista.
      const asistentesRaw = Array.isArray(camposExtra.asistentes)
        ? (camposExtra.asistentes as Array<{ nombre?: string; documento?: string }>)
        : [];
      const asistentesEstimados = Number(camposExtra.asistentes_estimados ?? 0);
      const asistentes = asistentesRaw.map((a, i) => ({
        n: i + 1,
        nombre: a.nombre ?? '',
        documento: a.documento ?? '',
      }));

      // Marca de agua según estado.
      const marcaAgua = this.marcaAguaParaEstado(solicitud.estado);

      return {
        plaza: await this.plazaBranding(tx, plazaId),
        generadoEl: this.fechaPermiso(new Date()),
        codigo: solicitud.codigo,
        titulo: solicitud.titulo,
        tipo: solicitud.tipo,
        prioridad: solicitud.prioridad,
        estado: solicitud.estado,
        estadoLabel: ESTADO_LABEL[solicitud.estado] ?? solicitud.estado,
        estadoClase: ESTADO_CLASE[solicitud.estado] ?? 'neutro',
        marcaAgua,
        descripcion: solicitud.descripcion,
        fechaSolicitud: this.fechaPermiso(solicitud.enviada_at ?? solicitud.created_at),
        fechaCreacion: this.fechaPermiso(solicitud.created_at),
        fechaAsignada: solicitud.asignada_at ? this.fechaPermiso(solicitud.asignada_at) : 'n/a',
        fechaDecision: solicitud.decision_at ? this.fechaPermiso(solicitud.decision_at) : 'n/a',
        fechaExpiracion,
        plazoPermisoDias: esAprobada ? PLAZO_PERMISO_DIAS : null,
        fechaEventoInicio: solicitud.fecha_evento_inicio
          ? this.fechaIso(solicitud.fecha_evento_inicio)
          : null,
        fechaEventoFin: solicitud.fecha_evento_fin
          ? this.fechaIso(solicitud.fecha_evento_fin)
          : null,
        horaInicio: solicitud.hora_inicio ?? null,
        horaFin: solicitud.hora_fin ?? null,
        requiereAprobacionEspecial: Boolean(camposExtra.requiere_aprobacion_especial),

        // Solicitante (usuario que creó la solicitud).
        solicitante: {
          nombre: solicitud.usuario_creador?.nombre ?? 'n/a',
          email: solicitud.usuario_creador?.email ?? 'n/a',
          telefono: solicitud.usuario_creador?.telefono ?? 'n/a',
        },
        // Cliente (inquilino).
        cliente: {
          razonSocial: solicitud.inquilino?.razon_social ?? 'n/a',
          identificacion: solicitud.inquilino?.identificacion ?? 'n/a',
          direccion: solicitud.inquilino?.direccion ?? 'n/a',
          contacto1Nombre: solicitud.inquilino?.contacto1_nombre ?? 'n/a',
          contacto1Email: solicitud.inquilino?.contacto1_email ?? 'n/a',
          contacto1Telefono: solicitud.inquilino?.contacto1_telefono ?? 'n/a',
        },
        // Local.
        local: {
          codigo: solicitud.local?.codigo ?? 'n/a',
          modulo: solicitud.local?.modulo ?? 'n/a',
          nivel: solicitud.local?.nivel ?? 'n/a',
          area: solicitud.local?.area_m2
            ? `${solicitud.local.area_m2.toString()} m²`
            : 'n/a',
          medidorEnergia: solicitud.local?.medidor_energia ?? 'n/a',
          medidorAgua: solicitud.local?.medidor_agua ?? 'n/a',
          estado: solicitud.local?.estado ?? 'n/a',
        },
        // Contrato vigente.
        contrato: contrato
          ? {
              id: contrato.id,
              fechaInicio: this.fechaIso(contrato.fecha_inicio),
              fechaFin: contrato.fecha_fin ? this.fechaIso(contrato.fecha_fin) : 'Indefinido',
              monto: contrato.monto_mensual
                ? `${contrato.monto_mensual.toString()} ${contrato.moneda}`
                : 'n/a',
              condiciones: contrato.condiciones ?? 'n/a',
            }
          : null,
        // Categoría + subcategoría.
        categoria: solicitud.categoria?.nombre ?? 'n/a',
        subcategoria: solicitud.subcategoria?.nombre ?? 'n/a',
        subcategoriaPrioridad: solicitud.subcategoria?.prioridad ?? null,

        // Asistentes (T-V21).
        asistentesEstimados,
        asistentes,

        // Adjuntos vivos.
        adjuntos: adjuntos.map((a) => ({
          nombre: a.nombre_original,
          mime: a.mime_type,
          tamano: `${(a.tamano_bytes / 1024).toFixed(1)} KB`,
          fecha: this.fechaIso(a.created_at),
        })),

        // Historial del flujo.
        historial: solicitud.historial.map((h) => ({
          evento: h.evento,
          estadoAnterior: h.estado_anterior,
          estadoNuevo: h.estado_nuevo,
          usuario: h.usuario?.nombre ?? 'Sistema',
          fecha: this.fechaPermiso(h.created_at),
          comentario: h.comentario ?? null,
        })),

        // Comentarios.
        comentarios: solicitud.comentarios.map((c) => ({
          cuerpo: c.cuerpo,
          tipo: c.tipo,
          usuario: c.usuario?.nombre ?? 'Sistema',
          fecha: this.fechaPermiso(c.created_at),
        })),

        // Campos extra relevantes (filtramos los ya modelados arriba).
        camposExtra: Object.entries(camposExtra)
          .filter(([k]) => !CAMPOS_EXTRA_FILTRADOS_PARA_PDF.has(k))
          .map(([k, v]) => ({ label: CAMPOS_EXTRA_LABEL[k] ?? k, valor: formatCampoExtra(v) })),

        // Subcontratista (placeholder si la solicitud no lo modela).
        autorizamosA: empresa ?? 'n/a',

        // Personal (placeholders — el cliente los rellena a mano).
        personal: { nombre1: '', documento1: '', nombre2: '', documento2: '' },

        // Bloque de remodelación (placeholders para firma/sello del responsable).
        remodelacion: { responsable: '', sello: '', firma: '' },

        // Subcontratista (placeholders por ahora; ver T-V21+).
        subcontratista: {
          contacto: '',
          telefono: '',
          equipos: '',
          escalera: '',
          otro: '',
        },

        // Autorizante (admin asignado).
        autorizante: {
          nombre: solicitud.admin_asignado?.nombre ?? 'n/a',
          email: solicitud.admin_asignado?.email ?? 'n/a',
          telefono: solicitud.admin_asignado?.telefono ?? 'n/a',
        },
      };
    });
    const buffer = await this.jsreport.renderPdf('solicitud-permiso-pdf', data);
    return { filename: `permiso-${data.codigo}.pdf`, buffer };
  }

  /** Marca de agua para el PDF según estado (T-V21+: visual). */
  private marcaAguaParaEstado(estado: string): {
    texto: string;
    clase: 'ok' | 'warn' | 'danger' | 'neutral';
  } {
    switch (estado) {
      case 'aprobada':
        return { texto: 'APROBADO', clase: 'ok' };
      // T-091e-cerrar: la actividad se ejecutó y se dio por finalizada.
      case 'cerrada':
        return { texto: 'CERRADO', clase: 'ok' };
      case 'rechazada':
      case 'cancelada':
        return { texto: estado.toUpperCase(), clase: 'danger' };
      case 'borrador':
        return { texto: 'BORRADOR', clase: 'neutral' };
      default:
        return { texto: 'PENDIENTE', clase: 'warn' };
    }
  }

    /** Fecha estilo formato del cliente: "28/Dec/2024 10:00:00" en TZ de la plaza. */
    private fechaPermiso(date: Date | null): string {
      if (!date) return 'n/a';
      const d = new Date(date.getTime() - PLAZA_UTC_OFFSET_MS);
      const dia = String(d.getUTCDate()).padStart(2, '0');
      const mes = MESES_ABREV[d.getUTCMonth()];
      const anio = d.getUTCFullYear();
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const mm = String(d.getUTCMinutes()).padStart(2, '0');
      const ss = String(d.getUTCSeconds()).padStart(2, '0');
      return `${dia}/${mes}/${anio} ${hh}:${mm}:${ss}`;
    }

    /** Fecha ISO corta para tablas y secciones: "2026-12-15". */
    private fechaIso(date: Date | null | undefined): string {
      if (!date) return 'n/a';
      const d = new Date(date.getTime() - PLAZA_UTC_OFFSET_MS);
      const dia = String(d.getUTCDate()).padStart(2, '0');
      const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
      const anio = d.getUTCFullYear();
      return `${anio}-${mes}-${dia}`;
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
      db.solicitud.count({
        where: { estado: { in: APROBADAS }, decision_at: { gte: inicioHoy } },
      }),
      db.solicitud.count({ where: { estado: 'rechazada', decision_at: { gte: inicioHoy } } }),
      db.evento_calendario.count({
        where: { deleted_at: null, inicio: { gte: ahora, lte: en7d } },
      }),
      db.contrato.count({
        where: { estado: 'vigente', fecha_fin: { not: null, gte: ahora, lte: en30d } },
      }),
      db.solicitud.count({ where: { estado: { in: APROBADAS } } }),
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
