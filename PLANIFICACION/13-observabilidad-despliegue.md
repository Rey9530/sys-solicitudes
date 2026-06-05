# Módulo 13 — Observabilidad y Despliegue

> **Propósito:** Logs estructurados con `pino` y `requestId` propagado, métricas Prometheus + Grafana, Sentry para tracking de errores, health checks (liveness + readiness con checks DB/MinIO/SMTP), docker-compose de producción, GitHub Actions de deploy, y runbook de despliegue/rollback.
>
> **Pre-requisito:** T-001 a T-152 (todo lo anterior) deben estar `Completada`.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-153 | Configurar pino con requestId propagado FE→BE y contexto de usuario | Alta | Pendiente |
| T-154 | Implementar /api/v1/health (liveness) y /api/v1/health/ready (readiness con checks DB/MinIO/SMTP) | Alta | Pendiente |
| T-155 | Exponer métricas Prometheus (/metrics) con prom-client | Media | Pendiente |
| T-156 | Integrar Sentry en backend y frontend | Media | Pendiente |
| T-157 | Crear docker-compose.yml de producción (frontend, backend, postgres, minio, jsreport, caddy) | Alta | Pendiente |
| T-158 | Configurar GitHub Actions de deploy a staging y producción | Alta | Pendiente |
| T-159 | Configurar variables de entorno de producción y secretos | Alta | Pendiente |
| T-160 | Documentar runbook de despliegue y rollback | Media | Pendiente |

---

### T-153 — Configurar pino con requestId propagado FE→BE y contexto de usuario

- **Descripción:** Asegurar que cada log en el backend incluya `requestId` (de T-013), y enriquecer con `userId`, `plazaId`, `rol` cuando estén disponibles en el `request.user`. Materializa S-Obs (parte de logs).
- **Criterios de aceptación:**
  - [ ] `Logger` global con `nestjs-pino` (T-013).
  - [ ] Middleware de Express que lee `x-request-id` (header propagado de Next.js por T-033) o genera UUID v4.
  - [ ] Si el `request.user` está presente (post-JwtAuthGuard), se añade al contexto: `userId`, `plazaId`, `rol`.
  - [ ] Cada log de request (entrada, salida, error) incluye estos campos.
  - [ ] Logs en formato JSON en prod, pretty en dev.
  - [ ] Secretos redactados: `password`, `token`, `authorization`, `cookie` → `[Redacted]`.
  - [ ] Performance: < 1ms overhead por log.
  - [ ] Las queries a BD se loguean con el SQL y la duración (con `prisma-logger` o similar).
  - [ ] Cada log se puede buscar en Loki/CloudWatch por `requestId` para correlación.
- **Dependencias:** T-013, T-022, T-033 (en `02-autenticacion-usuarios.md`).
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-154 — Implementar /api/v1/health (liveness) y /api/v1/health/ready (readiness con checks DB/MinIO/SMTP)

- **Descripción:** Implementar los endpoints de health check estándar de Kubernetes / load balancers. Liveness: solo verifica que el proceso está vivo. Readiness: verifica las dependencias (PostgreSQL, MinIO, SMTP). Materializa `docs/07` §4.8.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/health` retorna `{ status: 'ok', uptime, version }`. Sin checks de dependencias. Siempre 200 si el proceso responde.
  - [ ] `GET /api/v1/health/ready` ejecuta checks:
    - DB: `SELECT 1` con timeout 2s. Si falla → `503` con detalle.
    - MinIO: `bucketExists` con timeout 2s.
    - SMTP: conexión TCP con timeout 2s.
    - jsreport (opcional): `GET /api/ping` con timeout 2s.
  - [ ] Si todos los checks pasan → 200 `{ status: 'ready', checks: { db: 'ok', minio: 'ok', smtp: 'ok' } }`.
  - [ ] Si alguno falla → 503 con el detalle.
  - [ ] Ambos endpoints excluidos del rate limit (decorador `@SkipThrottle()`).
  - [ ] Excluidos de auditoría (decorador `@SkipAuditoria()`).
  - [ ] Logging de los checks con pino.
- **Dependencias:** T-110, T-119, T-149, T-150.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-155 — Exponer métricas Prometheus (/metrics) con prom-client

- **Descripción:** Exponer un endpoint `/metrics` con formato Prometheus. Incluye métricas HTTP estándar, métricas de negocio, y métricas de colas. Materializa S-Obs (parte de métricas).
- **Criterios de aceptación:**
  - [ ] `prom-client` configurado en `backend/src/common/metrics/metrics.module.ts`.
  - [ ] `GET /metrics` retorna el output Prometheus text format.
  - [ ] Métricas por defecto:
    - `http_requests_total{method, route, status}` (Counter)
    - `http_request_duration_seconds{method, route, status}` (Histogram)
    - `http_requests_in_progress` (Gauge)
  - [ ] Métricas de negocio (custom):
    - `solicitudes_por_estado{estado, plaza_id}` (Gauge, actualizado por el cron de KPIs)
    - `email_log_pendientes{plaza_id}` (Gauge)
    - `lock_activos{plaza_id}` (Gauge)
    - `cron_execution_duration_seconds{name}` (Histogram)
  - [ ] Default metrics de Node.js: process_cpu_seconds_total, nodejs_eventloop_lag_seconds, etc.
  - [ ] Endpoint excluido de auth (es público pero protegido a nivel red por el ALB).
  - [ ] Documentación en `docs/07` de qué métricas existen.
- **Dependencias:** T-141, T-122, T-098.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-156 — Integrar Sentry en backend y frontend

- **Descripción:** Integrar Sentry para tracking de errores 5xx y eventos importantes. Materializa S-Obs.
- **Criterios de aceptación:**
  - [ ] `backend/src/common/sentry/sentry.module.ts` con `@sentry/node`.
  - [ ] `Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, tracesSampleRate: 0.1 })` en `main.ts`.
  - [ ] Los errores 5xx se reportan automáticamente vía filter global.
  - [ ] Scope: incluye `plazaId`, `userId`, `requestId` cuando estén disponibles.
  - [ ] Source maps subidos en el build de producción.
  - [ ] `frontend/sentry.client.config.ts` y `frontend/sentry.server.config.ts` con `@sentry/nextjs`.
  - [ ] Errores del cliente se reportan a Sentry con contexto de usuario.
  - [ ] Variable `SENTRY_DSN` en `.env` (vacía en dev).
  - [ ] PII (passwords, tokens) redactado con `beforeSend`.
- **Dependencias:** T-152, T-153, T-009.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-157 — Crear docker-compose.yml de producción (frontend, backend, postgres, minio, jsreport, caddy)

- **Descripción:** Crear `docker-compose.prod.yml` con la topología de producción: backend detrás de Caddy (reverse proxy con TLS automático via Let's Encrypt), jsreport en red privada sin exposición pública, MinIO interno, PostgreSQL externo (RDS) o contenedor, frontend detrás de Caddy o CDN. Materializa S-Deploy.
- **Criterios de aceptación:**
  - [ ] `docker-compose.prod.yml` en la raíz.
  - [ ] Servicios: `caddy` (reverse proxy con TLS), `frontend`, `backend`, `jsreport` (red privada), `minio` (red privada).
  - [ ] PostgreSQL como variable: si `DATABASE_URL` apunta a RDS, no se incluye; si no, se incluye como `postgres` en la compose.
  - [ ] Caddyfile configura TLS automático con Let's Encrypt para el dominio y los subdominios wildcard (`*.plazapp.com`).
  - [ ] Caddy hace proxy de `/api/*` al backend y del resto al frontend.
  - [ ] Volúmenes para datos persistentes: `miniodata`, `jsreportdata` (si aplica), logs.
  - [ ] Health checks configurados.
  - [ ] `docker-compose -f docker-compose.prod.yml up -d` levanta todo.
  - [ ] Variables de entorno cargadas desde `.env.prod` (no commiteado).
  - [ ] jsreport NO es accesible públicamente (solo desde backend en la red interna).
  - [ ] Documentado en `docs/07` §4.10.
- **Dependencias:** T-006, T-007, T-008, T-135, T-009.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-158 — Configurar GitHub Actions de deploy a staging y producción

- **Descripción:** Pipeline de CI/CD que despliega automáticamente a staging en cada merge a `develop` y a producción con aprobación manual en cada tag. Materializa S-CI.
- **Criterios de aceptación:**
  - [ ] `.github/workflows/ci.yml` (lint + build, ya existe de T-011).
  - [ ] `.github/workflows/deploy-staging.yml` con trigger en push a `develop`:
    - Build de imágenes Docker con tag `staging-{sha}`.
    - Push a GitHub Container Registry.
    - SSH al servidor de staging y ejecuta `docker-compose pull && docker-compose up -d`.
    - Ejecuta `prisma migrate deploy`.
    - Smoke test (`GET /api/v1/health/ready`).
  - [ ] `.github/workflows/deploy-prod.yml` con trigger en tag `v*`:
    - Mismo flujo pero con tag `prod-{version}`.
    - Requiere aprobación manual (GitHub Environment `production` con required reviewers).
    - Backup de BD antes del deploy.
  - [ ] Secrets de GitHub configurados: `STAGING_SSH_KEY`, `PROD_SSH_KEY`, `STAGING_HOST`, `PROD_HOST`, `DATABASE_URL`, `JWT_SECRET`, `SENTRY_DSN`, etc.
  - [ ] Documentado en `docs/07` §4.9.
- **Dependencias:** T-011, T-157.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-159 — Configurar variables de entorno de producción y secretos

- **Descripción:** Crear `infrastructure/env.prod.example` con todas las variables de producción. Documentar dónde se almacenan los secretos (GitHub Secrets, Vault, etc.). Materializa S-Deploy.
- **Criterios de aceptación:**
  - [ ] `infrastructure/env.prod.example` con todas las variables de producción (NO los secretos reales).
  - [ ] Cada variable con un comentario explicativo.
  - [ ] Documentación de dónde se configura cada secreto:
    - `JWT_SECRET` y `AUTH_SECRET`: idénticos, generados con `openssl rand -base64 64`.
    - `DATABASE_URL`: RDS endpoint con SSL.
    - `SMTP_*`: del proveedor (SendGrid/SES/Mailgun).
    - `MINIO_*`: del bucket de producción.
    - `JSREPORT_URL`: `http://jsreport:5488` (interno).
    - `SENTRY_DSN`: del proyecto de Sentry.
    - `LOG_LEVEL`: `info` por defecto.
  - [ ] Rotación documentada (cada cuánto se rotan los secretos).
  - [ ] Política de "least privilege" en IAM de AWS / GCP.
- **Dependencias:** T-009, T-158.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-160 — Documentar runbook de despliegue y rollback

- **Descripción:** Crear `docs/08-runbook.md` con los procedimientos operacionales: deploy paso a paso, rollback, manejo de incidentes comunes (lockeos, errores SMTP, etc.).
- **Criterios de aceptación:**
  - [ ] `docs/08-runbook.md` cubre:
    - **Deploy a producción**: paso a paso con comandos.
    - **Rollback**: cómo revertir a la versión anterior (git tag + redeploy).
    - **Migración de BD**: cómo correr `prisma migrate deploy` y qué hacer si falla.
    - **Recuperación de disaster**: backup + restore desde PITR.
    - **Monitoreo**: qué dashboards revisar diariamente.
    - **Alertas**: cómo configurar alertas Prometheus (latencia alta, error rate > 1%, queue de emails > 100).
    - **Oncall**: contacto del equipo, escalamiento.
    - **Incidentes comunes**:
      - SMTP caído: cómo verificar y cambiar de proveedor.
      - MinIO lleno: cómo expandir volumen.
      - DB bloqueada: cómo identificar y matar queries.
      - Lock de revisión no se libera: cómo liberar manualmente.
  - [ ] Plantilla de post-mortem.
  - [ ] El runbook es < 10 páginas impresas.
- **Dependencias:** T-154, T-155, T-156, T-157, T-158.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*
