import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Cliente Prisma ADMIN (superusuario `syssol`, DATABASE_ADMIN_URL).
 *
 * Bypassa RLS por diseño (T-038). Úsese SOLO en:
 *   - operaciones cross-tenant del `superadmin` (p. ej. listar todas las plazas);
 *   - flujos de auth pre-sesión (login por email, refresh/reset por token), que
 *     ocurren sin contexto de plaza y romperían con RLS activa.
 *
 * Para datos con scope de plaza, preferir `PrismaService.withTenant(...)`.
 * Ver PLANIFICACION/03-plazas-multitenant.md (T-038).
 */
@Injectable()
export class PrismaAdminService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaAdminService.name);

  constructor() {
    const connectionString =
      process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_ADMIN_URL/DATABASE_URL no está definida en el entorno');
    }
    const adapter = new PrismaPg({ connectionString });
    super({
      adapter,
      log:
        process.env.NODE_ENV === 'production'
          ? [{ emit: 'event', level: 'error' }]
          : [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma (admin, syssol) conectado a la base de datos');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma (admin) desconectado');
  }
}
