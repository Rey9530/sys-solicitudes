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
  // datasource se sobreescribe por CLI flags (--url, --direct-url)
  // o por variables de entorno. Mantenemos esta sección explícita.
  experimental: {
    adapter: true,
  },
});
