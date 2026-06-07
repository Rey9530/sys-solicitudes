import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaAdminService } from '../../../prisma/prisma-admin.service';

/**
 * T-101: refresco diario de la vista materializada del SLA (02:00 hora de
 * El Salvador, T-V08). CONCURRENTLY: no bloquea lecturas de la bandeja.
 */
@Injectable()
export class SlaRefreshCron {
  private readonly logger = new Logger(SlaRefreshCron.name);

  constructor(private readonly prismaAdmin: PrismaAdminService) {}

  @Cron('0 2 * * *', { name: 'solicitud-sla-refresh', timeZone: 'America/El_Salvador' })
  async handleCron(): Promise<void> {
    await this.ejecutar();
  }

  async ejecutar(): Promise<void> {
    const inicio = Date.now();
    await this.prismaAdmin.$executeRawUnsafe(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY solicitud_sla_view',
    );
    this.logger.log(`solicitud_sla_view refrescada en ${Date.now() - inicio} ms`);
  }
}
