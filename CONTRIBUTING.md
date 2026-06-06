# Guía para contribuir · Plazapp

> Convenciones de código, commits, branches, PRs y trabajo con tareas del plan.

## TL;DR

```bash
# 1. Setup
git clone <repo>
cd sys-solicitudes
npm install
cp .env.example .env
npm run infra:up          # Postgres 16, MinIO, MailHog, jsreport
npm run dev               # backend :4000 + frontend :3000

# 2. Crear branch
git checkout -b feat/T-XXX-descripcion-corta

# 3. Antes de hacer commit
npm run lint
npm run build

# 4. Commit (Conventional Commits)
git add .
git commit -m "feat(usuarios): agregar endpoint de creación"

# 5. Push y PR
git push -u origin feat/T-XXX-descripcion-corta
gh pr create --base develop
```

## Estructura del monorepo

```
sys-solicitudes/
├── frontend/               # Next.js 16 (App Router) + React 19 + Tailwind 4
├── backend/                # NestJS 11 + Prisma 7
├── packages/contracts/     # @app/contracts · Zod 4 compartido
├── PLANIFICACION/          # 175 tareas descompuestas (fuente de verdad)
├── docs/                   # Especificación funcional
├── docker-compose.yml      # Postgres, MinIO, MailHog, jsreport
└── .github/workflows/      # CI
```

## Setup local

### Pre-requisitos

- **Node.js 24 LTS** (recomendado; la última stable es 26 pero 24 es LTS).
- **npm 10+** (recomendado 11+).
- **Docker Desktop** o Docker Engine con `docker compose` v2.
- **Git** con hooks inicializados (`npm run prepare` después de instalar).
- (Windows) WSL2 recomendado para mejor performance con Docker.

### Pasos

```bash
# 1. Instalar dependencias (workspaces npm)
npm install

# 2. Copiar variables de entorno
cp .env.example .env
# Editar .env: al menos cambiar JWT_SECRET y AUTH_SECRET (deben ser iguales).

# 3. Levantar infraestructura
npm run infra:up
# Espera ~30s a que postgres/minio/mailhog/jsreport estén healthy.

# 4. Aplicar migraciones Prisma
npm run prisma:migrate

# 5. Poblar con datos de seed (idempotente)
npm run prisma:seed
# Crea: 3 roles globales, superadmin@plazapp.com / Plazapp2026!,
# plaza demo (slug "demo") con su config + roles de staff, y
# admin@demo.com / Plazapp2026! (admin_plaza, rol_staff supervisor). Solo dev.

# 6. Levantar backend + frontend
npm run dev
# Backend: http://localhost:4000
# Frontend: http://localhost:3000
# Swagger: http://localhost:4000/api/docs
# MailHog UI: http://localhost:8025
# MinIO Console: http://localhost:9001
# Prisma Studio: npm run prisma:studio
```

## Comandos principales

| Comando | Descripción |
|---|---|
| `npm run dev` | Backend + frontend en paralelo (watch mode). |
| `npm run build` | Build de los 3 workspaces. |
| `npm run lint` | Lint en los 3 workspaces. |
| `npm run type-check` | TypeScript check sin emitir. |
| `npm run infra:up` / `infra:down` | Levanta / para los contenedores. |
| `npm run infra:logs` | Tail de logs de los contenedores. |
| `npm run prisma:migrate` | Aplicar migraciones (dev). |
| `npm run prisma:deploy` | Aplicar migraciones (prod). |
| `npm run prisma:studio` | GUI de Prisma en :5555. |
| `npm run prisma:generate` | Regenerar Prisma Client. |

## Estilo de código

- **TypeScript strict** en los 3 workspaces (`strict: true` en `tsconfig.base.json`).
- **Sin `any`** salvo casos justificados con `// eslint-disable-next-line @typescript-eslint/no-explicit-any` y comentario explicativo.
- **ESLint + Prettier** con `printWidth: 100`, `singleQuote: true`, `semi: true`, `tabWidth: 2`, `trailingComma: 'all'`.
- **Path aliases**:
  - Frontend: `@/*` → `./src/*`
  - Backend: `@/*` → `./src/*`, `@modules/*` → `./src/modules/*`
  - Contratos: imports directos desde `@app/contracts/<dominio>`
- **Naming**:
  - Archivos TS: `kebab-case.ts` (FE) o `kebab-case.entity.ts` (BE, con sufijo por tipo).
  - Clases: `PascalCase`.
  - Variables y funciones: `camelCase`.
  - Constantes globales: `SCREAMING_SNAKE_CASE`.

## Conventional Commits

Formato: `<type>(<scope>): <subject>`

Tipos permitidos (ver `commitlint.config.js`):

| Tipo | Uso |
|---|---|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Solo documentación |
| `style` | Formato, sin cambio de lógica |
| `refactor` | Cambio de código sin fix ni feat |
| `perf` | Mejora de performance |
| `test` | Tests |
| `chore` | Build, deps, tooling |
| `build` | Build system / deps externas |
| `ci` | Solo CI |
| `revert` | Revertir commit |

**Scopes sugeridos**: `frontend`, `backend`, `contracts`, `auth`, `plazas`, `usuarios`, `locales`, `contratos`, `categorias`, `solicitudes`, `aprobaciones`, `adjuntos`, `notificaciones`, `calendario`, `reportes`, `admin`, `auditoria`, `infra`, `docs`, `ci`.

**Subject**: imperativo presente, lowercase, máx 72 chars. Sin punto final.

**Body**: explicar el "qué" y el "por qué", max 100 chars/línea.

**Footer**: `Closes #123`, `Refs PLANIFICACION/06-solicitudes.md#T-080`.

## Branches

| Branch | Propósito |
|---|---|
| `main` | Producción. Protegida, solo merge vía PR con 1 aprobación + CI verde. |
| `develop` | Integración. Deploy a staging automático. |
| `feat/*` | Nueva funcionalidad. PR a `develop`. |
| `fix/*` | Corrección de bug. PR a `develop`. |
| `release/*` | Preparación de release. PR a `main` y `develop`. |
| `chore/*` | Tareas de mantenimiento. PR a `develop`. |

Naming: `<type>/T-NNN-descripcion-corta` cuando hay tarea en PLANIFICACION. Ej: `feat/T-026-implementar-login`.

## Pull Requests

- **1 aprobación** requerida (2 si el cambio toca BD o auth).
- **CI en verde** obligatorio.
- **PR pequeño**: ideal < 400 líneas modificadas. Si es más, dividir en PRs.
- **Descripción**:
  - Resumen (1-3 líneas).
  - `Refs PLANIFICACION/XX.md#T-NNN` si aplica.
  - Screenshots / capturas si hay UI.
  - `Closes #123` si cierra un issue.
- **Review**:
  - Revisar código, no solo aprobar.
  - Comentar inline.
  - Aprobar solo cuando los comentarios están resueltos.

## Trabajar con tareas de `PLANIFICACION/`

> **Regla crítica:** Las bitácoras son la fuente de verdad del estado del proyecto. Antes de cerrar una tarea, DEBES rellenar su bitácora.

### 1. Tomar una tarea

1. Lee `PLANIFICACION/00-INDICE.md` y ubica la tarea por su ID (T-NNN).
2. Abre el archivo del módulo y revisa la tarea en detalle.
3. Verifica que todas las tareas listadas en "Dependencias" estén `Completada`.
4. Crea el branch (`feat/T-NNN-descripcion`).
5. Cambia el estado de la tarea a `En progreso` editando el archivo.

### 2. Implementar

- Sigue los criterios de aceptación como checklist.
- Si encuentras ambigüedad, consulta `docs/` o pregunta.
- Si descubres que la decisión original era incorrecta, documenta en la bitácora.

### 3. Cerrar la tarea

Edita el archivo de PLANIFICACION/ y actualiza:

```markdown
### T-NNN — Título

- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Desviaciones:** [qué se hizo distinto al plan]
  - **Criterios modificados:** [qué criterios cambiaron]
  - **Decisiones técnicas:** [decisiones que afectan a otras tareas]
  - **Tareas dependientes afectadas:** T-NNN (en archivo.md) — ⚠️ Revisar
```

### 4. Propagar cambios

Si la tarea tiene dependientes en otros archivos, márcalas como `Bloqueada` con referencia a la tarea origen:

```markdown
### T-NNN+1 — Título (en otro archivo.md)

- **Estado:** Bloqueada.
- **Bitácora de cambios:** ⚠️ T-NNN cambió [X]. Revisar antes de implementar.
```

## Reglas de oro

1. **Lee antes de tocar.** Si no entiendes el "por qué" de una tarea, pregunta.
2. **PRs pequeños y enfocados.** Un PR = una tarea (o parte cohesiva de ella).
3. **Cero `any` sin justificación.**
4. **Logs con `requestId`:** cada log de operación debe ser trazable.
5. **No expongas secretos en logs.** El redactor de pino los enmascara, pero no confíes solo en eso.
6. **Tests manuales antes de pedir review.** El proyecto no tiene tests automatizados; tu checklist son los criterios de aceptación.
7. **Actualiza la bitácora SIEMPRE.** Es la única forma de que el próximo dev entienda qué pasó.

## Recursos

- [`PLANIFICACION/00-INDICE.md`](./PLANIFICACION/00-INDICE.md) — Índice de tareas.
- [`CLAUDE.md`](./CLAUDE.md) — Reglas para Claude Code en este repo.
- [`docs/`](./docs) — Especificación funcional y técnica.
- [`README.md`](./README.md) — Setup y comandos.
