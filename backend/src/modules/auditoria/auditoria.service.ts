import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';

export interface AuditoriaEntry {
  accion: string;
  entidadTipo: string;
  entidadId?: string | null;
  plazaId?: string | null;
  usuarioId?: string | null;
  antes?: unknown;
  despues?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * Registro de auditoría append-only de mutaciones (T-040/T-044).
 *
 * Versión MÍNIMA: inserta vía el admin client (bypassa RLS) de forma best-effort
 * — un fallo de auditoría no debe tumbar la operación de negocio. El trigger
 * no-update/delete, el interceptor automático y la retención son T-146/T-150.
 */
@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prismaAdmin: PrismaAdminService) {}

  async record(entry: AuditoriaEntry): Promise<void> {
    try {
      await this.prismaAdmin.auditoria.create({
        data: {
          accion: entry.accion,
          entidad_tipo: entry.entidadTipo,
          entidad_id: entry.entidadId ?? null,
          plaza_id: entry.plazaId ?? null,
          usuario_id: entry.usuarioId ?? null,
          antes:
            entry.antes === undefined
              ? Prisma.JsonNull
              : (entry.antes as Prisma.InputJsonValue),
          despues:
            entry.despues === undefined
              ? Prisma.JsonNull
              : (entry.despues as Prisma.InputJsonValue),
          ip: entry.ip ?? null,
          user_agent: entry.userAgent ?? null,
          request_id: entry.requestId ?? null,
        },
      });
    } catch (err) {
      this.logger.error(`No se pudo registrar auditoría (${entry.accion}): ${String(err)}`);
    }
  }
}
