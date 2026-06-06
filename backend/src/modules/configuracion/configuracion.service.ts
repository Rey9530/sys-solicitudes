import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { configuracion as ConfiguracionModel } from '@prisma/client';
import type { Configuracion, UpdateConfiguracionInput } from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import type { RequestMeta } from '../plazas/plazas.service';

/** Lista cerrada de MIME permitidos (T-V06). El PATCH no puede salir de aquí. */
const MIME_ALLOWLIST = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/dwg',
];

@Injectable()
export class ConfiguracionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Configuración de la plaza del usuario autenticado (admin_plaza). */
  async get(actor: AuthenticatedUser): Promise<Configuracion> {
    const plazaId = this.requirePlaza(actor);
    const config = await this.prisma.withTenant(plazaId, (tx) =>
      tx.configuracion.findUnique({ where: { plaza_id: plazaId } }),
    );
    if (!config) {
      throw new NotFoundException({
        code: 'CONFIGURACION_NOT_FOUND',
        title: 'Recurso no encontrado',
        message: 'La configuración de la plaza no existe.',
      });
    }
    return this.toOutput(config);
  }

  async update(
    dto: UpdateConfiguracionInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<Configuracion> {
    const plazaId = this.requirePlaza(actor);

    if (dto.mimeTypesPermitidos) {
      const invalid = dto.mimeTypesPermitidos.filter((m) => !MIME_ALLOWLIST.includes(m));
      if (invalid.length > 0) {
        throw new BadRequestException({
          code: 'MIME_NO_PERMITIDO',
          title: 'Solicitud inválida',
          message: `MIME no permitido: ${invalid.join(', ')}. Permitidos: ${MIME_ALLOWLIST.join(', ')}.`,
        });
      }
    }

    const data = {
      ...(dto.tamanioMaxArchivoMb !== undefined ? { tamanio_max_archivo_mb: dto.tamanioMaxArchivoMb } : {}),
      ...(dto.mimeTypesPermitidos !== undefined ? { mime_types_permitidos: dto.mimeTypesPermitidos } : {}),
      ...(dto.slaDiasPorTipo !== undefined ? { sla_dias_por_tipo: dto.slaDiasPorTipo } : {}),
      ...(dto.slaMultiplicadorPorPrioridad !== undefined
        ? { sla_multiplicador_por_prioridad: dto.slaMultiplicadorPorPrioridad }
        : {}),
      ...(dto.calendarMostrarHitosContrato !== undefined
        ? { calendar_mostrar_hitos_contrato: dto.calendarMostrarHitosContrato }
        : {}),
      ...(dto.aprobacionEspecialAsistentesMin !== undefined
        ? { aprobacion_especial_asistentes_min: dto.aprobacionEspecialAsistentesMin }
        : {}),
    };

    const { before, after } = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = await tx.configuracion.findUnique({ where: { plaza_id: plazaId } });
      if (!before) {
        throw new NotFoundException({
          code: 'CONFIGURACION_NOT_FOUND',
          title: 'Recurso no encontrado',
          message: 'La configuración de la plaza no existe.',
        });
      }
      const after = await tx.configuracion.update({ where: { plaza_id: plazaId }, data });
      return { before, after };
    });

    await this.auditoria.record({
      accion: 'configuracion.update',
      entidadTipo: 'configuracion',
      entidadId: after.id,
      plazaId,
      usuarioId: actor.sub,
      antes: this.toOutput(before),
      despues: this.toOutput(after),
      ip: meta.ip,
      userAgent: meta.userAgent,
      requestId: meta.requestId,
    });

    return this.toOutput(after);
  }

  private requirePlaza(actor: AuthenticatedUser): string {
    if (!actor.plazaId) {
      throw new BadRequestException({
        code: 'PLAZA_REQUERIDA',
        title: 'Solicitud inválida',
        message: 'Esta operación requiere una plaza asociada.',
      });
    }
    return actor.plazaId;
  }

  private toOutput(c: ConfiguracionModel): Configuracion {
    return {
      tamanioMaxArchivoMb: c.tamanio_max_archivo_mb,
      mimeTypesPermitidos: c.mime_types_permitidos as string[],
      slaDiasPorTipo: c.sla_dias_por_tipo as Configuracion['slaDiasPorTipo'],
      slaMultiplicadorPorPrioridad:
        c.sla_multiplicador_por_prioridad as Configuracion['slaMultiplicadorPorPrioridad'],
      calendarMostrarHitosContrato: c.calendar_mostrar_hitos_contrato,
      aprobacionEspecialAsistentesMin: c.aprobacion_especial_asistentes_min,
    };
  }
}
