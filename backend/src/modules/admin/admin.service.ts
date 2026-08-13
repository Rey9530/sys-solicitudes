import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { Prisma } from '@prisma/client';
import type {
  ListSolicitudesPlataformaQuery,
  PaginatedSolicitudesPlataforma,
  PlazaRef,
  SolicitudDetailOutput,
  SolicitudPlataformaListItem,
} from '@app/contracts';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  SOLICITUD_INCLUDE,
  comentarioToOutput,
  historialToOutput,
  solicitudToListItem,
  type SolicitudConRelaciones,
} from '../solicitudes/solicitud.mapper';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Tope duro del CSV plataforma. Una exportación más grande devuelve error. */
const MAX_FILAS_EXPORT_PLATAFORMA = 10_000;

/**
 * T-V25 · Endpoints cross-plataforma del `superadmin` (solo lectura, SC-5).
 *
 * Esta clase es la ÚNICA consumidora del `PrismaAdminService` para listar
 * solicitudes: usa bypass RLS para ver todas las plazas simultáneamente. La
 * autorización fina la enforce el controller con `@Roles('superadmin')`.
 *
 * El `actor.plazaId` se IGNORA deliberadamente: aunque el frontend envíe el
 * header `x-plaza-id` (impersonación), este servicio siempre devuelve datos
 * cross-plaza. Esa es la diferencia con `SolicitudesService.findAll` que
 * filtra por la plaza del JWT.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ── Listado cross-plaza ──────────────────────────────────────────────────────

  async findAllSolicitudes(
    query: ListSolicitudesPlataformaQuery,
    actor: AuthenticatedUser,
  ): Promise<PaginatedSolicitudesPlataforma> {
    this.assertSuperadmin(actor);

    const { page, pageSize } = query;
    const where = this.buildWhere(query);

    const [items, total] = await Promise.all([
      this.prismaAdmin.solicitud.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
        include: { ...SOLICITUD_INCLUDE, plaza: { select: PLAZA_SELECT } },
      }),
      this.prismaAdmin.solicitud.count({ where }),
    ]);

    const result: Paginated<SolicitudPlataformaListItem> = {
      items: items.map((s) => this.toPlataformaListItem(s)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };

    // Auditoría best-effort: nunca debe tumbar el listado.
    await this.auditoria.record({
      accion: 'admin.solicitudes.list',
      entidadTipo: 'solicitud',
      plazaId: null,
      usuarioId: actor.sub,
      despues: { filtros: this.filtrosParaAuditoria(query), total },
    });

    return result;
  }

  // ── Detalle cross-plaza ──────────────────────────────────────────────────────

  async findOneSolicitud(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<SolicitudDetailOutput & { plaza: PlazaRef }> {
    this.assertSuperadmin(actor);

    const solicitud = await this.prismaAdmin.solicitud.findFirst({
      where: { id },
      include: { ...SOLICITUD_INCLUDE, plaza: { select: PLAZA_SELECT } },
    });
    if (!solicitud) this.throwNotFound();

    const [adjuntos, comentarios, historial] = await Promise.all([
      this.prismaAdmin.adjunto.findMany({
        where: { entidad_tipo: 'solicitud', entidad_id: id, deleted_at: null },
        orderBy: { created_at: 'desc' },
      }),
      this.prismaAdmin.comentario.findMany({
        where: { solicitud_id: id },
        orderBy: { created_at: 'asc' },
        include: { usuario: { select: { id: true, nombre: true, email: true } } },
      }),
      this.prismaAdmin.solicitud_historial.findMany({
        where: { solicitud_id: id },
        orderBy: { created_at: 'asc' },
        include: { usuario: { select: { id: true, nombre: true, email: true } } },
      }),
    ]);

    await this.auditoria.record({
      accion: 'admin.solicitudes.detail',
      entidadTipo: 'solicitud',
      entidadId: id,
      plazaId: null,
      usuarioId: actor.sub,
    });

    const s = solicitud as SolicitudConRelaciones & {
      plaza?: { id: string; slug: string; nombre_comercial: string } | null;
    };
    const base = solicitudToListItem(s);
    return {
      ...base,
      inquilinoRazonSocial: s.inquilino?.razon_social ?? null,
      usuarioCreador: s.usuario_creador
        ? {
            id: s.usuario_creador.id,
            nombre: s.usuario_creador.nombre,
            email: s.usuario_creador.email,
          }
        : null,
      adjuntos: adjuntos.map((a) => ({
        id: a.id,
        plazaId: a.plaza_id,
        entidadTipo: a.entidad_tipo,
        entidadId: a.entidad_id,
        nombreOriginal: a.nombre_original,
        mimeType: a.mime_type,
        tamanoBytes: a.tamano_bytes,
        usuarioSubioId: a.usuario_subio_id,
        createdAt: a.created_at.toISOString(),
      })),
      comentarios: comentarios.map(comentarioToOutput),
      historial: historial.map(historialToOutput),
      plaza: s.plaza
        ? { id: s.plaza.id, slug: s.plaza.slug, nombreComercial: s.plaza.nombre_comercial }
        : { id: s.plaza_id, slug: '', nombreComercial: '' },
    };
  }

  // ── Export CSV (T-V25) ───────────────────────────────────────────────────────

  /**
   * Devuelve un stream de texto CSV (con BOM UTF-8) y el filename sugerido.
   * El caller (controller) lo expone como `text/csv; charset=utf-8`.
   *
   * Cap: 10.000 filas + 1 sentinel (mismo patrón que
   * `ReportesService.datosSolicitudes`). Si supera, lanza 422 `EXPORT_TOO_LARGE`
   * para que el FE muestre "refina los filtros".
   */
  async exportSolicitudesCsv(
    query: ListSolicitudesPlataformaQuery,
    actor: AuthenticatedUser,
  ): Promise<{ filename: string; stream: Readable; total: number; truncated: boolean }> {
    this.assertSuperadmin(actor);

    const where = this.buildWhere(query);
    const rows = await this.prismaAdmin.solicitud.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: MAX_FILAS_EXPORT_PLATAFORMA + 1,
      include: {
        local: { select: { codigo: true } },
        plaza: { select: { nombre_comercial: true } },
      },
    });

    const truncated = rows.length > MAX_FILAS_EXPORT_PLATAFORMA;
    const visibles = truncated ? rows.slice(0, MAX_FILAS_EXPORT_PLATAFORMA) : rows;

    await this.auditoria.record({
      accion: 'admin.solicitudes.export_csv',
      entidadTipo: 'solicitud',
      plazaId: null,
      usuarioId: actor.sub,
      despues: {
        filtros: this.filtrosParaAuditoria(query),
        total: visibles.length,
        truncado: truncated,
      },
    });

    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    function* generar(): Generator<string> {
      yield '﻿'; // BOM UTF-8 (Excel)
      const headers = [
        'codigo',
        'plaza',
        'local',
        'tipo',
        'estado',
        'prioridad',
        'titulo',
        'created_at',
      ] as const;
      yield `${headers.map(escaparCsv).join(',')}\r\n`;
      for (const r of visibles) {
        const fila = [
          r.codigo,
          r.plaza?.nombre_comercial ?? '',
          r.local?.codigo ?? '',
          r.tipo,
          r.estado,
          r.prioridad,
          r.titulo,
          r.created_at.toISOString(),
        ];
        yield `${fila.map((v) => escaparCsv(String(v))).join(',')}\r\n`;
      }
    }

    return {
      filename: `solicitudes-plataforma-${fecha}.csv`,
      stream: Readable.from(generar()),
      total: visibles.length,
      truncated,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** Defensa en profundidad: además del `@Roles('superadmin')` del controller. */
  private assertSuperadmin(actor: AuthenticatedUser): void {
    if (actor.rol !== 'superadmin') {
      throw new ForbiddenException({
        code: 'ADMIN_PLATFORM_ONLY',
        title: 'Acceso denegado',
        message: 'Este endpoint es exclusivo del superadmin.',
      });
    }
  }

  /**
   * `where` compartido por listado, detalle (no) y export. Mismos campos que
   * `SolicitudesService.findAll` + `plaza_id` cuando viene y `search` como OR
   * case-insensitive sobre campos visibles.
   */
  private buildWhere(query: ListSolicitudesPlataformaQuery): Prisma.solicitudWhereInput {
    const {
      plazaId,
      estado,
      tipo,
      categoriaId,
      subcategoriaId,
      prioridad,
      fechaDesde,
      fechaHasta,
      search,
    } = query;
    return {
      ...(plazaId ? { plaza_id: plazaId } : {}),
      ...(estado ? { estado } : {}),
      ...(tipo ? { tipo } : {}),
      ...(categoriaId ? { categoria_id: categoriaId } : {}),
      ...(subcategoriaId ? { subcategoria_id: subcategoriaId } : {}),
      ...(prioridad ? { prioridad } : {}),
      ...(fechaDesde || fechaHasta
        ? {
            created_at: {
              ...(fechaDesde ? { gte: new Date(`${fechaDesde}T00:00:00.000Z`) } : {}),
              ...(fechaHasta ? { lte: new Date(`${fechaHasta}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { codigo: { contains: search, mode: 'insensitive' } },
              { titulo: { contains: search, mode: 'insensitive' } },
              { local: { codigo: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private filtrosParaAuditoria(q: ListSolicitudesPlataformaQuery): Record<string, unknown> {
    // Proyección segura para guardar en `meta`: omite `page`/`pageSize` (ruido).
    const { page, pageSize, sort, ...rest } = q;
    void page;
    void pageSize;
    void sort;
    return rest;
  }

  private toPlataformaListItem(
    s: SolicitudConRelaciones & {
      plaza?: { id: string; slug: string; nombre_comercial: string } | null;
    },
  ): SolicitudPlataformaListItem {
    return {
      ...solicitudToListItem(s),
      plaza: s.plaza
        ? { id: s.plaza.id, slug: s.plaza.slug, nombreComercial: s.plaza.nombre_comercial }
        : null,
    };
  }

  private throwNotFound(): never {
    throw new NotFoundException({
      code: 'SOLICITUD_NOT_FOUND',
      title: 'Recurso no encontrado',
      message: 'La solicitud no existe.',
    });
  }
}

const PLAZA_SELECT = { id: true, slug: true, nombre_comercial: true } as const;

/** Escape CSV RFC 4180 (mismo helper que `ReportesService`). */
function escaparCsv(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
