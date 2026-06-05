# sys-solicitudes · Plazapp

Portal web **multi-plaza (SaaS)** para gestión de solicitudes en centros comerciales.

## Estructura del monorepo

```
sys-solicitudes/
├── apps/                         # (futuro; en v1 usamos frontend/ y backend/ en raíz)
├── frontend/                     # Next.js 16.2.7 (App Router) + React 19 + Tailwind 4
├── backend/                      # NestJS 11 + Node 24 + Prisma 7
├── packages/
│   └── contracts/                # @app/contracts — Zod 4 schemas compartidos FE/BE
├── PLANIFICACION/                # 175 tareas descompuestas con dependencias
├── docs/                         # Especificación funcional y técnica
├── docker-compose.yml            # Postgres 16, MinIO, MailHog, jsreport 4.13
├── docker-compose.prod.yml       # Producción
├── .github/workflows/            # CI/CD
├── package.json                  # Workspaces npm
├── tsconfig.base.json            # TypeScript strict compartido
└── .env.example                  # Variables de entorno documentadas
```

> **Decisión de T-V01 (validada con cliente):** Single subdomain `app.plazapp.com` en producción. La plaza **NO** aparece en la URL. Local: `localhost:3000` (FE) y `localhost:4000` (BE).

## Comandos rápidos

| Comando | Descripción |
|---|---|
| `npm install` | Instala dependencias de los 3 workspaces |
| `npm run dev` | Levanta backend (:4000) y frontend (:3000) en paralelo |
| `npm run build` | Compila los 3 workspaces |
| `npm run lint` | Lint en los 3 workspaces |
| `npm run infra:up` | Levanta Postgres, MinIO, MailHog, jsreport (Docker) |
| `npm run infra:down` | Para los contenedores |
| `npm run prisma:migrate` | Aplica migraciones Prisma |
| `npm run prisma:studio` | Abre Prisma Studio en :5555 |

## Stack

- **Frontend:** Next.js 16.2.7, React 19.2.7, TypeScript 5.9.x, Tailwind CSS 4.3.0, shadcn/ui.
- **Backend:** NestJS 11.1.24, Node.js 24 LTS, Prisma 7.8.0, Zod 4.4.3.
- **BD:** PostgreSQL 16 (RLS activo).
- **Storage:** MinIO (S3-compatible).
- **Reportes:** jsreport 4.13 (contenedor Docker).
- **Email:** SMTP con Nodemailer.
- **Auth:** Auth.js (NextAuth v5) + JWT HS256 compartido.
- **Infra local:** Docker Compose.

## Documentación

| Recurso | Para qué |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Reglas operativas para Claude Code y contexto del proyecto. |
| [`docs/`](./docs) | Especificación funcional y técnica completa (7 documentos). |
| [`PLANIFICACION/`](./PLANIFICACION) | 175 tareas descompuestas (15 de validación + 160 de implementación). |
| [`Cotizacion_Solicitudes.pdf`](./Cotizacion_Solicitudes.pdf) | Cotización original COT-2026-0012. |

## Empezar

1. Lee [`PLANIFICACION/00-INDICE.md`](./PLANIFICACION/00-INDICE.md).
2. Verifica que las 15 SUPUESTOS críticos (T-V01…T-V15) estén resueltos.
3. Sigue el orden de las tareas técnicas (T-001 → T-002 → …).

---

## 7.1. Planificación accionable

> Generada a partir del análisis de los 7 documentos anteriores. **Empieza por aquí si vienes a implementar.**

| Documento | Contenido |
|---|---|
| [`PLANIFICACION/00-INDICE.md`](PLANIFICACION/00-INDICE.md) | **Índice global**, dashboard de estado, mapa de tareas, y **SUPUESTOS críticos que el cliente debe validar antes de iniciar el desarrollo** (T-V01…T-V15). |
| [`PLANIFICACION/01-setup-base.md`](PLANIFICACION/01-setup-base.md) | Bootstrap del monorepo, Docker, tooling, Prisma init, paquete `@app/contracts`, GitHub Actions CI, RLS base (T-001…T-016). |
| [`PLANIFICACION/02-autenticacion-usuarios.md`](PLANIFICACION/02-autenticacion-usuarios.md) | Triple guard, Auth.js + JWT compartido, login/refresh/logout/reset, lockout, usuarios CRUD, roles de staff (T-017…T-035). |
| [`PLANIFICACION/03-plazas-multitenant.md`](PLANIFICACION/03-plazas-multitenant.md) | Resolución de tenant (subdominio/path), RLS, CRUD de plazas, branding, configuración 1:1 (T-036…T-046). |
| [`PLANIFICACION/04-locales-inquilinos-contratos.md`](PLANIFICACION/04-locales-inquilinos-contratos.md) | Locales (CRUD + CSV), inquilinos, contratos con trigger anti-solapamiento, alertas T-30/T-7 (T-047…T-062). |
| [`PLANIFICACION/05-categorias-subcategorias.md`](PLANIFICACION/05-categorias-subcategorias.md) | Categorías, subcategorías con responsable y hasta 5 supervisores (trigger PL/pgSQL) (T-063…T-073). |
| [`PLANIFICACION/06-solicitudes.md`](PLANIFICACION/06-solicitudes.md) | Solicitudes CRUD, 4 tipos, campos extra JSONB validados con Zod, recurrencia, duplicar, prioridad heredada (T-074…T-090). |
| [`PLANIFICACION/07-aprobaciones.md`](PLANIFICACION/07-aprobaciones.md) | State machine completa (T1–T12), lock 30 min, bandeja priorizada, SC-4 defense, SLA visual, reasignación (T-091…T-108). |
| [`PLANIFICACION/08-adjuntos.md`](PLANIFICACION/08-adjuntos.md) | MinIO, buckets por tenant, upload/download con URLs pre-firmadas, validación MIME, cuarentena 30 días (T-109…T-117). |
| [`PLANIFICACION/09-notificaciones-email.md`](PLANIFICACION/09-notificaciones-email.md) | SMTP, 8 plantillas, cola `email_log`, worker con reintentos 1m/5m/30m, deduplicación, bounce handling (T-118…T-127). |
| [`PLANIFICACION/10-calendario.md`](PLANIFICACION/10-calendario.md) | FullCalendar (Client Component), `evento_calendario`, detección visual de choques, export iCal (T-128…T-134). |
| [`PLANIFICACION/11-reportes-panel.md`](PLANIFICACION/11-reportes-panel.md) | jsreport 4.13 (BFF), CSV/XLSX/PDF, KPIs, dashboard con recharts, pantalla de configuración (T-135…T-145). |
| [`PLANIFICACION/12-seguridad-auditoria.md`](PLANIFICACION/12-seguridad-auditoria.md) | Helmet, CORS, throttler, auditoría append-only, sanitización HTML, RFC 7807 (T-146…T-152). |
| [`PLANIFICACION/13-observabilidad-despliegue.md`](PLANIFICACION/13-observabilidad-despliegue.md) | `pino` + `requestId`, Prometheus, Sentry, health checks, docker-compose prod, GitHub Actions deploy (T-153…T-160). |

**Total:** 175 tareas (15 de validación + 160 de implementación) con dependencias explícitas y trazables.

ignora lo siguiente
'Desarrolla todas las tareas de @PLANIFICACION/01-setup-base.md analizxalo primero y si no tienes algo claro preguntame primero para que despues te quedes codificando, no se te escape que tienes que ir documentando las tareas
  que vayas finalizando, con respeto a las tecnologias primero investigfa en la red cual es la version mas actual estable y asegurate en usar eso, esto ultimo ponlo en el @CLAUDE.md para que lo hagas en todas las tareas futuras
  tambien'