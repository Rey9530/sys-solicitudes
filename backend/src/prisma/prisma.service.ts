import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Cliente Prisma de la APLICACIÓN.
 *
 * Conecta con el rol `syssol_app` (DATABASE_URL), que NO tiene BYPASSRLS: las
 * políticas RLS (T-038) aplican. Para leer/escribir datos con scope de plaza se
 * debe usar `withTenant(plazaId, fn)`, que abre una transacción y fija
 * `app.plaza_id` (= SET LOCAL) antes de ejecutar las queries.
 *
 * Sin `withTenant` (sin contexto), RLS es fail-closed: las tablas de negocio
 * devuelven 0 filas. Las operaciones cross-tenant (superadmin) y los flujos de
 * auth pre-sesión usan `PrismaAdminService` (superusuario, bypassa RLS).
 *
 * Ver PLANIFICACION/03-plazas-multitenant.md (T-038).
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
      log:
        process.env.NODE_ENV === 'production'
          ? [{ emit: 'event', level: 'error' }]
          : [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma (app, syssol_app) conectado a la base de datos');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma (app) desconectado');
  }

  /**
   * Ejecuta `fn` dentro de una transacción con el contexto de tenant activo
   * (`SET LOCAL app.plaza_id`), de modo que RLS filtra por esa plaza.
   *
   * `set_config(..., true)` es SET LOCAL parametrizado (a prueba de inyección).
   * El `plazaId` debe venir del JWT (nunca del body).
   */
  async withTenant<T>(
    plazaId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.plaza_id', ${plazaId}, true)`;
      return fn(tx);
    });
  }
}
