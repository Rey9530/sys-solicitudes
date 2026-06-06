import { Global, Module } from '@nestjs/common';
import { MinioService } from './minio.service';

/** Storage S3-compatible (MinIO) disponible globalmente. */
@Global()
@Module({
  providers: [MinioService],
  exports: [MinioService],
})
export class StorageModule {}
