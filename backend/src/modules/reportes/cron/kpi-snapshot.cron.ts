import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaAdminService } from '../../../prisma/prisma-admin.service';
import { ReportesService } from '../reportes.service';

/** Retención del histórico (S-KPI): 90 días. */
const RETENCION_DIAS = 90;

/**
 * T-142: snapshot de KPIs cada 15 min por plaza activa (S-PA-B). La
 * limpieza de retención corre en el mismo tick (delete barato indexado),
 * no en un cron aparte — ⚠️ desviación documentada en bitácora.
 *
 * Descubrimiento de plazas con el admin client (cross-tenant); cada
 * snapshot se calcula y guarda bajo `withTenant` (RLS).
 */
@Injectable()
export class KpiSnapshotCron {
  private readonly logger = new Logger(KpiSnapshotCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaAdmin: PrismaAdminService,
    private readonly reportes: ReportesService,
  ) {}

  @Cron('*/15 * * * *', { name: 'kpi-snapshot' })
  async handleCron(): Promise<void> {
    await this.ejecutar();
  }

  /** Lógica del cron, invocable desde verificación manual. */
  async ejecutar(): Promise<{ snapshots: number; purgados: number }> {
    const plazas = await this.prismaAdmin.plaza.findMany({
      where: { deleted_at: null },
      select: { id: true },
    });

    let snapshots = 0;
    for (const plaza of plazas) {
      try {
        await this.prisma.withTenant(plaza.id, async (tx) => {
          const metricas = await this.reportes.calcularKpis(tx);
          await tx.kpi_snapshot.create({
            data: { plaza_id: plaza.id, metricas: metricas as unknown as Prisma.InputJsonValue },
          });
        });
        snapshots++;
      } catch (err) {
        this.logger.error(`kpi_snapshot de plaza ${plaza.id} falló: ${String(err)}`);
      }
    }

    const { count: purgados } = await this.prismaAdmin.kpi_snapshot.deleteMany({
      where: { fecha: { lt: new Date(Date.now() - RETENCION_DIAS * 86_400_000) } },
    });
    if (snapshots > 0 || purgados > 0) {
      this.logger.log(`kpi-snapshot: ${snapshots} plazas, ${purgados} purgados (>${RETENCION_DIAS}d)`);
    }
    return { snapshots, purgados };
  }
}
