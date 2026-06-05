import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Wrapper sobre PrismaClient 7.
 *
 * Prisma 7 ya no soporta `datasource.url` en schema.prisma; usa driver adapters.
 * Aquí usamos `PrismaPg` (basado en `pg`) para PostgreSQL.
 *
 * Ver PLANIFICACION/01-setup-base.md (T-010) y 13-observabilidad-despliegue.md (T-154).
 *
 * Las transacciones con RLS y `SET LOCAL app.plaza_id` se manejan en
 * PLANIFICACION/03-plazas-multitenant.md (T-038).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL no está definida en el entorno');
    }
    const adapter = new PrismaPg({ connectionString });
    super({
      adapter,
      log: process.env.NODE_ENV === 'production'
        ? [{ emit: 'event', level: 'error' }]
        : [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma conectado a la base de datos');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma desconectado');
  }
}
