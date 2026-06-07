import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaAdminService } from '../../../prisma/prisma-admin.service';
import { MinioService } from '../../../common/storage/minio.service';

/**
 * T-114 — Purga de adjuntos en cuarentena (>30 días).
 *
 * Recorre diariamente los `adjunto` con `deleted_at < now() - 30d` y los
 * elimina físicamente:
 *   1. Borra el objeto de `quarantine-{plazaId}` (best-effort, si MinIO está
 *      caído, el ciclo siguiente lo intenta de nuevo).
 *   2. Borra la fila de BD.
 *
 * Defense-in-depth con la lifecycle policy 30d aplicada a `quarantine-{plazaId}`
 * (T-110 / T-111). Si la policy falla, el cron sigue siendo efectivo; si el
 * cron falla, la policy eventualmente limpia el bucket.
 *
 * Usa `PrismaAdminService` (bypassa RLS): el cron corre SIN contexto de tenant
 * y debe recorrer todas las plazas.
 */
@Injectable()
export class QuarantinePurgeCron {
  private readonly logger = new Logger(QuarantinePurgeCron.name);

  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly minio: MinioService,
  ) {}

  @Cron('0 3 * * *', { name: 'adjunto-quarantine-purge', timeZone: 'America/El_Salvador' })
  async handleCron(): Promise<void> {
    const result = await this.ejecutarPurga();
    this.logger.log(
      `Purga de cuarentena: ${result.eliminados} eliminados, ${result.errores} errores.`,
    );
  }

  /** Lógica del cron, invocable también desde el endpoint dev de prueba. */
  async ejecutarPurga(): Promise<{ eliminados: number; errores: number }> {
    const limite = new Date(Date.now() - MinioService.QUARANTINE_TTL_DAYS * 86_400_000);
    const candidatos = await this.prismaAdmin.adjunto.findMany({
      where: { deleted_at: { lt: limite } },
      select: { id: true, plaza_id: true, storage_key: true, entidad_tipo: true },
    });

    let eliminados = 0;
    let errores = 0;

    for (const adj of candidatos) {
      try {
        await this.minio.deleteObject(
          this.minio.bucketForQuarantine(adj.plaza_id),
          adj.storage_key,
        );
        await this.prismaAdmin.adjunto.delete({ where: { id: adj.id } });
        eliminados++;
      } catch (err) {
        errores++;
        this.logger.warn(
          `No se pudo purgar adjunto ${adj.id} (${adj.entidad_tipo}/${adj.plaza_id}): ${String(err)}`,
        );
      }
    }

    return { eliminados, errores };
  }
}
