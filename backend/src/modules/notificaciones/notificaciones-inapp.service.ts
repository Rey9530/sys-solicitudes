import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, notificacion } from '@prisma/client';
import type {
  NotificacionOutput,
  NotificacionTipo,
  NotificacionesConteoOutput,
  NotificacionesInboxOutput,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

/** Datos mínimos de la solicitud para armar el texto de la notificación. */
export interface SolicitudRef {
  id: string;
  plaza_id: string;
  codigo: string;
  titulo: string;
}

export interface NotificarOpts {
  plazaId: string;
  /** IDs de usuario destino; se deduplican y se excluye `actorId`. */
  destinatarios: ReadonlyArray<string | null | undefined>;
  /** Quien provocó el evento: nunca se notifica a sí mismo. */
  actorId?: string | null;
  tipo: NotificacionTipo;
  titulo: string;
  mensaje: string;
  solicitudId?: string | null;
  contratoId?: string | null;
}

/** Extras por evento para el texto (motivo, resultado, nombre del nuevo admin…). */
export interface NotificacionExtra {
  detalle?: string | null;
}

const MAX_DETALLE = 140;

/** Textos por tipo (fuente única). `ref` = "SOL-acme-42 · Título". */
const TEXTOS: Record<
  Exclude<NotificacionTipo, 'contrato_por_vencer'>,
  (ref: string) => { titulo: string; mensaje: string }
> = {
  solicitud_asignada: (ref) => ({
    titulo: 'Se te asignó una solicitud',
    mensaje: `${ref} — revísala y tómala para iniciar la revisión.`,
  }),
  solicitud_nueva_supervisor: (ref) => ({
    titulo: 'Nueva solicitud en tu subcategoría',
    mensaje: `${ref} — fue asignada a su responsable.`,
  }),
  solicitud_reasignada: (ref) => ({
    titulo: 'Te reasignaron una solicitud',
    mensaje: `${ref} — ahora eres el responsable.`,
  }),
  solicitud_desasignada: (ref) => ({
    titulo: 'Solicitud reasignada a otro administrador',
    mensaje: `${ref} — ya no está a tu cargo.`,
  }),
  solicitud_en_revision: (ref) => ({
    titulo: 'Tu solicitud está en revisión',
    mensaje: `${ref} — un administrador comenzó a revisarla.`,
  }),
  solicitud_aprobada: (ref) => ({
    titulo: 'Solicitud aprobada',
    mensaje: `${ref} — fue aprobada.`,
  }),
  solicitud_rechazada: (ref) => ({
    titulo: 'Solicitud rechazada',
    mensaje: `${ref} — fue rechazada.`,
  }),
  solicitud_subsanacion: (ref) => ({
    titulo: 'Tu solicitud requiere correcciones',
    mensaje: `${ref} — corrige lo indicado y reenvíala.`,
  }),
  solicitud_cerrada: (ref) => ({
    titulo: 'Solicitud cerrada',
    mensaje: `${ref} — fue cerrada.`,
  }),
  solicitud_pausada: (ref) => ({
    titulo: 'Solicitud en pausa',
    mensaje: `${ref} — la revisión quedó en pausa.`,
  }),
  solicitud_reanudada: (ref) => ({
    titulo: 'Solicitud reanudada',
    mensaje: `${ref} — la revisión se reanudó.`,
  }),
  solicitud_liberada: (ref) => ({
    titulo: 'Solicitud de vuelta en la cola',
    mensaje: `${ref} — se liberó y será asignada nuevamente.`,
  }),
  solicitud_cancelada: (ref) => ({
    titulo: 'Solicitud cancelada',
    mensaje: `${ref} — fue cancelada.`,
  }),
  solicitud_reenviada: (ref) => ({
    titulo: 'Solicitud corregida y reenviada',
    mensaje: `${ref} — el inquilino atendió la subsanación.`,
  }),
  comentario_nuevo: (ref) => ({
    titulo: 'Nuevo comentario',
    mensaje: `${ref} —`,
  }),
};

/**
 * Notificaciones in-app (campana del topbar, PLANIFICACION/16).
 *
 * Escritura: `notificar*` recibe la `tx` del caller (prisma.withTenant o el
 * admin client en crons) para que la notificación sea atómica con la
 * transición. Lectura: bandeja propia — RLS por plaza + `usuario_id = sub`.
 */
@Injectable()
export class NotificacionesInAppService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Escritura ────────────────────────────────────────────────────────────────

  async notificar(tx: Prisma.TransactionClient, opts: NotificarOpts): Promise<number> {
    const ids = [
      ...new Set(opts.destinatarios.filter((id): id is string => !!id && id !== opts.actorId)),
    ];
    if (ids.length === 0) return 0;
    // Solo usuarios activos de ESTA plaza: descarta superadmin (plaza_id NULL,
    // p.ej. si tomó la solicitud) y cualquier id ajeno al tenant.
    const validos = await tx.usuario.findMany({
      where: { id: { in: ids }, plaza_id: opts.plazaId, deleted_at: null },
      select: { id: true },
    });
    if (validos.length === 0) return 0;
    const { count } = await tx.notificacion.createMany({
      data: validos.map(({ id: usuario_id }) => ({
        plaza_id: opts.plazaId,
        usuario_id,
        tipo: opts.tipo,
        titulo: opts.titulo,
        mensaje: opts.mensaje,
        solicitud_id: opts.solicitudId ?? null,
        contrato_id: opts.contratoId ?? null,
      })),
    });
    return count;
  }

  /** Notificación ligada a una solicitud con el texto estándar del tipo. */
  notificarSolicitud(
    tx: Prisma.TransactionClient,
    solicitud: SolicitudRef,
    tipo: Exclude<NotificacionTipo, 'contrato_por_vencer'>,
    destinatarios: ReadonlyArray<string | null | undefined>,
    actorId?: string | null,
    extra: NotificacionExtra = {},
  ): Promise<number> {
    const { titulo, mensaje } = TEXTOS[tipo](`${solicitud.codigo} · ${solicitud.titulo}`);
    return this.notificar(tx, {
      plazaId: solicitud.plaza_id,
      destinatarios,
      actorId,
      tipo,
      titulo,
      mensaje: extra.detalle ? `${mensaje} ${recortar(extra.detalle)}` : mensaje,
      solicitudId: solicitud.id,
    });
  }

  // ── Bandeja del usuario ─────────────────────────────────────────────────────

  async listarInbox(actor: AuthenticatedUser, limit: number): Promise<NotificacionesInboxOutput> {
    return this.prisma.withTenant(this.requirePlaza(actor), async (tx) => {
      const [items, noLeidas] = await Promise.all([
        tx.notificacion.findMany({
          where: { usuario_id: actor.sub },
          orderBy: { created_at: 'desc' },
          take: limit,
        }),
        tx.notificacion.count({ where: { usuario_id: actor.sub, leida_at: null } }),
      ]);
      return { items: items.map(toOutput), noLeidas };
    });
  }

  async contarNoLeidas(actor: AuthenticatedUser): Promise<NotificacionesConteoOutput> {
    const noLeidas = await this.prisma.withTenant(this.requirePlaza(actor), (tx) =>
      tx.notificacion.count({ where: { usuario_id: actor.sub, leida_at: null } }),
    );
    return { noLeidas };
  }

  async marcarLeida(actor: AuthenticatedUser, id: string): Promise<NotificacionOutput> {
    return this.prisma.withTenant(this.requirePlaza(actor), async (tx) => {
      const actual = await tx.notificacion.findFirst({ where: { id, usuario_id: actor.sub } });
      if (!actual) {
        throw new NotFoundException({
          code: 'NOTIFICACION_NO_ENCONTRADA',
          title: 'Recurso no encontrado',
          message: 'La notificación no existe.',
        });
      }
      if (actual.leida_at) return toOutput(actual);
      const updated = await tx.notificacion.update({
        where: { id },
        data: { leida_at: new Date() },
      });
      return toOutput(updated);
    });
  }

  async marcarTodasLeidas(actor: AuthenticatedUser): Promise<{ actualizadas: number }> {
    const { count } = await this.prisma.withTenant(this.requirePlaza(actor), (tx) =>
      tx.notificacion.updateMany({
        where: { usuario_id: actor.sub, leida_at: null },
        data: { leida_at: new Date() },
      }),
    );
    return { actualizadas: count };
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
}

function recortar(texto: string): string {
  const limpio = texto
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return limpio.length > MAX_DETALLE ? `${limpio.slice(0, MAX_DETALLE - 1)}…` : limpio;
}

function toOutput(n: notificacion): NotificacionOutput {
  return {
    id: n.id,
    tipo: n.tipo as NotificacionTipo,
    titulo: n.titulo,
    mensaje: n.mensaje,
    solicitudId: n.solicitud_id,
    contratoId: n.contrato_id,
    leida: n.leida_at !== null,
    createdAt: n.created_at.toISOString(),
  };
}
