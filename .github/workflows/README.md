# CI/CD · Plazapp

> ⚠️ **CI DESHABILITADO TEMPORALMENTE (2026-06-06).** Aún no hay VPS/hosting de
> destino, así que el repo solo recibe pushes (no corre CI ni deploy). El
> `ci.yml` quedó con trigger `workflow_dispatch` (solo manual). Para re-habilitar:
> descomentar los triggers `push`/`pull_request` en `ci.yml` y añadir el job de
> deploy cuando exista el entorno (ver `PLANIFICACION/13-observabilidad-despliegue.md`).

## Workflows

| Archivo | Trigger | Jobs |
|---|---|---|
| `ci.yml` | **Manual (`workflow_dispatch`) — deshabilitado** | lint-fe, lint-be, build-contracts, build-fe, build-be |

## Decisiones aplicadas

- **T-V09:** Pipeline mínimo de CI (lint + build). Sin tests automatizados en v1.
- **T-V11:** Sin servicios Redis ni replicas en el job de build. Solo PostgreSQL.
- **T-V09:** Concurrency cancela runs previos en la misma rama/PR.

## Secrets requeridos (GitHub)

Estos secretos se usan en deploy (futuro, `PLANIFICACION/13-observabilidad-despliegue.md`):

- `STAGING_SSH_KEY` · clave SSH del servidor de staging
- `STAGING_HOST` · host del servidor de staging
- `PROD_SSH_KEY` · clave SSH del servidor de producción
- `PROD_HOST` · host del servidor de producción
- `DATABASE_URL` · URL de la BD de producción
- `JWT_SECRET` · secreto JWT (compartido con FE como `AUTH_SECRET`)
- `SENTRY_DSN` · DSN del proyecto Sentry
- `SMTP_*` · credenciales del proveedor SMTP transaccional
- `MINIO_*` · credenciales del bucket de producción (o S3)

## Cómo añadir un nuevo job

1. Copia un job existente como plantilla.
2. Asegúrate de cachear `node_modules` correctamente (cache-dependency-path).
3. Si usas servicios adicionales (redis, minio), agrégalos en `services:`.
