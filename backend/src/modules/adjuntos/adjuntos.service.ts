import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { adjunto as AdjuntoModel } from '@prisma/client';
import type { AdjuntoOutput, UploadAdjuntoResponse } from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { MinioService } from '../../common/storage/minio.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AdjuntoValidator } from './validators/adjunto.validator';
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

/** Alias genérico (T-112): los adjuntos de solicitud no se limitan a PDF. */
export type UploadedFile = UploadedPdf;

/** Límite duro de adjuntos por solicitud (S-FS-G, T-090). */
const MAX_ADJUNTOS_POR_SOLICITUD = 10;

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
    private readonly validator: AdjuntoValidator,
  ) {}

  // ── Subir PDF a un contrato ───────────────────────────────────────────────────
  async uploadContratoAdjunto(
    contratoId: string,
    file: UploadedPdf,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<UploadAdjuntoResponse> {
    const plazaId = this.requirePlaza(actor);

    // T-062: contrato firmado es siempre PDF (lista cerrada, no configurable).
    const CONTRATO_MIMES = ['application/pdf'] as const;

    const { contrato, maxBytes } = await this.prisma.withTenant(plazaId, async (tx) => {
      const contrato = await tx.contrato.findFirst({ where: { id: contratoId } });
      const config = await tx.configuracion.findUnique({ where: { plaza_id: plazaId } });
      return { contrato, maxBytes: (config?.tamanio_max_archivo_mb ?? 50) * 1024 * 1024 };
    });
    if (!contrato) this.throwNotFound('CONTRATO_NOT_FOUND', 'El contrato no existe.');
    this.assertContratoScope(contrato.inquilino_id, actor);

    // T-115: validador unificado (extensión, MIME, tamaño, magic bytes).
    this.validator.validateAll(
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
        originalname: file.originalname,
      },
      [...CONTRATO_MIMES],
      maxBytes,
    );

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

  // ── Subir imagen a un local (T-116) ───────────────────────────────────────────
  /**
   * Bucket `locales-planos-{plazaId}`, key `{plazaId}/local/{localId}/{uuid}.{ext}`.
   * Allowlist hard-coded de imágenes (PNG/JPEG/WEBP); el validador rechaza el
   * resto con `400 ADJUNTO_MIME_INVALIDO`. Tamaño contra `tamanio_max_archivo_mb`.
   * Permisos: solo admin_plaza / superadmin.
   */
  async uploadLocalAdjunto(
    localId: string,
    file: UploadedFile,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<UploadAdjuntoResponse> {
    const plazaId = this.requirePlaza(actor);

    const LOCAL_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

    const { local, maxBytes } = await this.prisma.withTenant(plazaId, async (tx) => {
      const local = await tx.local.findFirst({ where: { id: localId, deleted_at: null } });
      const config = await tx.configuracion.findUnique({ where: { plaza_id: plazaId } });
      return { local, maxBytes: (config?.tamanio_max_archivo_mb ?? 50) * 1024 * 1024 };
    });
    if (!local) this.throwNotFound('LOCAL_NOT_FOUND', 'El local no existe.');

    this.validator.validateAll(
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
        originalname: file.originalname,
      },
      [...LOCAL_MIMES],
      maxBytes,
    );

    const ext = (file.originalname.split('.').pop() ?? 'bin').toLowerCase().slice(0, 10);
    const bucket = this.minio.bucketForLocales(plazaId);
    const key = `${plazaId}/local/${localId}/${randomUUID()}.${ext}`;
    await this.minio.putObject(bucket, key, file.buffer, file.mimetype);

    const adjunto = await this.prisma.withTenant(plazaId, (tx) =>
      tx.adjunto.create({
        data: {
          plaza_id: plazaId,
          entidad_tipo: 'local',
          entidad_id: localId,
          nombre_original: file.originalname,
          mime_type: file.mimetype,
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

  // ── Listar adjuntos de un local (T-116) ────────────────────────────────────────
  async listLocalAdjuntos(
    localId: string,
    actor: AuthenticatedUser,
  ): Promise<AdjuntoOutput[]> {
    const plazaId = this.requirePlaza(actor);
    if (actor.rol !== 'admin_plaza' && actor.rol !== 'superadmin') {
      this.throwNotFound('ADJUNTO_NOT_FOUND', 'El adjunto no existe.');
    }
    const result = await this.prisma.withTenant(plazaId, async (tx) => {
      const local = await tx.local.findFirst({ where: { id: localId, deleted_at: null } });
      if (!local) return null;
      return tx.adjunto.findMany({
        where: { entidad_tipo: 'local', entidad_id: localId, deleted_at: null },
        orderBy: { created_at: 'desc' },
      });
    });
    if (!result) this.throwNotFound('LOCAL_NOT_FOUND', 'El local no existe.');
    return result.map((a) => this.toOutput(a));
  }

  // ── Subir adjunto a una solicitud (T-112) ─────────────────────────────────────
  /**
   * Permisos (T-112): inquilino dueño en `borrador`/`requerida_subsanacion`;
   * admin_plaza en cualquier estado NO terminal. MIME contra
   * `configuracion.mime_types_permitidos`, tamaño contra
   * `tamanio_max_archivo_mb`, máx 10 adjuntos vivos (T-090).
   * Inserta `solicitud_historial` con evento `adjunto_agregado`.
   */
  async uploadSolicitudAdjunto(
    solicitudId: string,
    file: UploadedFile,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<UploadAdjuntoResponse> {
    const plazaId = this.requirePlaza(actor);
    const esAdmin = actor.rol === 'admin_plaza' || actor.rol === 'superadmin';

    const pre = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await tx.solicitud.findFirst({ where: { id: solicitudId } });
      if (!solicitud) return null;
      const config = await tx.configuracion.findUnique({ where: { plaza_id: plazaId } });
      const vivos = await tx.adjunto.count({
        where: { entidad_tipo: 'solicitud', entidad_id: solicitudId, deleted_at: null },
      });
      return { solicitud, config, vivos };
    });
    if (!pre) this.throwNotFound('SOLICITUD_NOT_FOUND', 'La solicitud no existe.');
    const { solicitud, config, vivos } = pre;

    // Scope + estado según rol.
    const terminal = ['aprobada', 'rechazada', 'cancelada'].includes(solicitud.estado);
    if (actor.rol === 'inquilino') {
      if (!actor.inquilinoId || solicitud.inquilino_id !== actor.inquilinoId) {
        this.throwNotFound('SOLICITUD_NOT_FOUND', 'La solicitud no existe.');
      }
      if (solicitud.estado !== 'borrador' && solicitud.estado !== 'requerida_subsanacion') {
        throw new ForbiddenException({
          code: 'UPLOAD_FORBIDDEN',
          title: 'Acceso denegado',
          message: 'Solo puedes adjuntar en borrador o requerida_subsanacion.',
        });
      }
    } else if (esAdmin && terminal) {
      throw new ForbiddenException({
        code: 'UPLOAD_FORBIDDEN',
        title: 'Acceso denegado',
        message: 'No se puede adjuntar a una solicitud en estado terminal.',
      });
    }

    if (vivos >= MAX_ADJUNTOS_POR_SOLICITUD) {
      throw new BadRequestException({
        code: 'MAX_ADJUNTOS_EXCEDIDO',
        title: 'Solicitud inválida',
        message: `La solicitud ya tiene el máximo de ${MAX_ADJUNTOS_POR_SOLICITUD} adjuntos.`,
      });
    }

    // T-115: validador unificado (extensión, MIME declarado, tamaño, magic bytes).
    // MIME permitidos por plaza (T-V06); tamaño máximo de la plaza.
    const mimesPermitidos = Array.isArray(config?.mime_types_permitidos)
      ? (config.mime_types_permitidos as string[])
      : [];
    const maxBytes = (config?.tamanio_max_archivo_mb ?? 50) * 1024 * 1024;
    this.validator.validateAll(
      {
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
        originalname: file.originalname,
      },
      mimesPermitidos,
      maxBytes,
    );

    const ext = (file.originalname.split('.').pop() ?? 'bin').toLowerCase().slice(0, 10);
    const bucket = this.minio.bucketForSolicitudes(plazaId);
    const key = `${plazaId}/solicitud/${solicitudId}/${randomUUID()}.${ext}`;
    await this.minio.putObject(bucket, key, file.buffer, file.mimetype);

    const adjunto = await this.prisma.withTenant(plazaId, async (tx) => {
      const adjunto = await tx.adjunto.create({
        data: {
          plaza_id: plazaId,
          entidad_tipo: 'solicitud',
          entidad_id: solicitudId,
          nombre_original: file.originalname,
          mime_type: file.mimetype,
          tamano_bytes: file.size,
          storage_key: key,
          usuario_subio_id: actor.sub,
        },
      });
      await tx.solicitud_historial.create({
        data: {
          plaza_id: plazaId,
          solicitud_id: solicitudId,
          usuario_id: actor.sub,
          evento: 'adjunto_agregado',
          comentario: file.originalname,
        },
      });
      return adjunto;
    });

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

  // ── Listar adjuntos de una solicitud (T-112) ──────────────────────────────────
  async listSolicitudAdjuntos(
    solicitudId: string,
    actor: AuthenticatedUser,
  ): Promise<AdjuntoOutput[]> {
    const plazaId = this.requirePlaza(actor);
    const result = await this.prisma.withTenant(plazaId, async (tx) => {
      const solicitud = await tx.solicitud.findFirst({ where: { id: solicitudId } });
      if (!solicitud) return null;
      const adjuntos = await tx.adjunto.findMany({
        where: { entidad_tipo: 'solicitud', entidad_id: solicitudId, deleted_at: null },
        orderBy: { created_at: 'desc' },
      });
      return { solicitud, adjuntos };
    });
    if (!result) this.throwNotFound('SOLICITUD_NOT_FOUND', 'La solicitud no existe.');
    if (
      actor.rol === 'inquilino' &&
      (!actor.inquilinoId || result.solicitud.inquilino_id !== actor.inquilinoId)
    ) {
      this.throwNotFound('SOLICITUD_NOT_FOUND', 'La solicitud no existe.');
    }
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
      } else if (adjunto.entidad_tipo === 'solicitud') {
        const solicitud = await tx.solicitud.findFirst({ where: { id: adjunto.entidad_id } });
        inquilinoId = solicitud?.inquilino_id ?? null;
      } else if (adjunto.entidad_tipo === 'local') {
        // Adjuntos de local: solo accesibles a admin_plaza/superadmin. La policy
        // RLS igual filtra por plaza, así que un inquilino jamás los ve (y si
        // por bug lo viera, el assertInquilinoNotAllowed más abajo lo bloquea).
        inquilinoId = null;
      }
      return { adjunto, inquilinoId };
    });
    if (!result) this.throwNotFound('ADJUNTO_NOT_FOUND', 'El adjunto no existe.');
    if (actor.rol === 'inquilino') {
      // Inquilinos NUNCA tienen acceso a adjuntos de local.
      if (result.adjunto.entidad_tipo === 'local') {
        this.throwNotFound('ADJUNTO_NOT_FOUND', 'El adjunto no existe.');
      }
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
    switch (adjunto.entidad_tipo) {
      case 'solicitud':
        return this.minio.bucketForSolicitudes(adjunto.plaza_id);
      case 'local':
        return this.minio.bucketForLocales(adjunto.plaza_id);
      case 'contrato':
        return this.minio.bucketForContratos(adjunto.plaza_id);
      default:
        return this.minio.bucketForContratos(adjunto.plaza_id);
    }
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
