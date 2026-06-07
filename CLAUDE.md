# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado actual del repositorio

> **Este repositorio está en fase de documentación.** No existe código fuente aún. Todo el contenido actual es la especificación funcional y técnica del sistema `sys-solicitudes` (también llamado "Plazapp"), un portal SaaS multi-plaza para gestión de solicitudes en centros comerciales. La implementación se organizará como monorepo con `frontend/`, `backend/` y `packages/contracts/` (ver `docs/07-arquitectura.md` §7.3.3).
>
> Antes de empezar a implementar, **validar con el cliente la lista de SUPUESTOS** marcada en cada documento (sección §6 del `README.md` resume los críticos). Todo lo marcado con `SUPUESTO:` o `S-*` es una decisión propuesta que requiere confirmación.

## Documentación fuente (leer en este orden)

| Si vienes a… | Lee |
|---|---|
| Entender el producto | `README.md` → `docs/01-vision-general.md` → `docs/03-modulos-del-sistema.md` |
| Implementar | `docs/01` → `docs/02-stack-tecnologico.md` → `docs/04-modelo-de-datos.md` → `docs/07-arquitectura.md` → `docs/03` → `docs/05-flujo-de-solicitudes.md` → `docs/06-roles-y-permisos.md` |
| Probar / QA | `docs/05-flujo-de-solicitudes.md` (state machine) → `docs/06-roles-y-permisos.md` (matriz) |

## Stack confirmado y decisiones clave

- **Frontend:** Next.js 14 (App Router) + React 18 + TypeScript. **Reemplaza al Angular** de la cotización original (decisión D5; justificación en `docs/02-stack-tecnologico.md` §2.3).
- **Backend:** Node.js 24.X + NestJS 10. Módulos 1:1 con los módulos funcionales del sistema.
- **ORM:** Prisma 7. Migraciones versionadas con `prisma migrate deploy` en arranque.
- **Validación:** Zod en paquete compartido `packages/contracts`, usado por NestJS (`ZodValidationPipe`) y por React Hook Form en frontend.
- **BD:** PostgreSQL 16, compartida, esquema compartido, discriminador `plaza_id` en cada tabla de negocio. RLS activo como segunda capa de defensa.
- **Auth:** Auth.js (NextAuth v5) en frontend + JWT HS256 compartido con NestJS (mismo `JWT_SECRET`). Access 15 min, refresh 7 días rotado (decisión D3).
- **Storage:** MinIO (S3-compatible). Buckets por tenant: `solicitudes-adjuntos-{plaza_id}`. URLs pre-firmadas con 15 min de expiración. Límite 25 MB/archivo.
- **Reportes:** jsreport 4.13 como contenedor Docker separado (imagen `jsreport/jsreport:4.13.0`); el backend no instala librerías de generación y solo hace de proxy HTTP al servicio de jsreport (ver `docs/02-stack-tecnologico.md` §2.12).
- **Email:** SMTP con Nodemailer + cola en tabla `email_log` y worker con `@nestjs/schedule` (reintentos 1m/5m/30m).
- **UI:** Tailwind + shadcn/ui + lucide-react. FullCalendar React (módulo calendario, Client Component).
- **Tests:** Sin tests unitarios ni automatizados. Verificación funcional manual de cada endpoint con el backend levantado (detalle en `docs/02-stack-tecnologico.md` §2.11).
- **Infra local:** `docker-compose.yml` con `postgres`, `minio`, `mailhog`, `jsreport`, `backend`, `frontend`.

## Arquitectura esencial

### Multi-tenancy (transversal a todo)

- Cada **plaza comercial** es un tenant. Existe un `superadmin` a nivel plataforma que no tiene `plaza_id`.
- Toda tabla de negocio tiene `plaza_id NOT NULL` + FK a `plaza.id`. **Regla absoluta: no se ejecuta ninguna operación de negocio sin un `plaza_id` válido en el token.**
- **Resolución de tenant:** subdominio en producción (`acme.plazapp.com` → `slug=acme`), path `/p/{slug}/...` en dev/staging. Resolver en middleware Next.js y propagar como header `x-plaza-slug`.
- **Tres guards en serie** en NestJS: `JwtAuthGuard` → `PlazaScopeGuard` → `RolesGuard`. RLS en PostgreSQL (`SET LOCAL app.plaza_id = '<uuid>'`) como segunda capa.
- **SUPUESTO S-MT-C:** un usuario pertenece a **una sola plaza** y tiene **un solo rol**. No multi-plaza para staff en v1.

### Estructura del monorepo esperado

```
sys-solicitudes/
├── frontend/          # Next.js 14
├── backend/           # NestJS 10
├── packages/contracts/  # Zod schemas compartidos FE/BE
├── docker-compose.yml
└── .github/workflows/
```

Detalle completo de carpetas en `docs/07-arquitectura.md` §7.3.

### Módulos del backend (NestJS) ↔ rutas API

| Módulo NestJS | Prefijo |
|---|---|
| `auth` | `/api/v1/auth` |
| `plazas` | `/api/v1/plazas` |
| `usuarios` | `/api/v1/usuarios` |
| `locales` | `/api/v1/locales` |
| `contratos` | `/api/v1/contratos` |
| `solicitudes` | `/api/v1/solicitudes` (incluye sub-recurso `aprobacion`, `comentarios`, `historial`, `adjuntos`) |
| `notificaciones` | worker + `/api/v1/notificaciones` (log) |
| `calendario` | `/api/v1/calendario` |
| `adjuntos` | anidado en `/solicitudes/:id/adjuntos` y `/locales/:id/adjuntos` |
| `reportes` | `/api/v1/reportes` (BFF: delega PDF/XLSX a jsreport; CSV inline) |
| `admin` | `/api/v1/admin` (solo superadmin) |

### Roles y scope

Tres roles: `superadmin` (plataforma), `admin_plaza` (una plaza), `inquilino` (una plaza + un inquilino). Matriz completa de permisos en `docs/06-roles-y-permisos.md` §6.2. Restricciones transversales en §6.3 (incluye SC-4: defense-in-depth que impide a un admin aprobar sus propias solicitudes).

## Flujo de solicitudes (state machine — núcleo de la lógica de negocio)

Definición canónica en `docs/05-flujo-de-solicitudes.md` (revisado por **T-V03**: estado `asignado`, cola de 15 min, **SIN lock de 30 min**). Implementado en módulos 06/07 (`SolicitudStateService` es el único escritor de `solicitud.estado`).

```
                    ┌───────────┐
[*] ────────────────▶ borrador  │──▶ cancelada (cualquier estado no terminal)
                    └─────┬─────┘
              enviar │ (NO asigna, NO email)
                     ▼
                  enviada ◀──────────────┐ liberar / reenviar tras subsanación
                     │ cron 1 min:       │
                     │ enviada_at>15min  │
                     ▼                   │
                  asignado ──────────────┤  (reasignar: asignado|en_revision,
                     │ tomar (SOLO el    │   cualquier admin_plaza, T-V04)
                     │ admin asignado)   │
                     ▼                   │
                en_revision ─────────────┘──▶ aprobada (terminal; evento→calendario,
                     │                          remodelación→local en_mantenimiento)
                     ├──▶ rechazada (terminal, comentario obligatorio)
                     └──▶ requerida_subsanacion ──reenviar (inquilino)──▶ enviada
```

- **Estados terminales:** `aprobada`, `rechazada`, `cancelada`.
- **Sin lock (T-V03):** la defensa anti-doble es estructural — solo el `admin_asignado_id` puede tomar/decidir (`403 NOT_ASSIGNED_ADMIN`); otro admin debe reasignar (T12). Las solicitudes sin subcategoría/responsable válido quedan en `enviada` para toma manual.
- **Cada transición** encola un email en `email_log` (estado `pendiente`; el worker que envía es del módulo 09) **e inserta** una fila inmutable en `solicitud_historial` (append-only: trigger + REVOKE).
- **Rechazo y subsanación** requieren comentario obligatorio no vacío (`POST :id/rechazar`, `POST :id/pedir-subsanacion`; el reenvío del inquilino es `POST :id/subsanar`).
- **SLA (T-V03):** semáforo desde `enviada_at`; `sla_dias_por_tipo[tipo] × sla_multiplicador_por_prioridad[prioridad]`; matview `solicitud_sla_view` + cron diario.

## Convenciones de código (definidas en `docs/07-arquitectura.md` §7.4)

- TypeScript `strict: true` en FE y BE. Sin `any` salvo `// eslint-disable-next-line` comentado.
- Path aliases: `@/*` (FE), `@/*` y `@modules/*` (BE).
- ESLint + Prettier: `printWidth: 100`, `singleQuote: true`, `semi: true`.
- Conventional Commits (`feat:`, `fix:`, `chore:`). Branches: `main` (protegida), `develop`, `feat/*`, `fix/*`, `release/*`. PRs requieren 1 aprobación + CI en verde.
- **Módulo NestJS** estándar: `controllers/`, `services/` (incluye `*-state.service.ts` para máquinas de estado), `dto/`, `entities/`, `schemas/` (Zod).
- **Frontend:** Server Components por defecto; Client Components (`"use client"`) aislados en `components/client/` solo donde se necesite interactividad (calendario, formularios complejos, uploads).
- **Frontend NO expone la API de NestJS al cliente:** pasa por Server Components / Server Actions como BFF ligero (S-ARQ-E). Cookies httpOnly; el JWT nunca llega a JavaScript del cliente (S-ARQ-F).
- **API REST:** prefijo `/api/v1`, JSON UTF-8, fechas ISO-8601 con TZ, paginación `?page=1&pageSize=20&sort=`, errores RFC 7807 con códigos de dominio (`SOLICITUD_LOCKED`, `CONTRATO_OVERLAP`, `LOCAL_NO_DISPONIBLE`, `ADJUNTO_MIME_INVALIDO`, etc.).
- **Seguridad:** bcrypt cost 12, Helmet, CORS restrictivo, rate limit 100 req/min global y 5 req/min en login, `@nestjs/throttler`, sanitización HTML en descripciones, `auditoria` para todo POST/PATCH/DELETE. TLS obligatorio en producción.

## Comandos (a definir al iniciar implementación)

> No hay scripts en `package.json` aún. Al crear los proyectos, los comandos serán los estándar de cada framework:
>
> - `frontend/`: `npm run dev` (Next.js dev server en `:3000`), `npm run build`, `npm run lint`.
> - `backend/`: `npm run start:dev` (NestJS en `:4000`), `npm run build`, `npm run lint`, `npx prisma migrate dev`.
> - Stack local: `docker-compose up -d` (postgres, minio, mailhog) desde la raíz.
> - Documentación OpenAPI viva en `/api/docs` (Swagger) cuando se levante el backend.
> - **Verificación de multi-tenancy** se realiza manualmente al crear/modificar un endpoint: probar con dos plazas (tokens con distinto `plaza_id`) y confirmar que A nunca ve datos de B.

## SUPUESTOS pendientes de validar (críticos para kickoff)

Lista completa en `README.md` §6. Los de mayor impacto:

- **S-EstrategiaMT** — DB compartida + `plaza_id` (define el modelo de datos entero). ✅ **Resuelto en T-V01.**
- **S-MT-A** — ⚠️ **REVISADO en T-V01 (2026-06-05):** single subdomain `app.plazapp.com` en producción, **la plaza NO aparece en la URL**. Se eliminó DNS wildcard, TLS wildcard, middleware de resolución por host y header `x-plaza-slug`. La resolución de tenant se hace únicamente por `plaza_id` en el JWT.
- **S-MT-B** — `slug` inmutable en BD para emails/branding interno; ya no afecta URLs. ✅ Resuelto en T-V01.
- **S-MT-C** — Un usuario pertenece a una sola plaza y un solo rol. ✅ **Resuelto en T-V01.**
- **S-LockTimeout** — Lock de revisión expira a 30 min.
- **S-TamañoMax / S-MimeTypes** — 25 MB/archivo y lista cerrada de MIME permitidos.
- **S-CI / S-Deploy / S-Obs** — Pipeline, hosting (NO incluido en cotización) y observabilidad (Pino + Prometheus + Sentry) — todos son supuestos.
- **S-CamposTipo** — Campos extra por tipo de solicitud (`mantenimiento`, `evento`, `remodelacion`, `otro`) impactan formularios y esquema.
- **S-JSReport** — jsreport 4.13 como contenedor Docker; backend no instala librerías de generación de PDFs/Excels (detalle en `docs/02-stack-tecnologico.md` §2.12).

> **Nota:** el estado completo de los SUPUESTOS (15 T-Vxx) está en `PLANIFICACION/00-INDICE.md` §4. Esta lista es solo un resumen ejecutivo.

## Próximos pasos sugeridos (de `README.md` §7)

1. Validar la documentación sección por sección con el cliente.
2. Resolver la lista de SUPUESTOS críticos.
3. Confirmar proveedor de hosting y SMTP transaccional.
4. Generar `schema.prisma` definitivo desde el DDL de `docs/04-modelo-de-datos.md` §4.10.
5. Crear el monorepo con `frontend/`, `backend/`, `packages/contracts/`.
6. Levantar entorno de desarrollo con `docker-compose.yml` de `docs/07-arquitectura.md` §7.10.1.
7. Iniciar implementación por la fase 2 de la cotización: autenticación, locales, solicitudes, aprobaciones.

> **Las tareas técnicas detalladas están en `PLANIFICACION/00-INDICE.md` (175 tareas, T-V01 a T-160).**

---

## Configuración de Claude Code (`.claude/`)

> El owner trabaja en **múltiples proyectos**, por lo que toda la configuración de Claude Code para `sys-solicitudes` está **estrictamente scoped a este proyecto**.

| Recurso | Ubicación | Notas |
|---|---|---|
| Skills del proyecto | `.claude/skills/<name>/SKILL.md` | Commiteadas, compartidas con el equipo |
| Sub-agentes del proyecto | `.claude/agents/<name>.md` | Idem |
| MCP servers | `.mcp.json` (raíz) | Apuntan a paths relativos al proyecto |
| Settings del proyecto | `.claude/settings.json` | Commiteado |
| Settings personales | `.claude/settings.local.json` | Gitignored, overrides del dev |
| Memoria persistente | `.claude/memory/project-graph.jsonl` | Gitignored, se regenera con `/load-memory` |
| Memoria seed | `.claude/memory/seed.jsonl` | Commiteado, fuente de la memoria inicial |
| Hooks | `.claude/hooks/<name>.sh` | Cuando se agreguen |
| Documentación | `.claude/README.md` | Convenciones y política de scope |

**Regla absoluta:** nada de esto debe crearse ni modificarse en `~/.claude/` ni en `~/.claude.json` desde el trabajo de este repo. Ver `.claude/README.md` §Scope y política para el detalle y justificación.

---

## Reglas operativas para implementación

### Scope de Claude Code: project-only (nuevo)

> **Regla obligatoria:** Toda configuración, skill, hook, agente o MCP server específico de `sys-solicitudes` debe vivir en `.claude/` o `.mcp.json` de la raíz del proyecto. **Nunca** en el home del usuario (`~/.claude/`, `~/.claude.json`).

**Por qué:** el owner trabaja en múltiples proyectos. El estado/configuración de un proyecto no debe filtrarse a otros.

**Procedimiento:**
1. Antes de crear un skill, hook, agente o MCP server: ¿es específico de este proyecto? → va en `.claude/`. ¿es genérico y útil para todos los proyectos? → **preguntar al owner** antes de hacerlo global.
2. Verificar con `/project-status` que no haya "violaciones de scope" reportadas.
3. Si una tool o acción toca `~/.claude/` por accidente, revertir inmediatamente y reportar.
4. La skill `/project-status` valida esto en cada invocación.



### Investigación de versiones antes de instalar

> **Regla obligatoria:** Antes de agregar o actualizar cualquier dependencia (`npm install`, `npm add`, `pip install`, `cargo add`, etc.), **investigar la versión más reciente estable** del paquete. La documentación de `docs/` fue escrita en mayo 2026 y puede estar desactualizada. Usar siempre la última versión estable publicada en el registry oficial (npm, PyPI, crates.io, etc.) salvo que exista un motivo justificado para usar una anterior.

**Procedimiento:**
1. Antes de añadir una dependencia, consultar el registry oficial (p. ej. `https://registry.npmjs.org/<paquete>/latest`) para confirmar la última versión estable.
2. Verificar breaking changes entre la versión del plan y la latest (revisar CHANGELOG, migration guides, release notes).
3. Si la versión del plan difiere de la latest, **preguntar al usuario** qué versión usar (latest vs. la del plan) si el cambio es mayor (major version).
4. Documentar en la **bitácora de la tarea** cualquier desviación entre la versión planeada y la instalada.
5. Para Node.js, preferir LTS (24.x o superior) sobre Current.
6. Para TypeScript, evitar versiones recién salidas (`.0`) en proyectos largos; preferir la última `.X` de la major anterior LTS.

### Hallazgos de versiones (módulo 08 — adjuntos, 2026-06-07)

Versiones verificadas en `https://registry.npmjs.org/<pkg>/latest` antes de instalar:

| Paquete | Versión instalada | Notas de compatibilidad |
|---|---|---|
| `react-dropzone` | `15.0.0` | peer dep `react >= 16.8 \|\| 18.0.0` cubre 19.x ✅ |
| `react-pdf` | `10.4.1` | peer dep `react ^16.8 \|\| ^17 \|\| ^18 \|\| ^19` ✅ |
| `pdfjs-dist` (transitiva) | `6.0.227` | engine `node >= 22.13 \|\| >= 24` ✅ (Node 24 del proyecto) |
| `minio` (ya estaba) | `8.0.7` | sin cambios |

**Aplicar este mismo procedimiento a TODAS las tareas futuras** que requieran nuevas dependencias.

### Documentación de tareas

> **Regla obligatoria:** Al finalizar una tarea técnica de `PLANIFICACION/*.md`, se debe:
> 1. Rellenar la **bitácora de cambios** con desviaciones, criterios modificados, decisiones técnicas y tareas dependientes afectadas.
> 2. Si hay desviaciones en versiones o comportamiento, marcarlas con `⚠️`.
> 3. Si se modifica o elimina código de una tarea ya completada, abrir un commit con prefijo `fix:` o `chore:` que lo documente.
> 4. Las bitácoras son **inmutables** una vez escritas (no se borran entradas; se añade `actualización: ...` si hay correcciones).

### Comunicación con el usuario

> **Regla obligatoria:** Si una tarea del plan tiene ambigüedad, conflicto con decisiones previas (T-Vxx), o múltiples interpretaciones razonables, **preguntar al usuario antes de codificar**. No asumir. Las decisiones tomadas en las T-Vxx son vinculantes; si una tarea las contradice, marcar la tarea para revisión.
5. Crear el monorepo con `frontend/`, `backend/`, `packages/contracts/`.
6. Levantar entorno de desarrollo con `docker-compose.yml` de `docs/07-arquitectura.md` §7.10.1.
7. Iniciar implementación por la fase 2 de la cotización: autenticación, locales, solicitudes, aprobaciones.
