import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { durationToSeconds } from '../utils/duration';

/**
 * Cliente MinIO (S3-compatible) — versión mínima para el módulo 03 (logo de
 * plaza, T-041). El cliente completo (adjuntos, cuarentena, antivirus) es del
 * módulo 08 (T-110). Buckets por tenant: `plaza-assets-{plazaId}`.
 */
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: MinioClient;
  private readonly presignTtl: number;
  private readonly region: string;

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
  }

  onModuleInit(): void {
    this.logger.log('MinIO client inicializado');
  }

  /** Bucket de assets de branding por plaza. */
  bucketForPlaza(plazaId: string): string {
    return `plaza-assets-${plazaId}`;
  }

  async ensureBucket(bucket: string): Promise<void> {
    const exists = await this.client.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(bucket, this.region);
    }
  }

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
  }

  /** URL pre-firmada de lectura (TTL por MINIO_PRESIGNED_URL_TTL, 15 min). */
  async presignedGetUrl(bucket: string, key: string): Promise<string> {
    return this.client.presignedGetObject(bucket, key, this.presignTtl);
  }

  /** Mueve un objeto a la cuarentena de la plaza (best-effort, no crítico). */
  async moveToQuarantine(plazaId: string, bucket: string, key: string): Promise<void> {
    try {
      const quarantine = `quarantine-${plazaId}`;
      await this.ensureBucket(quarantine);
      await this.client.copyObject(quarantine, key, `/${bucket}/${key}`);
      await this.client.removeObject(bucket, key);
    } catch (err) {
      this.logger.warn(`No se pudo mover a cuarentena ${bucket}/${key}: ${String(err)}`);
    }
  }
}
