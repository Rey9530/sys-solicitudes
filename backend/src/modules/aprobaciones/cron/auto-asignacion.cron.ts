import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaAdminService } from '../../../prisma/prisma-admin.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SolicitudStateService } from '../../solicitudes/state/solicitud-state.service';

/** Espera antes de auto-asignar (T-V03: 15 minutos, NO lock de 30). */
const ESPERA_MINUTOS = 15;

/**
 * T-091b (reemplaza T-098): auto-asignación de solicitudes en cola.
 *
 * Cada minuto busca solicitudes en `enviada` con `enviada_at` anterior a
 * 15 min y las transiciona a `asignado` con el responsable ACTUAL de su
 * subcategoría. Encola emails al responsable (`solicitud-asignada-responsable`)
 * y a cada supervisor (`solicitud-nueva-supervisor`), deduplicados.
 *
 * Usa el admin client SOLO para descubrir candidatas (cross-tenant); cada
 * escritura corre bajo `withTenant` (RLS) y re-verifica el estado dentro de
 * la transacción (idempotente frente a carreras).
 *
 * Casos sin asignación posible (quedan en `enviada` para toma manual):
 *  - tipo=otro sin subcategoría;
 *  - subcategoría inactiva o responsable que ya no cumple SC-6.
 */
@Injectable()
export class AutoAsignacionCron {
  private readonly logger = new Logger(AutoAsignacionCron.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly prisma: PrismaService,
    private readonly state: SolicitudStateService,
  ) {}

  @Cron('*/1 * * * *', { name: 'solicitud-auto-asignacion' })
  async handleCron(): Promise<void> {
    await this.ejecutar();
  }

  /** Lógica del cron, invocable desde el endpoint dev de prueba. */
  async ejecutar(): Promise<{ asignadas: number; omitidas: number }> {
    const limite = new Date(Date.now() - ESPERA_MINUTOS * 60_000);

    const candidatas = await this.prismaAdmin.solicitud.findMany({
      where: { estado: 'enviada', enviada_at: { lt: limite } },
      select: { id: true, plaza_id: true, codigo: true, subcategoria_id: true },
      orderBy: { enviada_at: 'asc' },
      take: 200,
    });

    let asignadas = 0;
    let omitidas = 0;

    for (const candidata of candidatas) {
      if (!candidata.subcategoria_id) {
        omitidas++; // tipo=otro sin subcategoría: toma manual desde la bandeja
        continue;
      }
      try {
        const ok = await this.prisma.withTenant(candidata.plaza_id, async (tx) => {
          // Re-verificar dentro de la transacción (otra carrera pudo moverla).
          const solicitud = await tx.solicitud.findFirst({
            where: { id: candidata.id, estado: 'enviada' },
          });
          if (!solicitud || !solicitud.subcategoria_id) return false;

          const sub = await tx.subcategoria.findFirst({
            where: { id: solicitud.subcategoria_id, activo: true },
            include: {
              responsable: {
                select: {
                  id: true,
                  email: true,
                  email_invalido: true,
                  deleted_at: true,
                  rol: { select: { codigo: true } },
                  rol_staff: { select: { activo: true } },
                },
              },
              supervisores: {
                include: {
                  usuario: { select: { id: true, email: true, email_invalido: true } },
                },
              },
            },
          });
          const r = sub?.responsable;
          const responsableValido =
            r &&
            !r.deleted_at &&
            r.rol.codigo === 'admin_plaza' &&
            r.rol_staff?.activo === true;
          if (!sub || !responsableValido) {
            this.logger.warn(
              `solicitud ${candidata.codigo}: subcategoría sin responsable válido; queda en cola`,
            );
            return false;
          }

          await this.state.autoAsignar(tx, solicitud, r.id);

          // Emails: responsable + supervisores (dedup si coincide con responsable).
          if (!r.email_invalido) {
            await this.state.enqueueEmail(tx, {
              plazaId: solicitud.plaza_id,
              destinatario: r.email,
              plantilla: 'solicitud-asignada-responsable',
              solicitudId: solicitud.id,
              variables: { solicitudCodigo: solicitud.codigo, solicitudTitulo: solicitud.titulo },
            });
          }
          const notificados = new Set([r.email]);
          for (const sup of sub.supervisores) {
            const u = sup.usuario;
            if (!u || u.email_invalido || notificados.has(u.email)) continue;
            notificados.add(u.email);
            await this.state.enqueueEmail(tx, {
              plazaId: solicitud.plaza_id,
              destinatario: u.email,
              plantilla: 'solicitud-nueva-supervisor',
              solicitudId: solicitud.id,
              variables: { solicitudCodigo: solicitud.codigo, solicitudTitulo: solicitud.titulo },
            });
          }
          return true;
        });
        if (ok) asignadas++;
        else omitidas++;
      } catch (err) {
        omitidas++;
        this.logger.error(`auto-asignación falló para ${candidata.codigo}: ${String(err)}`);
      }
    }

    if (asignadas > 0 || omitidas > 0) {
      this.logger.log(`auto-asignación: ${asignadas} asignadas, ${omitidas} omitidas`);
    }
    return { asignadas, omitidas };
  }
}
