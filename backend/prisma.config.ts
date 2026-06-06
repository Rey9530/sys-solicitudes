import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 config.
 *
 * En Prisma 7 la URL de la BD se centraliza aquí (no en `datasource db` del schema).
 * Para migraciones se usa `directUrl` (cuando hay un connection pooler como PgBouncer).
 *
 * Ver PLANIFICACION/01-setup-base.md (T-010) y docs/04-modelo-de-datos.md.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'ts-node prisma/seed.ts',
  },
  // Prisma 7 exige datasource.url en el config para migrate/introspect.
  // Las migraciones usan la conexión ADMIN (superusuario syssol): crean el rol
  // `syssol_app`, las políticas RLS y las tablas. El runtime de la app usa
  // DATABASE_URL (syssol_app, sin BYPASSRLS). Ver T-038.
  datasource: {
    url: process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL,
  },
  experimental: {
    adapter: true,
  },
});
