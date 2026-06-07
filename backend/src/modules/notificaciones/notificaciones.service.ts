import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma, email_log, unsubscribe } from '@prisma/client';
import type {
  EmailLogOutput,
  EmailLogPreview,
  ListEmailLogQuery,
  ListUnsubscribesQuery,
  UnsubscribeOutput,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { TemplateRendererService } from './template-renderer.service';
import { UnsubscribeService } from './unsubscribe.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Log de emails + reintento manual + desuscripciones (T-127, CU-NE-6).
 *
 * Scope: `admin_plaza` ve SOLO su plaza (withTenant + RLS); `superadmin` ve
 * todas (admin client, bypass RLS documentado en T-038).
 */
@Injectable()
export class NotificacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly auditoria: AuditoriaService,
    private readonly renderer: TemplateRendererService,
    private readonly unsubscribeService: UnsubscribeService,
    private readonly config: ConfigService,
  ) {}

  // ── Log de emails ────────────────────────────────────────────────────────────

  async findAll(
    query: ListEmailLogQuery,
    actor: AuthenticatedUser,
  ): Promise<Paginated<EmailLogOutput>> {
    const { page, pageSize } = query;
    const where = this.buildWhere(query);

    const { items, total } =
      actor.rol === 'superadmin'
        ? await this.queryLog(this.prismaAdmin, where, page, pageSize)
        : await this.prisma.withTenant(this.requirePlaza(actor), (tx) =>
            this.queryLog(tx, where, page, pageSize),
          );

    return {
      items: items.map((e) => this.toOutput(e)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Reintento manual de un email `fallido`: resetea reintentos y lo deja
   * `pendiente` con `next_retry_at = now()` para el próximo tick del worker.
   * `reset-password` no es reintentable (sus variables van redactadas: el
   * token de reset nunca se persiste — ver bitácora T-126).
   */
  async reintentar(
    id: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<EmailLogOutput> {
    const email = await this.findScoped(id, actor);
    if (email.estado !== 'fallido') {
      throw new BadRequestException({
        code: 'EMAIL_NO_REINTENTABLE',
        title: 'Solicitud inválida',
        message: `Solo los emails en estado "fallido" admiten reintento (actual: "${email.estado}").`,
      });
    }
    if (email.plantilla === 'reset-password') {
      throw new BadRequestException({
        code: 'EMAIL_NO_REINTENTABLE',
        title: 'Solicitud inválida',
        message:
          'Los emails de reset de contraseña no se reintentan (el enlace no se persiste); el usuario debe solicitar uno nuevo.',
      });
    }

    const actualizar = (db: Prisma.TransactionClient | PrismaAdminService) =>
      db.email_log.update({
        where: { id },
        data: { estado: 'pendiente', reintentos: 0, next_retry_at: new Date() },
      });
    const updated =
      actor.rol === 'superadmin'
        ? await actualizar(this.prismaAdmin)
        : await this.prisma.withTenant(this.requirePlaza(actor), (tx) => actualizar(tx));

    await this.auditoria.record({
      accion: 'email_log.reintentar',
      entidadTipo: 'email_log',
      entidadId: id,
      plazaId: email.plaza_id,
      usuarioId: actor.sub,
      antes: { estado: email.estado, reintentos: email.reintentos },
      despues: { estado: updated.estado, reintentos: updated.reintentos },
      ...meta,
    });
    return this.toOutput(updated);
  }

  /** "Ver contenido": re-render del HTML con las variables persistidas. */
  async preview(id: string, actor: AuthenticatedUser): Promise<EmailLogPreview> {
    const email = await this.findScoped(id, actor);
    const plaza = await this.prismaAdmin.plaza.findUnique({
      where: { id: email.plaza_id },
      select: { nombre_comercial: true, logo_url: true, color_primario: true },
    });
    const appUrl = this.config
      .get<string>('FRONTEND_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
    return this.renderer.render(email.plantilla, {
      ...((email.variables ?? {}) as Record<string, unknown>),
      plaza: {
        nombreComercial: plaza?.nombre_comercial ?? 'Plazapp',
        logoUrl: plaza?.logo_url ?? null,
        colorPrimario: plaza?.color_primario ?? '#2563eb',
      },
      appUrl,
      unsubscribeUrl: this.unsubscribeService.generarUrl(
        email.plaza_id,
        email.destinatario,
        email.plantilla,
      ),
    });
  }

  // ── Desuscripciones (T-125: ver y resetear) ──────────────────────────────────

  async listUnsubscribes(
    query: ListUnsubscribesQuery,
    actor: AuthenticatedUser,
  ): Promise<Paginated<UnsubscribeOutput>> {
    const { page, pageSize } = query;
    const where: Prisma.unsubscribeWhereInput = query.email
      ? { email: { contains: query.email, mode: 'insensitive' } }
      : {};

    const consultar = async (db: Prisma.TransactionClient | PrismaAdminService) => {
      const [items, total] = await Promise.all([
        db.unsubscribe.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { created_at: 'desc' },
        }),
        db.unsubscribe.count({ where }),
      ]);
      return { items, total };
    };
    const { items, total } =
      actor.rol === 'superadmin'
        ? await consultar(this.prismaAdmin)
        : await this.prisma.withTenant(this.requirePlaza(actor), (tx) => consultar(tx));

    return {
      items: items.map((u: unsubscribe) => ({
        id: u.id,
        plazaId: u.plaza_id,
        email: u.email,
        plantilla: u.plantilla,
        createdAt: u.created_at.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /** Resetea una desuscripción (el usuario vuelve a recibir esa plantilla). */
  async deleteUnsubscribe(
    id: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<void> {
    const eliminar = async (db: Prisma.TransactionClient | PrismaAdminService) => {
      const row = await db.unsubscribe.findFirst({ where: { id } });
      if (!row) {
        throw new NotFoundException({
          code: 'UNSUBSCRIBE_NO_ENCONTRADO',
          title: 'Recurso no encontrado',
          message: 'La desuscripción no existe en esta plaza.',
        });
      }
      await db.unsubscribe.delete({ where: { id } });
      return row;
    };
    const row =
      actor.rol === 'superadmin'
        ? await eliminar(this.prismaAdmin)
        : await this.prisma.withTenant(this.requirePlaza(actor), (tx) => eliminar(tx));

    await this.auditoria.record({
      accion: 'unsubscribe.reset',
      entidadTipo: 'unsubscribe',
      entidadId: id,
      plazaId: row.plaza_id,
      usuarioId: actor.sub,
      antes: { email: row.email, plantilla: row.plantilla },
      ...meta,
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async queryLog(
    db: Prisma.TransactionClient | PrismaAdminService,
    where: Prisma.email_logWhereInput,
    page: number,
    pageSize: number,
  ): Promise<{ items: email_log[]; total: number }> {
    const [items, total] = await Promise.all([
      db.email_log.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { created_at: 'desc' },
      }),
      db.email_log.count({ where }),
    ]);
    return { items, total };
  }

  private buildWhere(query: ListEmailLogQuery): Prisma.email_logWhereInput {
    const createdAt: Prisma.DateTimeFilter = {};
    if (query.fechaDesde) createdAt.gte = new Date(`${query.fechaDesde}T00:00:00.000Z`);
    if (query.fechaHasta) createdAt.lt = new Date(`${query.fechaHasta}T24:00:00.000Z`);
    return {
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.plantilla ? { plantilla: { contains: query.plantilla, mode: 'insensitive' } } : {}),
      ...(query.destinatario
        ? { destinatario: { contains: query.destinatario, mode: 'insensitive' } }
        : {}),
      ...(query.fechaDesde || query.fechaHasta ? { created_at: createdAt } : {}),
    };
  }

  private async findScoped(id: string, actor: AuthenticatedUser): Promise<email_log> {
    const email =
      actor.rol === 'superadmin'
        ? await this.prismaAdmin.email_log.findFirst({ where: { id } })
        : await this.prisma.withTenant(this.requirePlaza(actor), (tx) =>
            tx.email_log.findFirst({ where: { id } }),
          );
    if (!email) {
      throw new NotFoundException({
        code: 'EMAIL_LOG_NO_ENCONTRADO',
        title: 'Recurso no encontrado',
        message: 'El registro de email no existe en esta plaza.',
      });
    }
    return email;
  }

  private requirePlaza(actor: AuthenticatedUser): string {
    if (!actor.plazaId) {
      throw new BadRequestException({
        code: 'PLAZA_SCOPE_VIOLATION',
        title: 'Solicitud inválida',
        message: 'Esta operación requiere un usuario con plaza asignada.',
      });
    }
    return actor.plazaId;
  }

  private toOutput(e: email_log): EmailLogOutput {
    return {
      id: e.id,
      plazaId: e.plaza_id,
      solicitudId: e.solicitud_id,
      destinatario: e.destinatario,
      plantilla: e.plantilla,
      estado: e.estado,
      reintentos: e.reintentos,
      lastError: e.last_error,
      nextRetryAt: e.next_retry_at?.toISOString() ?? null,
      sentAt: e.sent_at?.toISOString() ?? null,
      createdAt: e.created_at.toISOString(),
    };
  }
}
