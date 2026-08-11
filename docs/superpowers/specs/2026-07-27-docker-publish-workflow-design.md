# Design · Publicación de imágenes a Docker Hub

**Fecha:** 2026-07-27
**Owner:** Reyles
**Status:** Draft (pendiente de aprobación)

## Contexto

El monorepo `sys-solicitudes` (Plazapp) tiene dos servicios — `frontend/` (Next.js 14) y `backend/` (NestJS 10) — cada uno con su propio `Dockerfile` multi-stage en producción. `docker-compose.prod.yml` los construye localmente con tags internos (`plazapp-frontend:staging`, `plazapp-backend:staging`).

Hoy **no existe ninguna automatización** para publicar las imágenes en Docker Hub. El owner debe correr `docker build` + `docker push` manualmente desde su máquina, lo que:

1. Requiere tener el toolchain de Docker local y acceso a credenciales de Docker Hub.
2. Es propenso a drift entre la versión local y lo que se ejecuta en producción.
3. No escala a un equipo (cualquier dev debe repetir el proceso).

**Objetivo:** automatizar la build + push de ambas imágenes a Docker Hub en cada merge a `main`, sin rehacer los Dockerfiles existentes (que ya son correctos y siguen los patrones del proyecto, ver `backend/Dockerfile` y `frontend/Dockerfile`).

## Goals

- **G1.** En cada push a `main`, construir y publicar automáticamente `reyles/sys-solicitudes-backend` y `reyles/sys-solicitudes-frontend` con tags `:latest` y `:<short-sha>`.
- **G2.** Permitir builds manuales vía `workflow_dispatch` con inputs opcionales para los `NEXT_PUBLIC_*` del frontend (sin redeployar el código).
- **G3.** Cachear capas de Docker en GitHub Actions cache para reducir tiempos de build.
- **G4.** Reusar los Dockerfiles existentes **sin modificarlos** (los patrones multi-stage con deps/builder/runner ya están validados).
- **G5.** Ser explícito sobre los secrets y variables que el owner debe configurar en el repo.

## Non-Goals

- Publicar imágenes multi-arch (`linux/arm64`). **Asunción A1:** el deploy se realiza en un servidor Ubuntu x86_64, por lo que `linux/amd64` es suficiente en v1.
- Crear un workflow de release versionado con semver (`v1.2.3` → tags `:1.2.3`). Se puede añadir después si el owner decide versionar releases.
- Publicar a un registry distinto (GHCR, ECR, GCR). Solo Docker Hub.
- Modificar los Dockerfiles de `frontend/` o `backend/`. La solución se limita a `.github/workflows/docker-publish.yml`.
- Tests automatizados dentro del workflow. `docs/02-stack-tecnologico.md §2.11` confirma que v1 NO tiene tests automatizados; los Dockerfiles no corren tests durante build.

## Arquitectura

### Archivo único

- **Ruta:** `.github/workflows/docker-publish.yml`
- **Reutiliza:**
  - `frontend/Dockerfile` (multi-stage Next.js standalone, ya existente)
  - `backend/Dockerfile` (multi-stage NestJS + Prisma, ya existente)
- **No modifica** ningún Dockerfile ni `docker-compose.prod.yml`.

### Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│              .github/workflows/docker-publish.yml               │
│  on: push (main) | workflow_dispatch                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────┐       ┌──────────────────────┐       │
│  │  build-backend       │       │  build-frontend      │       │
│  │  (paralelo)          │       │  (paralelo)          │       │
│  ├──────────────────────┤       ├──────────────────────┤       │
│  │ checkout             │       │ checkout             │       │
│  │ setup-buildx         │       │ setup-buildx         │       │
│  │ login dockerhub      │       │ login dockerhub      │       │
│  │ metadata-action      │       │ metadata-action      │       │
│  │ build-push-action    │       │ build-push-action    │       │
│  │   └─ context: .      │       │   └─ context: .      │       │
│  │   └─ file: backend/  │       │   └─ file: frontend/ │       │
│  │   └─ platforms: amd64│       │   └─ platforms: amd64│       │
│  │   └─ cache: gha      │       │   └─ cache: gha      │       │
│  │   └─ push: true (push│       │   └─ NEXT_PUBLIC_*   │       │
│  │     a main)          │       │     build args       │       │
│  └──────────────────────┘       └──────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Triggers

| Trigger | Comportamiento | Tags generados |
|---|---|---|
| `push` a `main` | Build + push | `:latest`, `:<short-sha>` |
| `workflow_dispatch` | Build + push (mismo comportamiento) | `:latest`, `:<short-sha>` (default) o el `tag` que se pase como input |

**Nota:** `flavor: latest=auto` en `metadata-action` hace que `:latest` se aplique **solo en push a main** (no en PRs — aunque este workflow no escucha PRs). En `workflow_dispatch`, el owner puede pasar un `tag` input para evitar pisar `:latest` accidentalmente.

### Tags generados

| Evento | Tags |
|---|---|
| Push a main | `reyles/sys-solicitudes-{svc}:latest`, `reyles/sys-solicitudes-{svc}:<short-sha>` |
| Manual con `tag=v1.2.3-rc1` | `reyles/sys-solicitudes-{svc}:v1.2.3-rc1`, `reyles/sys-solicitudes-{svc}:latest`, `reyles/sys-solicitudes-{svc}:<short-sha>` |

Donde `{svc}` ∈ `{backend, frontend}`.

## Jobs

### `build-backend`

Pasos:

1. `actions/checkout@v4` con `fetch-depth: 0`.
2. `docker/setup-buildx-action@v3` (prepara builder con cache GHA).
3. `docker/login-action@v3` con secrets `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN`.
4. `docker/metadata-action@v5`:
   - `images: reyles/sys-solicitudes-backend`
   - `tags: |` → `type=raw,value=${{ github.event.inputs.tag }}` (si viene input) + `type=ref,event=branch` + `type=sha,format=short`
   - `flavor: latest=auto`
5. `docker/build-push-action@v6`:
   - `context: .`
   - `file: backend/Dockerfile`
   - `platforms: linux/amd64`
   - `tags: ${{ steps.meta.outputs.tags }}`
   - `labels: ${{ steps.meta.outputs.labels }}`
   - `cache-from: type=gha`
   - `cache-to: type=gha,mode=max`
   - `push: ${{ github.event_name != 'pull_request' }}`

### `build-frontend`

Idéntico a `build-backend` con diferencias:

- `file: frontend/Dockerfile`
- `images: reyles/sys-solicitudes-frontend`
- **Build args** (provenientes de inputs de `workflow_dispatch` o repo variables):
  - `NEXT_PUBLIC_API_URL`: `inputs.api_url` ?? `vars.NEXT_PUBLIC_API_URL` ?? `https://app.plazapp.com`
  - `NEXT_PUBLIC_APP_NAME`: `inputs.app_name` ?? `vars.NEXT_PUBLIC_APP_NAME` ?? `Plazapp`
  - `NEXT_PUBLIC_SENTRY_DSN`: `inputs.sentry_dsn` ?? `vars.NEXT_PUBLIC_SENTRY_DSN` ?? ``

### Comportamiento de `workflow_dispatch` con input `tag` vacío

`metadata-action` con `type=raw,value=${{ github.event.inputs.tag }}` **omite tags vacíos** automáticamente (es el comportamiento por defecto de la acción). Por tanto:

- Si `tag` está vacío → solo se generan `latest` + `short-sha`.
- Si `tag=v1.2.3-rc1` → se generan `v1.2.3-rc1` + `latest` + `short-sha`.

Esto evita tags espurios tipo `:""` en el registry.

```yaml
workflow_dispatch:
  inputs:
    tag:
      description: 'Tag opcional (ej: v1.2.3-rc1). Si vacío, usa short-sha + latest.'
      required: false
      type: string
    api_url:
      description: 'NEXT_PUBLIC_API_URL (override del repo var).'
      required: false
      type: string
      default: ''
    app_name:
      description: 'NEXT_PUBLIC_APP_NAME (override del repo var).'
      required: false
      type: string
      default: ''
    sentry_dsn:
      description: 'NEXT_PUBLIC_SENTRY_DSN (override del repo var).'
      required: false
      type: string
      default: ''
```

## Configuración requerida en el repo (manual, una sola vez)

### Secrets (Settings → Secrets and variables → Actions → Secrets)

| Nombre | Valor | Notas |
|---|---|---|
| `DOCKERHUB_USERNAME` | `reyles` | Usuario de Docker Hub. |
| `DOCKERHUB_TOKEN` | `<access token>` | Token de Docker Hub, NO la contraseña. Crear en hub.docker.com → Account Settings → Security → New Access Token con scope `Read, Write, Delete`. |

### Repo variables (Settings → Secrets and variables → Actions → Variables) — opcionales

| Nombre | Default | Notas |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://app.plazapp.com` | URL pública del API (frontend la hornea en build). |
| `NEXT_PUBLIC_APP_NAME` | `Plazapp` | Nombre de la app en el cliente. |
| `NEXT_PUBLIC_SENTRY_DSN` | _(vacío)_ | DSN de Sentry para errores del cliente. |

## Consideraciones

### Concurrencia

```yaml
concurrency:
  group: docker-publish-${{ github.ref }}
  cancel-in-progress: true
```

Cancela runs previos del mismo ref para evitar races al pushear el mismo tag.

### Permisos

```yaml
permissions:
  contents: read
```

Solo lectura del repo (necesario para checkout). El push al registry usa el `DOCKERHUB_TOKEN` configurado por el owner.

### Cache de capas

- `setup-buildx-action` con `driver-opts: image=moby/buildkit:v0.16.0` (default).
- `cache-from: type=gha` + `cache-to: type=gha,mode=max` → reusa capas entre runs. La clave del cache es implícita (hash del context + Dockerfile).

### ¿Por qué NO multi-arch?

**Asunción A1 (validada con el owner):** el deploy target es un servidor Ubuntu x86_64. Añadir `linux/arm64` duplicaría el tiempo de build sin beneficio inmediato. Si en el futuro se migra a AWS Graviton o similar, se añade `platforms: linux/amd64,linux/arm64` en una iteración.

### ¿Por qué reusar Dockerfiles existentes y no crear uno en la raíz?

Los Dockerfiles en `frontend/` y `backend/` son producción-ready (multi-stage, usuario no-root, healthcheck, `npm ci`). Reutilizarlos evita duplicación y mantiene una sola fuente de verdad. El workflow solo los invoca desde contexto raíz (necesario porque COPY relativos en `backend/Dockerfile` apuntan a `../packages`, `../tsconfig.base.json`, etc.).

## Validación post-implementación

Una vez mergeado y configurados los secrets:

1. Disparar manualmente el workflow desde la Actions UI con inputs vacíos → debe construir y pushear ambas imágenes.
2. Verificar en hub.docker.com/r/reyles → repos `sys-solicitudes-backend` y `sys-solicitudes-frontend` con tag `:latest`.
3. Hacer un push trivial a `main` (ej. README typo) → verificar que se publican los tags `:latest` + `:<short-sha>`.
4. Verificar que los Dockerfiles NO fueron modificados: `git diff frontend/Dockerfile backend/Dockerfile` debe estar vacío.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El owner olvida configurar `DOCKERHUB_TOKEN` antes del primer merge a main | El workflow falla con un error claro de "secret not found"; el código de la app no se ve afectado. |
| Push accidental de `:latest` con código roto a main | Asumimos que `main` siempre está verde (no hay tests automatizados, pero el owner valida localmente). Si se quiere más seguridad, añadir un job de lint+build previo que bloquee el push. |
| Tokens de Docker Hub quedan expuestos en logs | `docker/login-action` enmascara el password en logs; usamos access token (revocable) en vez de password. |

## Asunciones abiertas

- **A1 (validada):** deploy target = Ubuntu x86_64 → `linux/amd64` es suficiente. ✅
- **A2:** Docker Hub namespace = `reyles`. ✅ (confirmado por el owner).
- **A3:** Los Dockerfiles actuales son la fuente de verdad; no se modifican. ✅
- **A4:** El owner configurará `DOCKERHUB_USERNAME` y `DOCKERHUB_TOKEN` en el repo después del merge. (Acción manual, fuera del scope del workflow.)
- **A5:** No se requieren `cache-from` desde registry porque GitHub Actions cache es suficiente para v1. Si el cache GHA se queda corto, se puede cambiar a `type=registry,ref=reyles/sys-solicitudes-{svc}:cache` en una iteración futura.

## Out of scope (futuro)

- Workflow de release versionado (`v*.*.*` tags con semver).
- Multi-arch (`linux/arm64`).
- Escaneo de vulnerabilidades con `docker/scout-action` o `trivy`.
- SBOM (Software Bill of Materials) generado por buildx.
- Notificaciones de fallo (Slack, email) cuando el push falla.
