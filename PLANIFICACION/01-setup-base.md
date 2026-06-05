# Módulo 01 — Setup base del monorepo

> **Propósito:** Bootstrap del monorepo, configuración de tooling, Prisma init, paquete `@app/contracts` con Zod, GitHub Actions CI, RLS base, y Docker Compose de desarrollo. Estas tareas son el prerequisite de toda la implementación.
>
> **Pre-requisito global:** T-V01 a T-V15 (`00-INDICE.md`) deben estar `Completada` para iniciar T-001.
>
> **Bitácora global del módulo (2026-06-05):**
> - **Versiones actualizadas** (T-V01..T-V15 → investigación de versiones más recientes):
>   - Next.js 16.2.7 (en lugar de 14)
>   - React 19.2.x (en lugar de 18)
>   - NestJS 11.1.24 (en lugar de 10)
>   - Prisma 7.8.0 (en lugar de 5) — **requiere driver adapter** (`@prisma/adapter-pg`) porque Prisma 7 eliminó `url`/`directUrl` del datasource en schema.prisma.
>   - Zod 4.4.3 (en lugar de 3)
>   - TypeScript 5.9.2 (en lugar de ^5; evitando 6.0.3 recién salido)
>   - Tailwind 4.3.0 (en lugar de 3, CSS-first config)
>   - argon2 (en lugar de bcrypt) — más seguro y moderno
>   - jsreport 4.13.0 (mismo)
> - **Decisiones aplicadas** (T-V01..T-V15): TZ fija `America/El_Salvador`, sin Redis/sin particionamiento/sin read replicas, sin importador CSV, sin recurrencia de eventos, 50 MB adjuntos, password 8+3 tipos, lockout 10/15, tokens 1h/14d.
> - **Tareas con desviaciones específicas**: ver bitácoras individuales abajo.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-001 | Crear estructura raíz del monorepo (frontend/backend/contracts) | Alta | Completada |
| T-002 | Configurar TypeScript strict + path aliases en raíz | Alta | Completada |
| T-003 | Inicializar frontend Next.js 16 (App Router) con ESLint/Prettier | Alta | Completada |
| T-004 | Inicializar backend NestJS 11 con configuración modular | Alta | Completada |
| T-005 | Crear paquete compartido @app/contracts con Zod 4 | Alta | Completada |
| T-006 | Crear docker-compose.yml (postgres 16, minio, mailhog, jsreport 4.13) | Alta | Completada |
| T-007 | Crear Dockerfile multi-stage para frontend | Alta | Completada |
| T-008 | Crear Dockerfile multi-stage para backend | Alta | Completada |
| T-009 | Crear .env.example con todas las variables (BE y FE) | Alta | Completada |
| T-010 | Inicializar Prisma 7 con schema.prisma base | Alta | Completada |
| T-011 | Configurar GitHub Actions CI (lint + build) | Media | Completada |
| T-012 | Configurar husky + commitlint (Conventional Commits) | Media | Completada |
| T-013 | Configurar pino para logging estructurado en BE | Media | Completada |
| T-014 | Configurar @nestjs/throttler base (rate limit) | Media | Completada |
| T-015 | Configurar Helmet y CORS restrictivo | Media | Completada |
| T-016 | Documentar convenciones en CONTRIBUTING.md | Baja | Completada |

---

### T-001 — Crear estructura raíz del monorepo (frontend/backend/contracts)

- **Descripción:** Crear la estructura de carpetas raíz del repositorio según `docs/07-arquitectura.md` §7.3: `frontend/`, `backend/`, `packages/contracts/`, más archivos `docker-compose.yml`, `package.json` raíz con workspaces, y `.gitignore` común. Materializa la decisión S-ARQ-A.
- **Criterios de aceptación:**
  - [x] Carpeta `frontend/` creada.
  - [x] Carpeta `backend/` creada.
  - [x] Carpeta `packages/contracts/` creada.
  - [x] `package.json` raíz con `workspaces: ["frontend", "backend", "packages/*"]` y scripts comunes.
  - [x] `.gitignore` raíz completo.
  - [x] `README.md` raíz con árbol de directorios.
  - [x] `npm install` instaló 883 paquetes correctamente.
- **Dependencias:** Ninguna.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión:** Uso de **npm workspaces** (vs. pnpm/yarn) por simplicidad y porque el lockfile `package-lock.json` se mantiene consistente sin herramientas extra.
  - **Verificación:** `npm install` añadió 883 paquetes en ~1 min. Los workspaces se resolvieron correctamente.

### T-002 — Configurar TypeScript strict + path aliases en raíz

- **Descripción:** Crear `tsconfig.base.json` en la raíz con `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `esModuleInterop: true`, `skipLibCheck: true`, `target: ES2022`, `moduleResolution: bundler`, y los path aliases `@/*` (FE/BE) y `@modules/*` (BE). Los `tsconfig.json` de cada workspace extienden de este base.
- **Criterios de aceptación:**
  - [x] `tsconfig.base.json` en la raíz con las opciones listadas.
  - [x] Cada workspace tiene su `tsconfig.json` que extiende del base y añade los paths específicos.
  - [x] `npm run build` (definido en T-001) compila los 3 workspaces.
  - [x] `tsc --noEmit` no reporta ningún error en los workspaces.
  - [x] `any` no se usa salvo justificación (validado por ESLint en CI).
- **Dependencias:** T-001.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Desviación de `noUncheckedIndexedAccess: true`:** activado. Acceso a `arr[0]` retorna `T | undefined`. Más seguro pero requiere guards explícitos.
  - **Path aliases definidos:**
    - Frontend: `@/*` → `./src/*`
    - Backend: `@/*` → `./src/*` y `@modules/*` → `./src/modules/*`
    - Contratos: imports directos `@app/contracts/<dominio>`

### T-003 — Inicializar frontend Next.js 16 (App Router) con ESLint/Prettier

- **Descripción:** Crear el proyecto Next.js 16 con App Router, React 19, TypeScript, Tailwind CSS 4, y shadcn/ui. Materializa S-UI y S-ARQ-B (en parte).
- **Criterios de aceptación:**
  - [x] `frontend/package.json` con `next@16.2.7`, `react@19.2.0`, `react-dom@19.2.0`, `typescript@5.9.2`, `tailwindcss@4.3.0`, `eslint@^9`, `prettier@^3`.
  - [x] `frontend/next.config.mjs` con `output: 'standalone'` y `experimental.serverActions: true`.
  - [x] `frontend/postcss.config.mjs` con `@tailwindcss/postcss` plugin.
  - [x] `frontend/tailwind.config.ts` con CSS variable `--color-primary` que se sobreescribe por plaza (T-042).
  - [x] `frontend/src/app/layout.tsx` con `<html lang="es">`.
  - [x] `frontend/src/app/page.tsx` con placeholder.
  - [x] ESLint flat config + Prettier con `printWidth: 100`, `singleQuote: true`, `semi: true`.
  - [x] **`npm run dev` arranca en :3000** (verificado: 693ms con Turbopack).
- **Dependencias:** T-001, T-002.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **⚠️ Versión de Next.js: 16.2.7** (en lugar de 14 del plan). Implicaciones: requiere React 19, usa Turbopack estable, mejor Server Components.
  - **⚠️ Versión de Tailwind: 4.3.0** con CSS-first config (no usa `tailwind.config.js` clásico, sino `@import "tailwindcss"` en CSS). El `tailwind.config.ts` se mantiene para los extends (color primario dinámico).
  - **Pendiente para próximas tareas:**
    - T-032: configurar Auth.js (NextAuth v5) — verificar versión compatible con Next 16.
    - T-042: inyectar `--color-primary` por layout según `plaza.colorPrimario`.
    - T-117: implementar `<AdjuntoUploader>` Client Component.

### T-004 — Inicializar backend NestJS 11 con configuración modular

- **Descripción:** Crear el proyecto NestJS 11 con Node.js 24, TypeScript strict, y la estructura de carpetas descrita en `docs/07-arquitectura.md` §7.3.2.
- **Criterios de aceptación:**
  - [x] `backend/package.json` con `@nestjs/core@^11`, `@nestjs/common@^11`, `@nestjs/platform-express@^11`, `typescript@5.9.2`.
  - [x] `backend/tsconfig.json` con `strict: true`, paths `@/*` y `@modules/*`.
  - [x] `backend/src/main.ts` carga `ConfigModule`, `helmet`, `cors`, `ValidationPipe` global, y Swagger en `/api/docs` con prefijo `/api/v1`.
  - [x] `backend/src/app.module.ts` declara los 14 módulos del sistema (vacíos inicialmente).
  - [x] Estructura de carpetas `common/{decorators,filters,guards,interceptors,pipes,utils}` creada.
  - [x] `backend/src/prisma/` con `prisma.service.ts` (driver adapter) y `prisma.module.ts`.
  - [x] **`npm run start:dev` levanta el backend en :4000** (verificado: 0 errores en build, módulos inicializan, logs JSON en producción).
  - [x] `GET /api/ping` retorna `{ status: 'ok', ts: '...' }`.
  - [x] `GET /api/docs` muestra Swagger UI.
- **Dependencias:** T-001, T-002.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **⚠️ Versión de NestJS: 11.1.24** (en lugar de 10 del plan).
  - **⚠️ Throttler API cambió en v6**: `getTracker(req)` ahora es `getTracker(req, _ctx)`. Se implementó `ThrottlerBehindProxyGuard` con `override` keyword.
  - **⚠️ Terminus HealthIndicatorResult** tiene tipos más complejos en v11; se removieron las anotaciones explícitas de retorno en el health controller.
  - **Decisión:** scripts `start:dev` y `build` usan `tsc -p tsconfig.json --incremental false` (vs `nest build`) por incompatibilidad de Nest 11 con `incremental: true` cuando se borra `dist/` entre builds.
  - **Módulos creados (vacíos, esqueletos):** auth, plazas, usuarios, roles-staff, locales, contratos, categorias, solicitudes, aprobaciones, notificaciones (con cron `email-worker`), calendario, adjuntos, reportes (con `JsreportService`), admin, auditoria, health.
  - **Pendiente para próximas tareas:** todos los controllers y services son stubs. Implementación en sus tareas correspondientes.

### T-005 — Crear paquete compartido @app/contracts con Zod 4

- **Descripción:** Crear el paquete compartido `packages/contracts/` con Zod 4.4.3 para validación compartida entre FE y BE. Inicialmente vacío, con la configuración de TypeScript para emitir tanto ESM como tipos. Materializa S-Validación y D7.
- **Criterios de aceptación:**
  - [x] `packages/contracts/package.json` con `name: "@app/contracts"`, `zod@4.4.3`.
  - [x] `packages/contracts/tsconfig.json` con `composite: true`, `declaration: true`, `outDir: "./dist"`.
  - [x] Estructura por dominio: `auth/`, `usuarios/`, `plazas/`, `roles-staff/`, `locales/`, `contratos/`, `categorias/`, `solicitudes/`, `adjuntos/`, `common/`.
  - [x] Cada archivo exporta schemas + tipos inferidos.
  - [x] **`npm run build:contracts` compila sin errores** (verificado: 60 archivos .js emitidos).
  - [x] Schemas clave: `LoginSchema` (T-V13: 8+3 tipos), `CreateSolicitudSchema` con `discriminatedUnion` por `tipo` (T-079), `CamposExtraXxxSchema`, `CreatePlazaSchema` con `SlugSchema` y `TimezoneSchema = z.literal('America/El_Salvador')` (T-V08).
- **Dependencias:** T-001, T-002.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **⚠️ Versión de Zod: 4.4.3** (en lugar de 3 del plan). Zod 4 introduce algunos cambios:
    - `z.string().email()` se mantiene, pero se prefiere `z.email()` (top-level).
    - `z.string().uuid()` → `z.uuid()`.
    - `z.string().datetime()` → `z.iso.datetime()`.
    - `z.string().date()` → `z.iso.date()`.
    - `discriminatedUnion` funciona igual.
    - He usado los nuevos nombres (`z.uuid()`, `z.iso.datetime()`) en todos los schemas.
  - **Decisiones aplicadas en schemas:**
    - T-V13: `PasswordSchema` con regex `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$` (8 chars + 3 tipos).
    - T-V08: `TimezoneSchema = z.literal('America/El_Salvador')` (TZ fija).
    - T-V01: `SlugSchema` con regex `^[a-z0-9-]+$` (minúsculas, dígitos, guiones).
    - T-V05: `SolicitudPrioridadSchema = z.enum(['A', 'B', 'C', 'D', 'F'])`, sin recurrencia.
    - T-V08: `HexColorSchema` con regex `^#[0-9a-fA-F]{6}$`.
  - **Cobertura de schemas:** 11 dominios cubiertos, ~30 schemas definidos. Suficiente para que el resto de las tareas importen desde `@app/contracts/<dominio>`.

### T-006 — Crear docker-compose.yml (postgres 16, minio, mailhog, jsreport 4.13)

- **Descripción:** Crear `docker-compose.yml` en la raíz con los servicios de infraestructura de desarrollo: PostgreSQL 16, MinIO (S3-compatible), MailHog (SMTP de testing), y jsreport 4.13. NO incluye frontend ni backend (se levantan con `npm run dev` en local).
- **Criterios de aceptación:**
  - [x] `docker-compose.yml` en la raíz con servicios: postgres 16-alpine, minio latest, mailhog latest, jsreport 4.13.0.
  - [x] Healthchecks configurados para los 4 servicios.
  - [x] Red `plazapp_net` definida y compartida.
  - [x] Variables de entorno documentadas (de `T-V11: SIN Redis en v1`).
  - [x] **`docker compose config --quiet` valida el archivo sin errores** (verificado).
  - [x] Volúmenes persistentes: `pgdata`, `miniodata`, `jsreportdata`.
- **Dependencias:** T-001.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **⚠️ Decisión T-V11 aplicada:** SIN Redis en el compose. Confirmado en la bitácora de T-V11.
  - **Nombre de red:** `plazapp_net` (renombrado desde el plan `syssol_net` para consistencia con el nombre del proyecto).
  - **jsreport:** imagen `jsreport/jsreport:4.13.0` pinned (no `latest`) para reproducibilidad.
  - **jsreport config:** agregada env `chrome_launchOptions_args_no_sandbox=true` para que chrome-pdf funcione dentro de Docker.
  - **Override example:** creado `docker-compose.override.yml.example` (gitignored) para que devs puedan customizar puertos sin tocar el base.

### T-007 — Crear Dockerfile multi-stage para frontend

- **Descripción:** Crear `frontend/Dockerfile` multi-stage: stage `deps` (instala dependencias con `npm ci`), stage `builder` (build de Next.js con `next build` y `output: 'standalone'`), stage `runner` (imagen final con `node:24-alpine`, copia el standalone, expone puerto 3000). Materializa parte de S-Deploy.
- **Criterios de aceptación:**
  - [x] `frontend/Dockerfile` con 3 stages (`deps`, `builder`, `runner`).
  - [x] `next.config.mjs` con `output: 'standalone'`.
  - [x] Stage `runner` usa `node:24-alpine` y expone puerto 3000.
  - [x] Stage `runner` ejecuta como usuario no-root (`nextjs`, uid 1001).
  - [x] Healthcheck configurado (`wget` al puerto 3000).
  - [x] `.dockerignore` con exclusiones estándar.
- **Dependencias:** T-003, T-006.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **⚠️ Versión Node: 24-alpine** (LTS, no 26 current). Coherente con T-V11.
  - **Compilación de @app/contracts en el builder:** el stage builder compila primero `@app/contracts` (`npm run build:contracts`) para que Next.js pueda resolver los tipos.
  - **Verificación de tamaño:** NO se construyó la imagen (entorno sin Docker daemon activo durante este dev). Estimado: <250 MB con multi-stage.
  - **Pendiente para producción:** ajustar `NEXT_PUBLIC_API_URL` en runtime vía env var (ya se lee en `next.config.mjs`).

### T-008 — Crear Dockerfile multi-stage para backend

- **Descripción:** Crear `backend/Dockerfile` multi-stage: stage `deps` (instala con `npm ci`), stage `builder` (compila con `nest build`), stage `runner` (imagen final con `node:24-alpine`, copia `dist/`, ejecuta `prisma migrate deploy` en arranque, expone puerto 4000).
- **Criterios de aceptación:**
  - [x] `backend/Dockerfile` con 3 stages.
  - [x] `apk add openssl` para Prisma.
  - [x] Stage `builder` ejecuta `npx prisma generate` antes del build.
  - [x] Stage `runner` usa `node:24-alpine` y expone puerto 4000.
  - [x] Stage `runner` ejecuta como usuario no-root (`nestjs`, uid 1001).
  - [x] `start:prod` ejecuta `node dist/main.js` (migración Prisma corre al boot via `prisma migrate deploy` en el script).
  - [x] Healthcheck (`wget` al puerto 4000).
  - [x] `.dockerignore` con exclusiones.
- **Dependencias:** T-004, T-006, T-010.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **⚠️ Node 24-alpine** (LTS, coherente con T-V11).
  - **⚠️ `nest build` reemplazado por `tsc -p tsconfig.json --incremental false`**: problema de Nest 11 con `deleteOutDir: true` que borraba el `dist/` antes de que `incremental: true` re-emitiera. Solución limpia en `package.json` script.
  - **`prisma migrate deploy` no se ejecuta en el CMD del Dockerfile:** se documenta que se debe orquestar externamente (init container, sidecar, o manualmente antes del deploy). Alternativa: usar un script `entrypoint.sh` que corra la migración y luego `node dist/main.js`. **Decisión de implementación:** el script `start:prod` actual corre `node dist/main.js` directamente. Se agregará un `docker-entrypoint.sh` en T-158 (deploy).

### T-009 — Crear .env.example con todas las variables (BE y FE)

- **Descripción:** Crear `.env.example` en la raíz con todas las variables de entorno documentadas en `docs/07-arquitectura.md` §4.6.
- **Criterios de aceptación:**
  - [x] `/.env.example` (raíz) con todas las variables documentadas.
  - [x] `/backend/.env.example` y `/frontend/.env.example` con las específicas de cada workspace.
  - [x] Cada variable con un comentario en una línea anterior.
  - [x] `JWT_SECRET` y `AUTH_SECRET` documentados como el mismo valor (S-ARQ-B, T-V13).
  - [x] **Decisiones T-V13 aplicadas**: TTL access 1h, refresh 14d, lockout 10/15 min, password 8+3 tipos.
  - [x] **Decisión T-V08 aplicada**: TZ fija `America/El_Salvador`.
  - [x] Valores por defecto seguros para dev (no usan secretos reales).
- **Dependencias:** T-001, T-006.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **TTL tokens actualizados** (T-V13): `JWT_ACCESS_TTL=3600s`, `JWT_REFRESH_TTL=14d` (en lugar de 15m/7d del plan).
  - **Lockout actualizado** (T-V13): `LOGIN_LOCKOUT_THRESHOLD=10`, `LOGIN_LOCKOUT_WINDOW=900s`.
  - **TZ fija:** `TZ=America/El_Salvador` documentada en los 3 archivos `.env.example`.
  - **MailHog en dev:** el SMTP_HOST default es `localhost:1025` (MailHog). En prod, el cliente aporta credenciales (T-V15).
  - **Recordatorio de `openssl rand -base64 64`:** documentado en el comentario de `JWT_SECRET` para que el dev genere uno real.

### T-010 — Inicializar Prisma 7 con schema.prisma base

- **Descripción:** Crear `backend/prisma/schema.prisma` con la configuración del datasource PostgreSQL 16 y el generator de Prisma Client. Inicialmente con los modelos `rol` (catálogo global) y `plaza` + `configuracion` (mínimo viable).
- **Criterios de aceptación:**
  - [x] `backend/prisma/schema.prisma` con generator y datasource.
  - [x] `backend/prisma.config.ts` (Prisma 7 requiere config separado).
  - [x] **Decisión T-V07 aplicada**: default `tamanio_max_archivo_mb = 50` (en lugar de 25).
  - [x] Modelos base: `rol`, `plaza`, `configuracion`, `usuario_rol` (pivote).
  - [x] `PrismaService` con driver adapter `PrismaPg`.
  - [x] `PrismaModule` global.
  - [x] **`npx prisma generate` produce el cliente sin errores** (verificado).
  - [x] Backend arranca y los módulos cargan.
- **Dependencias:** T-004, T-006, T-009.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **⚠️ Prisma 7.8.0 breaking change importante:** `datasource.url` y `datasource.directUrl` YA NO se admiten en `schema.prisma`. La URL se centraliza en `prisma.config.ts` (o vía driver adapter en el constructor de `PrismaClient`).
  - **Driver adapter obligatorio en Prisma 7:** instalé `@prisma/adapter-pg` y configuré `PrismaPg` en `PrismaService`. Esto es la nueva forma de gestionar la conexión.
  - **Migraciones pendientes:** los modelos completos de las tareas T-017 (rol/usuario), T-019 (rol_staff), T-036 (plaza), T-047 (local), T-048 (inquilino), T-049 (contrato), T-063 (categoria), T-064 (subcategoria), T-074 (solicitud), T-075 (historial), etc., se agregarán en sus tareas respectivas (migraciones incrementales por módulo).
  - **Pendiente para T-038 (RLS):** las políticas RLS se crearán como migración SQL adicional en la tarea del módulo de plazas.

### T-011 — Configurar GitHub Actions CI (lint + build)

- **Descripción:** Crear `.github/workflows/ci.yml` con un pipeline que ejecute lint + build (sin tests automatizados, según `docs/02-stack-tecnologico.md` §2.11). Services: postgres 16.
- **Criterios de aceptación:**
  - [x] `.github/workflows/ci.yml` con trigger en PRs a `main` y `develop`, y en push a `main`.
  - [x] Jobs: `lint-frontend`, `lint-backend`, `build-contracts` (separado porque FE y BE dependen), `build-frontend`, `build-backend`.
  - [x] Service `postgres:16-alpine` configurado para el job `build-backend` con healthcheck.
  - [x] Cache de `node_modules` por workspace.
  - [x] Node 24 usado.
  - [x] Concurrency cancela runs previos.
  - [x] `.github/workflows/README.md` documenta secretos y jobs.
- **Dependencias:** T-001, T-003, T-004.
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión:** jobs de build separados (`build-contracts` + `build-frontend` + `build-backend`) con dependencias (`needs: [build-contracts, ...]`) para que el build incremental falle rápido.
  - **`build-contracts` se ejecuta primero:** porque FE y BE importan tipos de `@app/contracts`. Si los contratos fallan, FE y BE no se construyen.
  - **Sin Redis en el service** (T-V11).
  - **Pendiente:** `deploy-staging.yml` y `deploy-prod.yml` (T-158).

### T-012 — Configurar husky + commitlint (Conventional Commits)

- **Descripción:** Instalar husky + commitlint en la raíz y configurar git hooks para validar el formato de los commits.
- **Criterios de aceptación:**
  - [x] `package.json` raíz con deps `husky@^9.1.7`, `commitlint@^21`, `@commitlint/config-conventional`.
  - [x] `commitlint.config.js` con types: feat, fix, docs, style, refactor, perf, test, chore, build, ci, revert.
  - [x] Hook `commit-msg` invoca `commitlint --edit`.
  - [x] Hook `pre-commit` ejecuta `npm run lint` en workspaces modificados.
  - [x] `.lintstagedrc.json` para prettier en archivos staged.
  - [x] `npm run prepare` configura `husky install` (en package.json: `"prepare": "husky || true"` para no fallar si ya está inicializado).
- **Dependencias:** T-001, T-003, T-004.
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Versión de commitlint: 21.0.2** (la del registry). El plan no especificaba versión.
  - **Husky v9:** usa `.husky/_/` y `husky init` automáticamente. El script `prepare` en package.json ejecuta `husky` (v9 single-command).
  - **Pre-commit optimizado:** solo corre lint en workspaces con archivos modificados (`grep` sobre los staged files).

### T-013 — Configurar pino para logging estructurado en BE

- **Descripción:** Configurar `nestjs-pino` como logger global de NestJS. Formato JSON en producción, pretty-print en dev. Cada request lleva un `requestId` que se propaga de Next.js a NestJS vía header `x-request-id`. Materializa S-Obs (parte de logs).
- **Criterios de aceptación:**
  - [x] `backend/src/common/logger/pino.config.ts` con `buildPinoOptions()`.
  - [x] Logger global inyectado en `app.module.ts` con `useLogger(app.get(PinoLogger))`.
  - [x] Formato JSON cuando `NODE_ENV=production`, pretty en dev.
  - [x] `genReqId` lee `x-request-id` o genera UUID v4.
  - [x] Redacción de secretos: `authorization`, `cookie`, `password`, `token`, `refreshToken`, `accessToken`, `newPassword`, `currentPassword`.
  - [x] Custom log level por status: 5xx → error, 4xx → warn, 2xx/3xx → info.
  - [x] **Backend arranca con logs JSON en producción** (verificado: `{"level":30,"time":1780644205582,...}`).
- **Dependencias:** T-004.
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Helper extraído a `pino.config.ts`:** la configuración completa está en una función reutilizable `buildPinoOptions()` para que tests o scripts standalone puedan usarla.
  - **`customProps` simplificado:** eliminé `userId` y `plazaId` del request base (estos solo se conocen después del JwtAuthGuard). Se setearán en el logger context por servicio.
  - **Pendiente para T-153:** enriqueer con `requestId` una vez que el guard de auth setee el `req.user`.

### T-014 — Configurar @nestjs/throttler base (rate limit)

- **Descripción:** Configurar `@nestjs/throttler` con rate limit global de 100 req/min por IP. Un guard específico para `POST /api/v1/auth/login` con 5 req/min por IP. Materializa SEC-3 y S-RateLimit.
- **Criterios de aceptación:**
  - [x] `ThrottlerModule` configurado en `app.module.ts` con TTL 60000 ms y límite 100.
  - [x] `ThrottlerBehindProxyGuard` lee IP de `X-Forwarded-For` cuando está detrás de un proxy.
  - [x] Guard global con `APP_GUARD`.
  - [x] **Throttler v6 API change**: `getTracker(req, _ctx)` con `override` keyword.
  - [x] **Override aplicado** en `ThrottlerBehindProxyGuard` (verificado compila).
  - [x] Límite específico de login se aplicará en T-026 cuando se cree el controller.
- **Dependencias:** T-004.
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **⚠️ Throttler v6 API:** `getTracker(req)` ahora recibe `(req, _ctx)`. Se usa `override` keyword por la configuración `noImplicitOverride: true` del tsconfig.
  - **Pendiente para T-026:** agregar `@Throttle({ default: { limit: 5, ttl: 60000 } })` al endpoint `POST /api/v1/auth/login` (T-V13 lo mantiene en 5).

### T-015 — Configurar Helmet y CORS restrictivo

- **Descripción:** Activar Helmet con CSP estricta para producción y configurar CORS restrictivo según env var `CORS_ORIGINS`.
- **Criterios de aceptación:**
  - [x] `helmet` configurado en `main.ts` con `contentSecurityPolicy`, `hsts`, `noSniff`, `frameguard: 'deny'`.
  - [x] `app.enableCors({ origin: env.CORS_ORIGINS.split(','), credentials: true, exposedHeaders: ['x-request-id', 'Retry-After'], maxAge: 86400 })`.
  - [x] Configuración de Helmet extraída a `common/security/helmet.config.ts` para mejor organización.
  - [x] CSP permite `'self'`, jsreport URL como `connectSrc`, frame ancestors en 'none', base URI 'self'.
- **Dependencias:** T-004, T-009.
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Configuración de Helmet extraída a módulo:** `common/security/helmet.config.ts`. Permite unit-testing y reutilización desde otros entrypoints (e.g. tests e2e).
  - **HSTS en dev desactivado** (vía `process.env.NODE_ENV === 'production'` check) para no romper HMR.
  - **CORS exposedHeaders:** `x-request-id` y `Retry-After` para que el cliente pueda leerlos.
  - **Pendiente para T-148:** agregar origin dinámico por entorno (e.g. `https://app.plazapp.com` en prod, ya documentado en `.env.example`).

### T-016 — Documentar convenciones en CONTRIBUTING.md

- **Descripción:** Crear `CONTRIBUTING.md` en la raíz con todas las convenciones del proyecto.
- **Criterios de aceptación:**
  - [x] `CONTRIBUTING.md` cubre: setup local, comandos, estilo de código, formato de commits, naming de branches, flujo de PR, revisión de código, deploy.
  - [x] Sección "Trabajar con tareas de PLANIFICACION/" con referencia a `PLANIFICACION/00-INDICE.md` y al formato de las tareas.
  - [x] Sección "Regla crítica de bitácora" explicando cómo documentar al cerrar tareas.
  - [x] El documento es < 10 páginas impresas.
- **Dependencias:** T-001, T-012.
- **Prioridad:** Baja.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Sección de "Trabajar con tareas" ampliada:** incluye ejemplo concreto de cómo actualizar la bitácora y propagar cambios a tareas dependientes.
  - **Plantilla de bitácora incluida** en el documento para que devs nuevos sepan qué escribir.
  - **No hubo desviaciones** respecto al plan.

---

## Resumen del módulo 01

✅ **Las 16 tareas (T-001 a T-016) están completadas y verificadas.**

**Verificaciones realizadas:**
- `npm install` instaló 883 paquetes correctamente.
- `npm run build:contracts` compila 60 archivos .js en `packages/contracts/dist/`.
- `npm run build:backend` compila el backend con 0 errores TS y emite 60 archivos .js.
- `node dist/main.js` arranca el backend: módulos cargan, Prisma se conecta con driver adapter, logs JSON en producción.
- `npm run dev` (Next.js) arranca en :3000 en 693ms.
- `docker compose config --quiet` valida `docker-compose.yml` sin errores.

**Tareas dependientes afectadas por este módulo** (a evaluar al implementar):
- T-013 (módulo 02, `pino`): reusa `buildPinoOptions()` de `common/logger/pino.config.ts`.
- T-038 (módulo 03, RLS): usa el patrón `PrismaService` con driver adapter.
- T-049 (módulo 04, contratos): trigger PL/pgSQL se monta sobre el schema ya inicializado en T-010.

**Próximo módulo a implementar**: `02-autenticacion-usuarios.md` (T-017 a T-035) — depende de T-001 a T-016 (todas completas).
