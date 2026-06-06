import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { adjunto as AdjuntoModel } from '@prisma/client';
import type { AdjuntoOutput, UploadAdjuntoResponse } from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../../common/storage/minio.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface UploadedPdf {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

/**
 * Adjuntos de contrato (T-062) — subconjunto del módulo completo (T-110+).
 *
 * Solo `application/pdf`, tamaño máx según `configuracion.tamanio_max_archivo_mb`
 * (50 MB default, T-V06). Bucket `contratos-{plaza_id}`, key
 * `{plaza_id}/contrato/{contratoId}/{uuid}.pdf` (RN-CO-5).
 *
 * Permisos (docs/06 §6.2.9): admin_plaza sube/borra en cualquier contrato de su
 * plaza; inquilino solo en sus propios contratos y solo borra lo que subió.
 */
@Injectable()
export class AdjuntosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ── Subir PDF a un contrato ───────────────────────────────────────────────────
  async uploadContratoAdjunto(
    contratoId: string,
    file: UploadedPdf,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<UploadAdjuntoResponse> {
    const plazaId = this.requirePlaza(actor);
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException({
        code: 'ADJUNTO_MIME_INVALIDO',
        title: 'Solicitud inválida',
        message: 'Solo se permite PDF (application/pdf) para el contrato firmado.',
      });
    }

    const { contrato, maxBytes } = await this.prisma.withTenant(plazaId, async (tx) => {
      const contrato = await tx.contrato.findFirst({ where: { id: contratoId } });
      const config = await tx.configuracion.findUnique({ where: { plaza_id: plazaId } });
      return { contrato, maxBytes: (config?.tamanio_max_archivo_mb ?? 50) * 1024 * 1024 };
    });
    if (!contrato) this.throwNotFound('CONTRATO_NOT_FOUND', 'El contrato no existe.');
    this.assertContratoScope(contrato.inquilino_id, actor);

    if (file.size > maxBytes) {
      throw new PayloadTooLargeException({
        code: 'ADJUNTO_DEMASIADO_GRANDE',
        title: 'Carga demasiado grande',
        message: `El archivo supera el máximo de ${Math.floor(maxBytes / 1024 / 1024)} MB de la plaza.`,
      });
    }

    const bucket = this.minio.bucketForContratos(plazaId);
    const key = `${plazaId}/contrato/${contratoId}/${randomUUID()}.pdf`;
    await this.minio.putObject(bucket, key, file.buffer, 'application/pdf');

    const adjunto = await this.prisma.withTenant(plazaId, (tx) =>
      tx.adjunto.create({
        data: {
          plaza_id: plazaId,
          entidad_tipo: 'contrato',
          entidad_id: contratoId,
          nombre_original: file.originalname,
          mime_type: 'application/pdf',
          tamano_bytes: file.size,
          storage_key: key,
          usuario_subio_id: actor.sub,
        },
      }),
    );

    await this.auditoria.record({
      accion: 'adjunto.create',
      entidadTipo: 'adjunto',
      entidadId: adjunto.id,
      plazaId,
      usuarioId: actor.sub,
      despues: { ...this.toOutput(adjunto), storageKey: key },
      ...meta,
    });

    let url: string | undefined;
    try {
      url = await this.minio.presignedGetUrl(bucket, key);
    } catch {
      url = undefined;
    }
    return { adjunto: this.toOutput(adjunto), url };
  }

  // ── Listar adjuntos de un contrato ────────────────────────────────────────────
  async listContratoAdjuntos(
    contratoId: string,
    actor: AuthenticatedUser,
  ): Promise<AdjuntoOutput[]> {
    const plazaId = this.requirePlaza(actor);
    const result = await this.prisma.withTenant(plazaId, async (tx) => {
      const contrato = await tx.contrato.findFirst({ where: { id: contratoId } });
      if (!contrato) return null;
      const adjuntos = await tx.adjunto.findMany({
        where: { entidad_tipo: 'contrato', entidad_id: contratoId, deleted_at: null },
        orderBy: { created_at: 'desc' },
      });
      return { contrato, adjuntos };
    });
    if (!result) this.throwNotFound('CONTRATO_NOT_FOUND', 'El contrato no existe.');
    this.assertContratoScope(result.contrato.inquilino_id, actor);
    return result.adjuntos.map((a) => this.toOutput(a));
  }

  // ── Descargar (URL pre-firmada 15 min) ────────────────────────────────────────
  async download(adjuntoId: string, actor: AuthenticatedUser): Promise<{ url: string }> {
    const plazaId = this.requirePlaza(actor);
    const adjunto = await this.findAdjuntoConScope(adjuntoId, actor, plazaId);
    const url = await this.minio.presignedGetUrl(
      this.bucketFor(adjunto),
      adjunto.storage_key,
    );
    return { url };
  }

  // ── Eliminar (cuarentena + soft delete) ───────────────────────────────────────
  async remove(adjuntoId: string, actor: AuthenticatedUser, meta: RequestMeta): Promise<void> {
    const plazaId = this.requirePlaza(actor);
    const adjunto = await this.findAdjuntoConScope(adjuntoId, actor, plazaId);

    // Solo admin_plaza/superadmin o el usuario que subió el archivo.
    const esAdmin = actor.rol === 'admin_plaza' || actor.rol === 'superadmin';
    if (!esAdmin && adjunto.usuario_subio_id !== actor.sub) {
      throw new ForbiddenException({
        code: 'ADJUNTO_DELETE_FORBIDDEN',
        title: 'Acceso denegado',
        message: 'Solo quien subió el archivo o un administrador puede eliminarlo.',
      });
    }

    await this.minio.moveToQuarantine(plazaId, this.bucketFor(adjunto), adjunto.storage_key);
    await this.prisma.withTenant(plazaId, (tx) =>
      tx.adjunto.update({ where: { id: adjuntoId }, data: { deleted_at: new Date() } }),
    );

    await this.auditoria.record({
      accion: 'adjunto.delete',
      entidadTipo: 'adjunto',
      entidadId: adjuntoId,
      plazaId,
      usuarioId: actor.sub,
      antes: { ...this.toOutput(adjunto), storageKey: adjunto.storage_key },
      ...meta,
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  /** Carga el adjunto validando RLS + scope del inquilino sobre la entidad. */
  private async findAdjuntoConScope(
    adjuntoId: string,
    actor: AuthenticatedUser,
    plazaId: string,
  ): Promise<AdjuntoModel> {
    const result = await this.prisma.withTenant(plazaId, async (tx) => {
      const adjunto = await tx.adjunto.findFirst({
        where: { id: adjuntoId, deleted_at: null },
      });
      if (!adjunto) return null;
      let inquilinoId: string | null = null;
      if (adjunto.entidad_tipo === 'contrato') {
        const contrato = await tx.contrato.findFirst({ where: { id: adjunto.entidad_id } });
        inquilinoId = contrato?.inquilino_id ?? null;
      }
      return { adjunto, inquilinoId };
    });
    if (!result) this.throwNotFound('ADJUNTO_NOT_FOUND', 'El adjunto no existe.');
    if (actor.rol === 'inquilino') {
      this.assertContratoScope(result.inquilinoId, actor);
    }
    return result.adjunto;
  }

  /** Inquilino: solo entidades de su propio inquilino_id. */
  private assertContratoScope(
    inquilinoIdEntidad: string | null,
    actor: AuthenticatedUser,
  ): void {
    if (actor.rol !== 'inquilino') return;
    if (!actor.inquilinoId || inquilinoIdEntidad !== actor.inquilinoId) {
      this.throwNotFound('CONTRATO_NOT_FOUND', 'El contrato no existe.');
    }
  }

  private bucketFor(adjunto: AdjuntoModel): string {
    // v1: solo adjuntos de contrato (T-062). Solicitudes/locales llegan en T-110+.
    return this.minio.bucketForContratos(adjunto.plaza_id);
  }

  private requirePlaza(actor: AuthenticatedUser): string {
    if (!actor.plazaId) {
      throw new ForbiddenException({
        code: 'PLAZA_SCOPE_VIOLATION',
        title: 'Acceso denegado',
        message: 'Esta operación requiere un usuario con plaza asignada.',
      });
    }
    return actor.plazaId;
  }

  private throwNotFound(code: string, message: string): never {
    throw new NotFoundException({ code, title: 'Recurso no encontrado', message });
  }

  private toOutput(a: AdjuntoModel): AdjuntoOutput {
    return {
      id: a.id,
      plazaId: a.plaza_id,
      entidadTipo: a.entidad_tipo,
      entidadId: a.entidad_id,
      nombreOriginal: a.nombre_original,
      mimeType: a.mime_type,
      tamanoBytes: a.tamano_bytes,
      usuarioSubioId: a.usuario_subio_id,
      createdAt: a.created_at.toISOString(),
    };
  }
}
