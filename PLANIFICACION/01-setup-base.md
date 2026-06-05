# Módulo 01 — Setup base del monorepo

> **Propósito:** Bootstrap del monorepo, configuración de tooling, Prisma init, paquete `@app/contracts` con Zod, GitHub Actions CI, RLS base, y Docker Compose de desarrollo. Estas tareas son el prerequisite de toda la implementación.
>
> **Pre-requisito global:** T-V01 a T-V15 (`00-INDICE.md`) deben estar `Completada` para iniciar T-001.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-001 | Crear estructura raíz del monorepo (frontend/backend/contracts) | Alta | Pendiente |
| T-002 | Configurar TypeScript strict + path aliases en raíz | Alta | Pendiente |
| T-003 | Inicializar frontend Next.js 14 (App Router) con ESLint/Prettier | Alta | Pendiente |
| T-004 | Inicializar backend NestJS 10 con configuración modular | Alta | Pendiente |
| T-005 | Crear paquete compartido @app/contracts con Zod | Alta | Pendiente |
| T-006 | Crear docker-compose.yml (postgres 16, minio, mailhog, jsreport 4.13) | Alta | Pendiente |
| T-007 | Crear Dockerfile multi-stage para frontend | Alta | Pendiente |
| T-008 | Crear Dockerfile multi-stage para backend | Alta | Pendiente |
| T-009 | Crear .env.example con todas las variables (BE y FE) | Alta | Pendiente |
| T-010 | Inicializar Prisma 7 con schema.prisma base | Alta | Pendiente |
| T-011 | Configurar GitHub Actions CI (lint + build) | Media | Pendiente |
| T-012 | Configurar husky + commitlint (Conventional Commits) | Media | Pendiente |
| T-013 | Configurar pino para logging estructurado en BE | Media | Pendiente |
| T-014 | Configurar @nestjs/throttler base (rate limit) | Media | Pendiente |
| T-015 | Configurar Helmet y CORS restrictivo | Media | Pendiente |
| T-016 | Documentar convenciones en CONTRIBUTING.md | Baja | Pendiente |

---

### T-001 — Crear estructura raíz del monorepo (frontend/backend/contracts)

- **Descripción:** Crear la estructura de carpetas raíz del repositorio según `docs/07-arquitectura.md` §7.3: `frontend/`, `backend/`, `packages/contracts/`, más archivos `docker-compose.yml`, `package.json` raíz con workspaces, y `.gitignore` común. Materializa la decisión S-ARQ-A.
- **Criterios de aceptación:**
  - [ ] Carpeta `frontend/` creada (vacía, se llena en T-003).
  - [ ] Carpeta `backend/` creada (vacía, se llena en T-004).
  - [ ] Carpeta `packages/contracts/` creada (vacía, se llena en T-005).
  - [ ] `package.json` raíz con `workspaces: ["frontend", "backend", "packages/*"]` y scripts comunes (`dev`, `build`, `lint`).
  - [ ] `.gitignore` raíz ignora `node_modules/`, `dist/`, `.next/`, `.env`, `*.log`, `coverage/`, `.DS_Store`, `Thumbs.db`.
  - [ ] `README.md` raíz actualizado con el árbol de directorios esperado.
  - [ ] Comando `npm install` desde la raíz instala dependencias de los 3 workspaces.
- **Dependencias:** Ninguna.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-002 — Configurar TypeScript strict + path aliases en raíz

- **Descripción:** Crear `tsconfig.base.json` en la raíz con `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `esModuleInterop: true`, `skipLibCheck: true`, `target: ES2022`, `moduleResolution: bundler`, y los path aliases `@/*` (FE/BE) y `@modules/*` (BE). Los `tsconfig.json` de cada workspace extienden de este base.
- **Criterios de aceptación:**
  - [ ] `tsconfig.base.json` en la raíz con las opciones listadas.
  - [ ] Cada workspace tiene su `tsconfig.json` que extiende del base y añade los paths específicos.
  - [ ] `npm run build` (definido en T-001) compila sin errores los 3 workspaces.
  - [ ] `tsc --noEmit` no reporta ningún error.
  - [ ] `any` no se usa salvo con `// eslint-disable-next-line` comentado (validado en CI).
- **Dependencias:** T-001.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-003 — Inicializar frontend Next.js 14 (App Router) con ESLint/Prettier

- **Descripción:** Crear el proyecto Next.js 14 con App Router, React 18, TypeScript, Tailwind CSS, y shadcn/ui. Configurar ESLint y Prettier con `printWidth: 100`, `singleQuote: true`, `semi: true`. Materializa S-UI y S-ARQ-B (en parte).
- **Criterios de aceptación:**
  - [ ] `frontend/package.json` con `next@^14`, `react@^18`, `react-dom@^18`, `typescript`, `tailwindcss`, `eslint`, `prettier`, `shadcn-ui` como deps.
  - [ ] `frontend/next.config.mjs` con `output: 'standalone'` (para Docker) y `experimental.serverActions: true`.
  - [ ] `frontend/tailwind.config.ts` configurado con el preset de shadcn/ui.
  - [ ] `frontend/app/layout.tsx` raíz con `<html lang="es">` y `<body>` cargando `globals.css` con directivas Tailwind.
  - [ ] `frontend/app/page.tsx` con redirección a `/login` si no autenticado o a `/dashboard` si autenticado.
  - [ ] `.eslintrc.json` con Prettier, React Hooks, Next.js, y TypeScript recommended.
  - [ ] `prettier` con `printWidth: 100`, `singleQuote: true`, `semi: true`, `tabWidth: 2`.
  - [ ] Comando `npm run dev` levanta el dev server en `:3000`.
  - [ ] Comando `npm run build` produce build sin errores.
- **Dependencias:** T-001, T-002.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-004 — Inicializar backend NestJS 10 con configuración modular

- **Descripción:** Crear el proyecto NestJS 10 con Node.js 24.X, TypeScript strict, y la estructura de carpetas descrita en `docs/07-arquitectura.md` §7.3.2: `src/{main.ts,app.module.ts,common/{decorators,filters,guards,interceptors,pipes,utils},config,modules/,prisma/}`. Configurar Swagger en `/api/docs` (S-ARQ-D).
- **Criterios de aceptación:**
  - [ ] `backend/package.json` con `@nestjs/core@^10`, `@nestjs/common@^10`, `@nestjs/platform-express@^10`, `typescript@^5`, `ts-node`, `tsconfig-paths`.
  - [ ] `backend/tsconfig.json` con `strict: true`, `paths: { "@/*": ["src/*"], "@modules/*": ["src/modules/*"] }`.
  - [ ] `backend/src/main.ts` carga `ConfigModule`, `helmet`, `cors`, `ValidationPipe` global, y Swagger en `/api/docs` con prefijo `/api/v1`.
  - [ ] `backend/src/app.module.ts` declara todos los módulos del sistema (vacíos inicialmente: auth, plazas, usuarios, roles-staff, locales, contratos, categorias, solicitudes, aprobaciones, notificaciones, calendario, adjuntos, reportes, admin).
  - [ ] Estructura de carpetas `common/{decorators,filters,guards,interceptors,pipes,utils}` creada y vacía.
  - [ ] `backend/src/prisma/` con `prisma.service.ts` y `prisma.module.ts` (vacío el schema por ahora, se llena en T-010).
  - [ ] Comando `npm run start:dev` levanta el backend en `:4000` con hot reload.
  - [ ] `GET /api/ping` retorna `{ status: 'ok', ts: '...' }`.
  - [ ] `GET /api/docs` muestra Swagger UI (vacío, sin endpoints aún).
- **Dependencias:** T-001, T-002.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-005 — Crear paquete compartido @app/contracts con Zod

- **Descripción:** Crear el paquete compartido `packages/contracts/` con Zod 3 para validación compartida entre FE y BE. Inicialmente vacío, con la configuración de TypeScript para emitir tanto ESM como tipos. Materializa S-Validación y D7.
- **Criterios de aceptación:**
  - [ ] `packages/contracts/package.json` con `name: "@app/contracts"`, `main: "./dist/index.js"`, `types: "./dist/index.d.ts"`, deps `zod`.
  - [ ] `packages/contracts/tsconfig.json` con `declaration: true`, `outDir: "./dist"`, `rootDir: "./src"`.
  - [ ] `packages/contracts/src/index.ts` exporta un módulo vacío (`export {};`) por ahora.
  - [ ] `packages/contracts/README.md` con convenciones: un archivo por dominio (`auth.ts`, `usuarios.ts`, `locales.ts`, `solicitudes.ts`, etc.) que exporta un namespace con los schemas y los tipos inferidos (`type LoginInput = z.infer<typeof LoginSchema>`).
  - [ ] El paquete se compila con `tsc` sin errores.
  - [ ] Tanto `frontend/` como `backend/` lo importan correctamente (`import { LoginSchema } from '@app/contracts/auth'`).
- **Dependencias:** T-001, T-002.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-006 — Crear docker-compose.yml (postgres 16, minio, mailhog, jsreport 4.13)

- **Descripción:** Crear `docker-compose.yml` en la raíz con los servicios de infraestructura de desarrollo: PostgreSQL 16, MinIO (S3-compatible), MailHog (SMTP de testing), y jsreport 4.13. NO incluye frontend ni backend (se levantan con `npm run dev` en local).
- **Criterios de aceptación:**
  - [ ] `docker-compose.yml` en la raíz con servicios: `postgres` (imagen `postgres:16-alpine`, puerto 5432, volumen `pgdata`), `minio` (imagen `minio/minio:latest`, puertos 9000 y 9001, volumen `miniodata`), `mailhog` (imagen `mailhog/mailhog:latest`, puertos 1025 y 8025), `jsreport` (imagen `jsreport/jsreport:4.13.0`, puerto 5488, volumen `jsreportdata`).
  - [ ] Healthchecks configurados para los 4 servicios (`pg_isready`, `mc ready`, `wget`, `wget`).
  - [ ] Red `syssol_net` definida y compartida por los 4 servicios.
  - [ ] Variables de entorno documentadas en comentarios: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, etc.
  - [ ] Comando `docker-compose up -d` levanta los 4 servicios en menos de 60 segundos.
  - [ ] MinIO console accesible en `http://localhost:9001` con las credenciales del `.env`.
  - [ ] MailHog UI accesible en `http://localhost:8025`.
  - [ ] jsreport respondiendo en `http://localhost:5488`.
- **Dependencias:** T-001.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-007 — Crear Dockerfile multi-stage para frontend

- **Descripción:** Crear `frontend/Dockerfile` multi-stage: stage `deps` (instala dependencias con `npm ci`), stage `builder` (build de Next.js con `next build` y `output: 'standalone'`), stage `runner` (imagen final con `node:24-alpine`, copia el standalone, expone puerto 3000). Materializa parte de S-Deploy.
- **Criterios de aceptación:**
  - [ ] `frontend/Dockerfile` con 3 stages (`deps`, `builder`, `runner`).
  - [ ] `next.config.mjs` con `output: 'standalone'` confirmado.
  - [ ] Stage `runner` usa `node:24-alpine` y expone puerto 3000.
  - [ ] Stage `runner` ejecuta como usuario no-root (`nextjs`).
  - [ ] `docker build -t syssol-frontend .` desde `frontend/` produce imagen en <2 min.
  - [ ] `docker run -p 3000:3000 syssol-frontend` arranca el servidor y `GET /` retorna HTML.
  - [ ] Imagen final <200 MB (verificado con `docker images`).
- **Dependencias:** T-003, T-006.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-008 — Crear Dockerfile multi-stage para backend

- **Descripción:** Crear `backend/Dockerfile` multi-stage: stage `deps` (instala con `npm ci`), stage `builder` (compila con `nest build`), stage `runner` (imagen final con `node:24-alpine`, copia `dist/`, ejecuta `prisma migrate deploy` en arranque, expone puerto 4000). Materializa S-Deploy.
- **Criterios de aceptación:**
  - [ ] `backend/Dockerfile` con 3 stages (`deps`, `builder`, `runner`).
  - [ ] Stage `builder` genera los Prisma Client (`npx prisma generate`).
  - [ ] Stage `runner` usa `node:24-alpine` y expone puerto 4000.
  - [ ] Stage `runner` ejecuta como usuario no-root (`nestjs`).
  - [ ] `package.json` tiene un script `start:prod` que ejecuta `node dist/main.js` después de `prisma migrate deploy`.
  - [ ] `docker build -t syssol-backend .` desde `backend/` produce imagen en <2 min.
  - [ ] `docker run -p 4000:4000 syssol-backend` levanta NestJS y `GET /api/ping` retorna OK.
  - [ ] Imagen final <250 MB.
- **Dependencias:** T-004, T-006, T-010.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-009 — Crear .env.example con todas las variables (BE y FE)

- **Descripción:** Crear `.env.example` en la raíz con todas las variables de entorno documentadas en `docs/07-arquitectura.md` §4.6. Backend: `NODE_ENV`, `PORT`, `APP_BASE_URL`, `CORS_ORIGINS`, `DATABASE_URL`, `DATABASE_DIRECT_URL`, `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `MINIO_*`, `JSREPORT_*`, `SMTP_*`, `REDIS_URL`, `LOG_LEVEL`. Frontend: `NEXT_PUBLIC_API_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`. Cada variable con un comentario explicativo y un valor de ejemplo.
- **Criterios de aceptación:**
  - [ ] `backend/.env.example` con todas las variables BE listadas, comentadas.
  - [ ] `frontend/.env.example` con todas las variables FE listadas, comentadas.
  - [ ] Raíz `.env.example` con las comunes (Docker compose).
  - [ ] Cada variable tiene un comentario en una línea anterior: `# Descripción. Ejemplo: foo`.
  - [ ] Valores por defecto seguros para dev (no usan secretos reales).
  - [ ] `.env` listado en `.gitignore`.
  - [ ] `JWT_SECRET` y `AUTH_SECRET` documentados como el mismo valor (S-ARQ-B).
- **Dependencias:** T-001, T-006.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-010 — Inicializar Prisma 7 con schema.prisma base

- **Descripción:** Crear `backend/prisma/schema.prisma` con la configuración del datasource PostgreSQL 16 y el generator de Prisma Client. Inicialmente vacío (sin modelos), se va poblando en las tareas de cada módulo. Materializa S-ORM (D6).
- **Criterios de aceptación:**
  - [ ] `backend/prisma/schema.prisma` con:
    - `datasource db { provider = "postgresql"; url = env("DATABASE_URL"); directUrl = env("DATABASE_DIRECT_URL") }`
    - `generator client { provider = "prisma-client-js"; previewFeatures = ["driverAdapters"] }`
  - [ ] `backend/.env` con `DATABASE_URL=postgresql://syssol:syssol@localhost:5432/syssol` y `DATABASE_DIRECT_URL` apuntando al mismo.
  - [ ] `npx prisma generate` produce el cliente sin errores.
  - [ ] `npx prisma migrate dev --name init` crea la migración inicial (vacía).
  - [ ] `npx prisma studio` abre en `:5555` y muestra la BD (vacía).
  - [ ] `PrismaService` y `PrismaModule` configurados en `backend/src/prisma/` con `onModuleInit` que ejecuta `$connect()` y `enableShutdownHooks`.
- **Dependencias:** T-004, T-006, T-009.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-011 — Configurar GitHub Actions CI (lint + build)

- **Descripción:** Crear `.github/workflows/ci.yml` con un pipeline que ejecute lint + build (sin tests automatizados, según `docs/02-stack-tecnologico.md` §2.11). Services: postgres 16, minio, jsreport 4.13. Materializa S-CI.
- **Criterios de aceptación:**
  - [ ] `.github/workflows/ci.yml` con trigger en PRs a `main` y `develop`, y en push a `main`.
  - [ ] Jobs: `lint-fe` (npm run lint en frontend), `lint-be` (npm run lint en backend), `build-fe` (npm run build en frontend), `build-be` (npm run build en backend, incluyendo `prisma generate` y `prisma migrate deploy`).
  - [ ] Service `postgres:16` configurado para el job `build-be` con healthcheck.
  - [ ] Cache de `node_modules` configurado por workspace.
  - [ ] Node 24.X usado.
  - [ ] El pipeline corre en <8 min.
  - [ ] README en `.github/workflows/` documenta los secretos requeridos.
- **Dependencias:** T-001, T-003, T-004.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-012 — Configurar husky + commitlint (Conventional Commits)

- **Descripción:** Instalar husky + commitlint en la raíz y configurar git hooks para validar el formato de los commits (Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, etc.). Materializa la convención de `docs/07-arquitectura.md` §7.4.
- **Criterios de aceptación:**
  - [ ] `package.json` raíz con deps `husky`, `commitlint`, `@commitlint/config-conventional`.
  - [ ] `commitlint.config.js` con `@commitlint/config-conventional`.
  - [ ] Hook `commit-msg` invoca `commitlint -e $HUSKY_GIT_PARAMS`.
  - [ ] Hook `pre-commit` ejecuta `npm run lint` en los workspaces modificados.
  - [ ] `npm run prepare` configura `husky install`.
  - [ ] Un commit con formato inválido (`xxx: bad commit`) es rechazado localmente.
  - [ ] Un commit con formato válido (`feat: add login screen`) es aceptado.
- **Dependencias:** T-001, T-003, T-004.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-013 — Configurar pino para logging estructurado en BE

- **Descripción:** Configurar `nestjs-pino` como logger global de NestJS. Formato JSON en producción, pretty-print en dev. Cada request lleva un `requestId` que se propaga de Next.js a NestJS vía header `x-request-id`. Materializa S-Obs (parte de logs).
- **Criterios de aceptación:**
  - [ ] `backend/src/common/logger/logger.module.ts` configurado con `nestjs-pino`.
  - [ ] Logger global inyectado en `app.module.ts` con `useLogger(app.get(Logger))`.
  - [ ] Formato JSON cuando `NODE_ENV=production`, pretty en dev.
  - [ ] Middleware de Express que lee `x-request-id` del request y lo asigna al `req.id` y al `Logger` context.
  - [ ] Si el header no viene, genera un UUID v4.
  - [ ] Cada log incluye `requestId`, `userId` (si autenticado), `plazaId` (si autenticado), `method`, `url`, `statusCode`, `responseTime`.
  - [ ] Nivel de log configurable con `LOG_LEVEL` (default `info`).
  - [ ] Secretos (`password`, `token`, `authorization`) redactados automáticamente.
- **Dependencias:** T-004.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-014 — Configurar @nestjs/throttler base (rate limit)

- **Descripción:** Configurar `@nestjs/throttler` con rate limit global de 100 req/min por IP. Un guard específico para `POST /api/v1/auth/login` con 5 req/min por IP. Materializa SEC-3 y S-RateLimit.
- **Criterios de aceptación:**
  - [ ] `backend/src/common/guards/throttler-behind-proxy.guard.ts` configurado para leer la IP de `X-Forwarded-For` cuando está detrás de un proxy.
  - [ ] `ThrottlerModule` configurado en `app.module.ts` con TTL 60000 ms y límite 100.
  - [ ] `ThrottlerGuard` global activado con `APP_GUARD`.
  - [ ] Decorator `@Throttle({ default: { limit: 5, ttl: 60000 } })` aplicado a `POST /api/v1/auth/login`.
  - [ ] Un cliente que envía 6 requests en 1 min a `/auth/login` recibe `429 Too Many Requests` en la 6ª.
  - [ ] Un cliente que envía 101 requests en 1 min a cualquier endpoint recibe `429` en la 101ª.
  - [ ] Los `429` se loguean con `requestId` y se reportan a Sentry (cuando T-156 esté lista).
- **Dependencias:** T-004.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-015 — Configurar Helmet y CORS restrictivo

- **Descripción:** Activar Helmet con CSP estricta para producción y configurar CORS restrictivo según env var `CORS_ORIGINS` (lista separada por comas). Materializa SEC-5 y S-CORS.
- **Criterios de aceptación:**
  - [ ] `helmet` activado en `main.ts` con `contentSecurityPolicy` configurado (CSP permite `'self'`, los assets de shadcn, el dominio de jsreport si aplica).
  - [ ] `app.enableCors({ origin: env.CORS_ORIGINS.split(','), credentials: true })` con lista blanca.
  - [ ] `CORS_ORIGINS=http://localhost:3000` en dev, `https://*.plazapp.com` en prod.
  - [ ] Un request desde `http://evil.com` recibe `403 Forbidden` con header `Access-Control-Allow-Origin` ausente.
  - [ ] Un request desde `http://localhost:3000` recibe los headers CORS correctos.
  - [ ] Headers de seguridad presentes: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
- **Dependencias:** T-004, T-009.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-016 — Documentar convenciones en CONTRIBUTING.md

- **Descripción:** Crear `CONTRIBUTING.md` en la raíz con todas las convenciones del proyecto: estilo de código (ESLint, Prettier), commits (Conventional Commits), branches (`main`, `develop`, `feat/*`, `fix/*`, `release/*`), PRs (1 aprobación + CI en verde), estructura de carpetas, path aliases, y referencia a este `PLANIFICACION/`.
- **Criterios de aceptación:**
  - [ ] `CONTRIBUTING.md` cubre: setup local, comandos (`npm run dev`, `docker-compose up -d`), estilo de código, formato de commits, naming de branches, flujo de PR, revisión de código, deploy.
  - [ ] Sección "Trabajar en tareas" con referencia a `PLANIFICACION/00-INDICE.md` y al formato de las tareas (descripción, criterios, dependencias, bitácora).
  - [ ] Sección "Regla crítica de bitácora" explicando que al cerrar una tarea se documentan desviaciones y se marcan las tareas dependientes afectadas.
  - [ ] El documento es <5 páginas impresas.
- **Dependencias:** T-001, T-012.
- **Prioridad:** Baja.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*
