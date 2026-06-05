# 07 · Arquitectura

> **Código del documento:** `DOC-07-AR`
> **Estado:** Borrador para validación
> **Complementa:** [`02-stack-tecnologico.md`](./02-stack-tecnologico.md) (stack) y [`06-roles-y-permisos.md`](./06-roles-y-permisos.md) (autorización).

---

## 7.1. Vista de componentes

```mermaid
flowchart LR
    Browser[Navegador del usuario]

    subgraph Frontend["Frontend · Next.js 14 (App Router)"]
        SC[Server Components]
        CC[Client Components]
        AuthFE[Auth.js NextAuth]
        MID[Middleware tenant resolver]
    end

    subgraph Backend["Backend · NestJS 10 /api/v1"]
        G1[JwtAuthGuard]
        G2[PlazaScopeGuard]
        G3[RolesGuard]
        M1[auth]
        M2[plazas]
        M3[usuarios]
        M4[locales + contratos]
        M5[solicitudes]
        M6[aprobaciones]
        M7[notificaciones]
        M8[calendario]
        M9[adjuntos]
        M10[reportes]
        M11[admin]
    end

    subgraph Persist["Persistencia y servicios"]
        PG[(PostgreSQL 16)]
        MinIO[(MinIO)]
        SMTP[SMTP]
        Cache[(Redis opcional)]
    end

    Browser -- HTTPS --> SC
    Browser -- HTTPS --> CC
    SC -- fetch + Bearer JWT --> M1
    SC -- fetch + Bearer JWT --> M2
    CC -- fetch + Bearer JWT --> M5
    MID -- asigna plaza_id al request --> SC
    AuthFE -- cookie httpOnly --> Browser

    M1 --> G1
    M2 --> G1 --> G2 --> G3
    M3 --> G1 --> G2 --> G3
    M4 --> G1 --> G2 --> G3
    M5 --> G1 --> G2 --> G3
    M6 --> G1 --> G2 --> G3
    M7 --> SMTP
    M8 --> G1 --> G2 --> G3
    M9 --> MinIO
    M10 --> G1 --> G2 --> G3
    M11 --> G1

    M2 & M3 & M4 & M5 & M6 & M8 & M10 --> PG
    M9 --> PG
    M7 --> PG
    PG -. RLS .-> G2
```

---

## 7.2. Resolución de tenant (multi-tenant)

### 7.2.1. Estrategia dual

| Entorno | Método de resolución |
|---|---|
| Producción | Subdominio: `acme.plazapp.com` → `slug = "acme"`. Requiere DNS wildcard y certificado TLS SAN/wildcard. |
| Desarrollo / staging | Path: `/p/acme/...`. Útil para que múltiples tenants coexistan en un solo host. |

### 7.2.2. Middleware Next.js (referencia)

```ts
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PLATFORM_HOSTS = ['plazapp.com', 'localhost:3000'];

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  let slug: string | null = null;

  if (PLATFORM_HOSTS.some(p => host.endsWith(p))) {
    // Path-based: /p/{slug}/...
    const match = req.nextUrl.pathname.match(/^\/p\/([a-z0-9-]+)(\/|$)/);
    if (match) slug = match[1];
  } else {
    // Subdomain-based: acme.plazapp.com
    const sub = host.split('.')[0];
    if (sub && sub !== 'www') slug = sub;
  }

  const requestHeaders = new Headers(req.headers);
  if (slug) requestHeaders.set('x-plaza-slug', slug);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 7.2.3. NestJS: `PlazaScopeGuard` (referencia)

```ts
@Injectable()
export class PlazaScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new UnauthorizedException();
    if (user.rol === 'superadmin') return true; // sin scope

    const slug = req.headers['x-plaza-slug'] || req.query.plaza;
    if (!slug || slug !== user.plazaSlug) {
      throw new ForbiddenException('Tenant mismatch');
    }
    req.plazaId = user.plazaId;
    return true;
  }
}
```

### 7.2.4. RLS como segunda capa

NestJS ejecuta al inicio de cada request transaccional:

```sql
SET LOCAL app.plaza_id = '<uuid>';
```

Las políticas RLS (definidas en [`04-modelo-de-datos.md`](./04-modelo-de-datos.md)) garantizan que ninguna query escape del tenant aunque el código de aplicación tenga un bug.

---

## 7.3. Organización de carpetas

### 7.3.1. Frontend (Next.js)

```
frontend/
├── app/
│   ├── (public)/                  # Rutas sin auth (landing, login)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── reset-password/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (plaza)/                   # Rutas autenticadas dentro de una plaza
│   │   ├── p/
│   │   │   └── [slug]/
│   │   │       ├── layout.tsx     # Resuelve plaza por slug, hidrata session
│   │   │       ├── dashboard/
│   │   │       │   └── page.tsx   # Panel admin/inquilino
│   │   │       ├── solicitudes/
│   │   │       │   ├── page.tsx
│   │   │       │   ├── nueva/page.tsx
│   │   │       │   └── [id]/page.tsx
│   │   │       ├── locales/
│   │   │       ├── contratos/
│   │   │       ├── calendario/
│   │   │       ├── reportes/
│   │   │       └── configuracion/
│   ├── admin-plataform/           # Rutas de superadmin (sin tenant)
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── plazas/
│   ├── api/                       # API routes internas (opcional, preferimos BFF por Server Actions)
│   │   └── auth/
│   │       └── [...nextauth]/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                        # shadcn/ui (Button, Input, Dialog, ...)
│   ├── client/                    # Client Components aislados
│   │   ├── Calendar.tsx
│   │   ├── FileUpload.tsx
│   │   └── SolicitudForm.tsx
│   └── server/                    # Server Components
├── lib/
│   ├── auth.ts                    # Configuración de Auth.js
│   ├── api.ts                     # Cliente HTTP con reintento y manejo 401/403
│   ├── contracts/                 # Zod schemas compartidos
│   └── utils/
├── public/
├── middleware.ts
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 7.3.2. Backend (NestJS)

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   └── plaza-scope.decorator.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── plaza-scope.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── interceptors/
│   │   │   ├── plaza-scope.interceptor.ts
│   │   │   └── logging.interceptor.ts
│   │   ├── pipes/
│   │   │   └── zod-validation.pipe.ts
│   │   └── utils/
│   │       └── rls-context.ts
│   ├── config/
│   │   ├── env.ts                 # Carga tipada de .env
│   │   └── jwt.config.ts
│   ├── modules/
│   │   ├── auth/                  # /api/v1/auth/*
│   │   ├── plazas/                # /api/v1/plazas/*
│   │   ├── usuarios/              # /api/v1/usuarios/*
│   │   ├── locales/               # /api/v1/locales/*
│   │   ├── contratos/             # /api/v1/contratos/*
│   │   ├── solicitudes/           # /api/v1/solicitudes/*
│   │   ├── aprobaciones/          # /api/v1/solicitudes/:id/aprobacion
│   │   ├── notificaciones/        # worker + endpoint /api/v1/notificaciones
│   │   ├── calendario/            # /api/v1/calendario/*
│   │   ├── adjuntos/              # /api/v1/solicitudes/:id/adjuntos
│   │   ├── reportes/              # /api/v1/reportes/*
│   │   └── admin/                 # /api/v1/admin/* (superadmin)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── templates/
│       ├── solicitud-recibida.html
│       ├── solicitud-aprobada.html
│       └── ... (todas las plantillas)
├── test/
│   ├── unit/
│   └── e2e/
├── nest-cli.json
├── tsconfig.json
├── .env.example
└── package.json
```

### 7.3.3. Repositorio (monorepo opcional)

```
sys-solicitudes/
├── frontend/
├── backend/
├── packages/
│   └── contracts/                 # Zod schemas compartidos
├── docker-compose.yml             # Postgres, MinIO, MailHog, Redis
├── docker-compose.prod.yml
├── .github/workflows/
│   ├── ci.yml                     # lint + test + build
│   └── deploy.yml                 # build imágenes y push
└── README.md
```

> **SUPUESTO S-ARQ-A:** se entrega como monorepo. Si el cliente prefiere repos separados, se separa sin cambio funcional.

---

## 7.4. Convenciones de código

### 7.4.1. TypeScript

- `"strict": true` en ambos proyectos.
- Sin `any` salvo casos justificados con comentario `// eslint-disable-next-line`.
- Paths alias: `@/*` (frontend), `@/*` y `@modules/*` (backend).

### 7.4.2. Linting y formato

- **Frontend:** ESLint (`next/core-web-vitals` + `@typescript-eslint`) + Prettier.
- **Backend:** ESLint (`@typescript-eslint/recommended`) + Prettier.
- Prettier global con `printWidth: 100`, `singleQuote: true`, `semi: true`.

### 7.4.3. Commits y branches

- **Conventional Commits** (`feat:`, `fix:`, `chore:`, etc.).
- **Branches:** `main` (protegida), `develop`, `feat/*`, `fix/*`, `release/*`.
- **PRs:** requieren 1 aprobación + CI en verde.

### 7.4.4. Estructura de un módulo NestJS

```
modules/solicitudes/
├── solicitudes.module.ts
├── controllers/
│   └── solicitudes.controller.ts
├── services/
│   ├── solicitudes.service.ts
│   └── solicitudes-state.service.ts   # máquina de estados
├── dto/
│   ├── create-solicitud.dto.ts
│   ├── update-solicitud.dto.ts
│   └── filter-solicitud.dto.ts
├── entities/                          # tipos Prisma generados
│   └── solicitud.entity.ts
├── tests/
│   ├── solicitudes.service.spec.ts
│   └── solicitudes.e2e-spec.ts
└── schemas/                           # Zod
    └── solicitud.schema.ts
```

---

## 7.5. Contratos API (referencia de estilo)

> No exhaustivo. Lista los endpoints críticos. Documentación viva autogenerada con `@nestjs/swagger` en `/api/docs`.

### 7.5.1. Convenciones

- **Versionado:** prefijo `/api/v1`.
- **Formato:** JSON. Codificación UTF-8.
- **Fechas:** ISO-8601 con TZ (p. ej. `2026-05-20T14:30:00-06:00`).
- **Paginación:** `?page=1&pageSize=20&sort=createdAt:desc`.
- **Filtros:** query params nombrados (`estado`, `tipo`, `localId`, `from`, `to`).
- **Errores:** RFC 7807 (Problem Details). Campos: `type`, `title`, `status`, `detail`, `instance`, `code`.
- **Códigos de error de dominio:** `SOLICITUD_LOCKED`, `CONTRATO_OVERLAP`, `LOCAL_NO_DISPONIBLE`, `ADJUNTO_MIME_INVALIDO`, etc.

### 7.5.2. Endpoints clave

```http
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/reset-password
POST   /api/v1/auth/reset-password/confirm

GET    /api/v1/plazas
POST   /api/v1/plazas                (superadmin)
GET    /api/v1/plazas/:id
PATCH  /api/v1/plazas/:id

GET    /api/v1/usuarios
POST   /api/v1/usuarios
GET    /api/v1/usuarios/:id
PATCH  /api/v1/usuarios/:id
DELETE /api/v1/usuarios/:id          (soft delete)

GET    /api/v1/locales
POST   /api/v1/locales
GET    /api/v1/locales/:id
PATCH  /api/v1/locales/:id
DELETE /api/v1/locales/:id

GET    /api/v1/inquilinos
POST   /api/v1/inquilinos
GET    /api/v1/inquilinos/:id
PATCH  /api/v1/inquilinos/:id

GET    /api/v1/contratos
POST   /api/v1/contratos
GET    /api/v1/contratos/:id
PATCH  /api/v1/contratos/:id
POST   /api/v1/contratos/:id/cerrar

GET    /api/v1/solicitudes?estado=&tipo=&localId=&from=&to=&page=
POST   /api/v1/solicitudes
GET    /api/v1/solicitudes/:id
PATCH  /api/v1/solicitudes/:id
DELETE /api/v1/solicitudes/:id        (solo en borrador, soft)
POST   /api/v1/solicitudes/:id/enviar
POST   /api/v1/solicitudes/:id/cancelar
POST   /api/v1/solicitudes/:id/tomar
POST   /api/v1/solicitudes/:id/aprobar
POST   /api/v1/solicitudes/:id/rechazar
POST   /api/v1/solicitudes/:id/subsanar
POST   /api/v1/solicitudes/:id/comentarios
GET    /api/v1/solicitudes/:id/historial

POST   /api/v1/solicitudes/:id/adjuntos
GET    /api/v1/solicitudes/:id/adjuntos
DELETE /api/v1/solicitudes/:id/adjuntos/:adjuntoId

GET    /api/v1/calendario/eventos?from=&to=
GET    /api/v1/calendario/eventos.ics

GET    /api/v1/notificaciones/log

GET    /api/v1/reportes/solicitudes?...filtros
GET    /api/v1/reportes/solicitudes/export.csv
GET    /api/v1/reportes/solicitudes/export.xlsx
GET    /api/v1/reportes/locales/:id
GET    /api/v1/reportes/inquilinos/:id

GET    /api/v1/admin/plazas           (superadmin)
GET    /api/v1/admin/metricas         (superadmin)
```

---

## 7.6. Variables de entorno

### 7.6.1. Backend (`.env`)

```env
# App
NODE_ENV=development
PORT=4000
APP_BASE_URL=http://localhost:4000
CORS_ORIGINS=http://localhost:3000

# PostgreSQL
DATABASE_URL=postgresql://app:app@postgres:5432/solicitudes
DATABASE_DIRECT_URL=postgresql://app:app@postgres:5432/solicitudes

# Auth / JWT
JWT_SECRET=replace-me-with-a-long-random-string
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# MinIO
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
MINIO_BUCKET_PREFIX=solicitudes

# SMTP
SMTP_HOST=mailhog
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Plazapp <no-reply@plazapp.com>"

# Redis (opcional)
REDIS_URL=redis://redis:6379

# Logging
LOG_LEVEL=debug
```

### 7.6.2. Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
AUTH_SECRET=replace-me-with-a-long-random-string
NEXTAUTH_URL=http://localhost:3000
```

> **SUPUESTO S-ARQ-B:** `AUTH_SECRET` y `JWT_SECRET` son la misma clave (HS256 compartido). En producción se considera migrar a RS256 con JWKS si los clientes crecen.

---

## 7.7. Seguridad

- **TLS obligatorio en producción.**
- **Helmet** activo en NestJS.
- **CORS** restrictivo.
- **Rate limit** con `@nestjs/throttler`.
- **CSRF** no aplica (autenticación por Bearer token, no cookies de sesión en backend).
- **Validación de inputs** con `ZodValidationPipe`.
- **Sanitización de HTML** en descripciones de solicitudes.
- **Auditoría** capturada en `auditoria` para todo `POST`, `PATCH`, `DELETE`.
- **Backups:** ver [`04-modelo-de-datos.md`](./04-modelo-de-datos.md), §4.8.

---

## 7.8. Observabilidad

**SUPUESTO S-Obs.** Stack propuesto:

- **Logs estructurados** (JSON) con `pino` (backend) y `pino` en middleware Next.js.
- **Trazabilidad:** `requestId` propagado de Next.js a NestJS vía header.
- **Métricas:** Prometheus + Grafana (mínimo: `http_requests_total`, `http_request_duration_seconds`, `solicitudes_por_estado`).
- **Errores:** Sentry o equivalente (SUPUESTO).
- **Health checks:** `/api/v1/health` (liveness) y `/api/v1/health/ready` (readiness con check de DB, MinIO, SMTP).

---

## 7.9. CI/CD (referencia)

**SUPUESTO S-CI.** Pipeline mínimo con GitHub Actions:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      minio:
        image: minio/minio
        ports: ['9000:9000']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd backend && npm ci
      - run: cd backend && npm run lint
      - run: cd backend && npm run test
      - run: cd backend && npm run test:e2e
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run test
      - run: cd frontend && npm run build
```

---

## 7.10. Despliegue (referencia)

> **El hosting NO está incluido en la cotización.** Esta sección es referencia, no compromiso.

### 7.10.1. `docker-compose.yml` (desarrollo)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: solicitudes
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minio
      MINIO_ROOT_PASSWORD: minio123
    ports: ['9000:9000', '9001:9001']
    volumes: ['miniodata:/data']

  mailhog:
    image: mailhog/mailhog
    ports: ['1025:1025', '8025:8025']

  backend:
    build: ./backend
    depends_on: [postgres, minio, mailhog]
    env_file: ./backend/.env
    ports: ['4000:4000']

  frontend:
    build: ./frontend
    depends_on: [backend]
    env_file: ./frontend/.env.local
    ports: ['3000:3000']

volumes:
  pgdata: {}
  miniodata: {}
```

### 7.10.2. Producción (referencia, no contractual)

- **Frontend:** contenedor Docker, expuesto tras CDN/Cloudflare.
- **Backend:** contenedor Docker detrás de ALB / nginx.
- **PostgreSQL:** RDS o equivalente administrado.
- **MinIO:** migrable a S3 cambiando variables de entorno.
- **SMTP:** proveedor transaccional (SendGrid, SES, Mailgun).
- **Backups:** automatizados según política de retención.
- **TLS:** cert-manager + Let's Encrypt o equivalente.
- **Monitoreo:** stack Prometheus + Grafana + alertas.

---

## 7.11. Resumen de SUPUESTOS del documento

| ID | Supuesto |
|---|---|
| S-ARQ-A | Monorepo `frontend + backend + packages/contracts`. |
| S-ARQ-B | `JWT_SECRET` y `AUTH_SECRET` son la misma clave (HS256). |
| S-ARQ-C | Resolución de tenant por subdominio en prod, path en dev. |
| S-ARQ-D | `@nestjs/swagger` para documentación OpenAPI en `/api/docs`. |
| S-Obs | Logs con `pino`, métricas con Prometheus, errores con Sentry. |
| S-CI | GitHub Actions para CI. |
| S-ARQ-E | Frontend NO expone la API de NestJS al cliente; pasa por Server Components / Server Actions. |
| S-ARQ-F | Cookies httpOnly + secure; nunca se expone el JWT a JavaScript del cliente. |
| S-ARQ-G | CSRF no aplica por usar Bearer; el frontend nunca usa cookies de sesión del backend. |
