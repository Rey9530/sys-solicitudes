import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient, LifecycleConfig } from 'minio';
import { durationToSeconds } from '../utils/duration';

/**
 * Cliente MinIO (S3-compatible) — versión completa del módulo 08 (T-110).
 * Cubre buckets por tenant (T-111), carga/descarga de adjuntos, movimiento a
 * cuarentena (T-114) y lifecycle policy de 30 días sobre `quarantine-{plazaId}`.
 *
 * Buckets por plaza:
 *   - `plaza-assets-{plazaId}`     → logos y branding (T-041)
 *   - `solicitudes-adjuntos-{id}`  → adjuntos de solicitudes (T-112)
 *   - `locales-planos-{id}`        → planos / fotos de locales (T-116)
 *   - `contratos-{id}`             → contratos firmados PDF (T-062)
 *   - `quarantine-{id}`            → soft-deleted adjuntos (T-114)
 */
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: MinioClient;
  private readonly presignTtl: number;
  private readonly region: string;

  /**
   * Reescritura del host en URLs pre-firmadas. En producción, el cliente
   * MinIO habla con `minio:9000` (red interna, sin TLS), pero el navegador
   * del usuario debe alcanzar el bucket por `https://<MINIO_PUBLIC_ENDPOINT>`.
   * Si está configurado, `presignedGetUrl` reemplaza el `host:port` interno
   * por el público (manteniendo firma y query string intactos).
   */
  private readonly publicHost: string | null;

  /** Días de retención en `quarantine-{plazaId}` antes de la purga automática (S-Quarantine). */
  static readonly QUARANTINE_TTL_DAYS = 30;

  constructor(private readonly config: ConfigService) {
    this.region = this.config.get<string>('MINIO_REGION', 'us-east-1');
    this.presignTtl = durationToSeconds(
      this.config.get<string>('MINIO_PRESIGNED_URL_TTL', '900s'),
    );
    this.client = new MinioClient({
      endPoint: this.config.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: Number(this.config.get<string>('MINIO_PORT', '9000')),
      useSSL: this.config.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.config.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.config.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
      region: this.region,
    });
    const publicEndpoint = this.config.get<string>('MINIO_PUBLIC_ENDPOINT', '').trim();
    this.publicHost = publicEndpoint
      ? `${this.config.get<string>('MINIO_PUBLIC_USE_SSL', 'true') === 'true' ? 'https' : 'http'}://${publicEndpoint}${this.config.get<string>('MINIO_PUBLIC_PORT', '443') && this.config.get<string>('MINIO_PUBLIC_PORT', '443') !== '443' && this.config.get<string>('MINIO_PUBLIC_PORT', '443') !== '80' ? ':' + this.config.get<string>('MINIO_PUBLIC_PORT', '443') : ''}`
      : null;
  }

  onModuleInit(): void {
    this.logger.log(
      `MinIO client inicializado (endpoint=${this.config.get<string>('MINIO_ENDPOINT', 'localhost')}:${this.config.get<string>('MINIO_PORT', '9000')}, ssl=${this.config.get<string>('MINIO_USE_SSL', 'false')}, presignTtl=${this.presignTtl}s, publicHost=${this.publicHost ?? '(mismo que interno)'})`,
    );
  }

  // ── Bucket naming (T-111) ─────────────────────────────────────────────────────

  /** Bucket de assets de branding por plaza. */
  bucketForPlaza(plazaId: string): string {
    return `plaza-assets-${plazaId}`;
  }

  /** Bucket de adjuntos de solicitudes por plaza (T-112). */
  bucketForSolicitudes(plazaId: string): string {
    return `solicitudes-adjuntos-${plazaId}`;
  }

  /** Bucket de planos / fotos de locales por plaza (T-116). */
  bucketForLocales(plazaId: string): string {
    return `locales-planos-${plazaId}`;
  }

  /** Bucket de contratos firmados PDF por plaza (T-062). */
  bucketForContratos(plazaId: string): string {
    return `contratos-${plazaId}`;
  }

  /** Bucket de cuarentena por plaza (T-114). */
  bucketForQuarantine(plazaId: string): string {
    return `quarantine-${plazaId}`;
  }

  // ── Bucket CRUD ──────────────────────────────────────────────────────────────

  /** Verifica si un bucket existe. */
  async bucketExists(bucket: string): Promise<boolean> {
    return this.client.bucketExists(bucket).catch(() => false);
  }

  /** Crea el bucket si no existe. */
  async createBucketIfNotExists(bucket: string): Promise<void> {
    const exists = await this.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket, this.region);
      this.logger.log(`Bucket creado: ${bucket} (region=${this.region})`);
    }
  }

  /** Alias retrocompatible con código previo (T-041, T-062). */
  async ensureBucket(bucket: string): Promise<void> {
    return this.createBucketIfNotExists(bucket);
  }

  /**
   * Crea los 5 buckets por tenant y aplica lifecycle policy 30d al de
   * cuarentena. Idempotente. Usado por el seed y por `PlazasService.create`.
   */
  async createBucketsForPlaza(plazaId: string): Promise<void> {
    const buckets = [
      this.bucketForPlaza(plazaId),
      this.bucketForSolicitudes(plazaId),
      this.bucketForLocales(plazaId),
      this.bucketForContratos(plazaId),
      this.bucketForQuarantine(plazaId),
    ];
    for (const b of buckets) {
      await this.createBucketIfNotExists(b);
    }
    await this.setQuarantineLifecycle(plazaId);
    this.logger.log(`Buckets inicializados para plaza ${plazaId}: ${buckets.join(', ')}`);
  }

  /**
   * Variante "best-effort": no propaga errores, solo los loguea. Útil en
   * `PlazasService.create` (no debe fallar el alta de una plaza si MinIO está
   * caído) y en el seed de dev.
   */
  async safeCreateBucketsForPlaza(plazaId: string): Promise<void> {
    try {
      await this.createBucketsForPlaza(plazaId);
    } catch (err) {
      this.logger.warn(
        `Buckets no inicializados para plaza ${plazaId} (MinIO no disponible): ${String(err)}`,
      );
    }
  }

  /**
   * Lifecycle policy 30d sobre `quarantine-{plazaId}`. Defense-in-depth con el
   * cron (T-114) que limpia la BD. Si la policy falla, el cron sigue siendo
   * efectivo; si el cron falla, la policy eventualmente limpia el bucket.
   */
  async setQuarantineLifecycle(plazaId: string): Promise<void> {
    const bucket = this.bucketForQuarantine(plazaId);
    const config: LifecycleConfig = {
      Rule: [
        {
          ID: 'purge-quarantine-30d',
          Status: 'Enabled',
          Filter: { Prefix: '' },
          Expiration: { Days: MinioService.QUARANTINE_TTL_DAYS },
        },
      ],
    };
    try {
      await this.client.setBucketLifecycle(bucket, config);
      this.logger.log(
        `Lifecycle policy aplicada a ${bucket} (purga > ${MinioService.QUARANTINE_TTL_DAYS}d)`,
      );
    } catch (err) {
      this.logger.warn(
        `No se pudo aplicar lifecycle policy a ${bucket}: ${String(err)}`,
      );
    }
  }

  // ── Object CRUD ──────────────────────────────────────────────────────────────

  async putObject(
    bucket: string,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.ensureBucket(bucket);
    await this.client.putObject(bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    this.logger.debug(
      `putObject bucket=${bucket} key=${key} size=${buffer.length} mime=${contentType}`,
    );
  }

  /** URL pre-firmada de lectura (TTL por MINIO_PRESIGNED_URL_TTL, 15 min). */
  async presignedGetUrl(bucket: string, key: string): Promise<string> {
    const internalUrl = await this.client.presignedGetObject(bucket, key, this.presignTtl);
    const url = this.rewritePresignedHost(internalUrl);
    this.logger.debug(
      `presignedGetUrl bucket=${bucket} key=${key} ttl=${this.presignTtl}s public=${this.publicHost ? 'yes' : 'no'}`,
    );
    return url;
  }

  /**
   * Si hay `MINIO_PUBLIC_ENDPOINT` configurado, reemplaza el `scheme://host:port`
   * interno por el público. La firma SigV4 queda intacta (la firma es sobre el
   * path + query, no sobre el host). Si no hay override, devuelve la URL tal cual.
   */
  private rewritePresignedHost(internalUrl: string): string {
    if (!this.publicHost) return internalUrl;
    try {
      const u = new URL(internalUrl);
      const pub = new URL(this.publicHost);
      u.protocol = pub.protocol;
      u.host = pub.host;
      return u.toString();
    } catch (err) {
      this.logger.warn(
        `No se pudo reescribir la URL pre-firmada (${String(err)}); devolviendo original. ` +
          `internal=${internalUrl} publicHost=${this.publicHost}`,
      );
      return internalUrl;
    }
  }

  /**
   * Mueve un objeto a la cuarentena de la plaza (best-effort). Si la copia
   * falla, el soft-delete de la fila en BD sigue siendo válido — el operador
   * puede recuperarlo manualmente desde MinIO.
   */
  async moveToQuarantine(plazaId: string, bucket: string, key: string): Promise<void> {
    const quarantine = this.bucketForQuarantine(plazaId);
    try {
      await this.ensureBucket(quarantine);
      await this.client.copyObject(quarantine, key, `/${bucket}/${key}`);
      await this.client.removeObject(bucket, key);
      this.logger.log(`moveToQuarantine ${bucket}/${key} → ${quarantine}`);
    } catch (err) {
      this.logger.warn(
        `No se pudo mover a cuarentena ${bucket}/${key}: ${String(err)}`,
      );
    }
  }

  /** Borra un objeto de un bucket (usado por T-114 cron de purga). */
  async deleteObject(bucket: string, key: string): Promise<void> {
    try {
      await this.client.removeObject(bucket, key);
      this.logger.debug(`deleteObject bucket=${bucket} key=${key}`);
    } catch (err) {
      this.logger.warn(`No se pudo borrar ${bucket}/${key}: ${String(err)}`);
    }
  }

  /** Lista los objetos de un bucket (recursivo). Usado por T-114 cron. */
  async listObjects(
    bucket: string,
    prefix = '',
  ): Promise<Array<{ key: string; lastModified: Date; size: number }>> {
    const out: Array<{ key: string; lastModified: Date; size: number }> = [];
    return new Promise((resolve, reject) => {
      const stream = this.client.listObjectsV2(bucket, prefix, true);
      stream.on('data', (obj) => {
        if (obj.name) {
          out.push({
            key: obj.name,
            lastModified: obj.lastModified ?? new Date(0),
            size: obj.size ?? 0,
          });
        }
      });
      stream.on('end', () => resolve(out));
      stream.on('error', reject);
    });
  }
}
