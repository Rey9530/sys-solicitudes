import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaAdminService } from '../../../prisma/prisma-admin.service';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * T-103: cierre de ventana de mantenimiento por remodelación.
 *
 * Diario 03:00 (El Salvador): locales `en_mantenimiento` con
 * `fecha_fin_mantenimiento` vencida vuelven a `alquilado` (si tienen contrato
 * vigente) o `disponible`. Limpia la ventana.
 */
@Injectable()
export class MantenimientoFinCron {
  private readonly logger = new Logger(MantenimientoFinCron.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('0 3 * * *', { name: 'local-mantenimiento-fin', timeZone: 'America/El_Salvador' })
  async handleCron(): Promise<void> {
    await this.ejecutar();
  }

  async ejecutar(): Promise<{ restaurados: number }> {
    const hoy = new Date();
    const vencidos = await this.prismaAdmin.local.findMany({
      where: {
        estado: 'en_mantenimiento',
        fecha_fin_mantenimiento: { lt: hoy },
        deleted_at: null,
      },
      select: { id: true, plaza_id: true, codigo: true },
    });

    let restaurados = 0;
    for (const local of vencidos) {
      try {
        await this.prisma.withTenant(local.plaza_id, async (tx) => {
          const vigente = await tx.contrato.findFirst({
            where: { local_id: local.id, estado: 'vigente' },
          });
          await tx.local.update({
            where: { id: local.id },
            data: {
              estado: vigente ? 'alquilado' : 'disponible',
              fecha_inicio_mantenimiento: null,
              fecha_fin_mantenimiento: null,
            },
          });
        });
        restaurados++;
      } catch (err) {
        this.logger.error(`fin de mantenimiento falló para ${local.codigo}: ${String(err)}`);
      }
    }
    if (restaurados > 0) this.logger.log(`locales restaurados tras mantenimiento: ${restaurados}`);
    return { restaurados };
  }
}
