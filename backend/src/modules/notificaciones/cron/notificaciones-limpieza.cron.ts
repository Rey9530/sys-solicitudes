import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaAdminService } from '../../../prisma/prisma-admin.service';

/** Retención de la bandeja in-app (decisión owner 2026-09-25). */
export const NOTIFICACIONES_RETENCION_DIAS = 90;

/**
 * Limpieza diaria de notificaciones in-app (PLANIFICACION/16): borra las de
 * más de 90 días en todas las plazas (admin client, sin contexto de tenant).
 * Idempotente: correrlo dos veces no tiene efecto adicional.
 * Exento de la convención "agrupar por plaza_id" de los crons con admin client:
 * es un DELETE por antigüedad que no lee ni expone datos de ningún tenant.
 */
@Injectable()
export class NotificacionesLimpiezaCron {
  private readonly logger = new Logger(NotificacionesLimpiezaCron.name);

  constructor(private readonly prismaAdmin: PrismaAdminService) {}

  @Cron('0 3 * * *', { name: 'notificaciones-limpieza', timeZone: 'America/El_Salvador' })
  async handleCron(): Promise<void> {
    await this.limpiar();
  }

  /** Lógica del cron, invocable desde verificación manual. */
  async limpiar(): Promise<number> {
    const limite = new Date(Date.now() - NOTIFICACIONES_RETENCION_DIAS * 24 * 60 * 60 * 1000);
    const { count } = await this.prismaAdmin.notificacion.deleteMany({
      where: { created_at: { lt: limite } },
    });
    if (count > 0) this.logger.log(`Notificaciones in-app eliminadas (>90 días): ${count}`);
    return count;
  }
}
