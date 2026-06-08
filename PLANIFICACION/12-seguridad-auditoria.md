# Módulo 12 — Seguridad y Auditoría

> **Propósito:** Helmet con CSP estricta, CORS restrictivo por env var, `@nestjs/throttler` con rate limit global y por endpoint, tabla `auditoria` append-only capturada por interceptor en cada POST/PATCH/DELETE, sanitización HTML en descripciones, errores RFC 7807 con códigos de dominio, validación Zod compartida.
>
> **Pre-requisito:** T-001 a T-145 (incluye Reportes) deben estar `Completada`. Algunas tareas de este módulo se solapan con las bases de `01-setup-base.md` y se consolidan aquí.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-146 | Crear migración Prisma con `auditoria` (append-only) | Alta | Completada |
| T-147 | Configurar Helmet con CSP estricta en NestJS | Alta | Completada |
| T-148 | Configurar CORS restrictivo por env var | Alta | Completada |
| T-149 | Configurar @nestjs/throttler: 100 req/min global, 5 req/min login, otros límites | Alta | Completada |
| T-150 | Implementar captura automática de auditoría en POST/PATCH/DELETE (Interceptor) | Alta | Completada |
| T-151 | Implementar sanitización HTML en descripciones de solicitudes | Alta | Completada |
| T-152 | Implementar excepciones RFC 7807 con códigos de dominio | Alta | Completada |

---

### T-146 — Crear migración Prisma con `auditoria` (append-only)

- **Descripción:** Crear el modelo `auditoria` (transversal, no solo de login): `id` (UUID), `plaza_id` (FK, NULL para superadmin), `usuario_id` (FK), `accion` (TEXT), `entidad_tipo` (TEXT), `entidad_id` (UUID, nullable), `antes` (JSONB), `despues` (JSONB), `ip` (TEXT), `user_agent` (TEXT), `request_id` (TEXT), `created_at`. Append-only.
- **Criterios de aceptación:**
  - [ ] Modelo `auditoria` con todos los campos.
  - [ ] Índices: `INDEX(plaza_id, created_at)`, `INDEX(usuario_id, created_at)`, `INDEX(entidad_tipo, entidad_id)`, `INDEX(accion)`.
  - [ ] Migración aplicada.
  - [ ] Trigger PL/pgSQL `tg_auditoria_no_update_delete` que rechaza UPDATE y DELETE.
  - [ ] Permisos de BD: el rol `syssol_app` solo tiene `INSERT` y `SELECT` sobre esta tabla.
  - [ ] RLS habilitado (excepto para `superadmin` que ve todas las plazas).
  - [ ] `auditoria_login` (de T-021) y `auditoria` son modelos distintos. `auditoria_login` es para auth, `auditoria` es para el resto.
- **Dependencias:** T-018, T-021.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — La tabla existía desde T-040 (versión mínima, con RLS ENABLE+FORCE y 2 índices). Migración `20260608021947_modulo_12_auditoria_append_only` completa lo faltante: índices `(usuario_id, created_at)` y `(accion)`, trigger `tg_auditoria_no_update_delete` (RAISE EXCEPTION en UPDATE/DELETE) y `REVOKE UPDATE, DELETE` a `syssol_app` (defensa en profundidad — tenía los 4 privilegios).
  - Verificado en BD: UPDATE y DELETE rechazados por el trigger (incluso como superusuario) y `permission denied` para `syssol_app`; el rol queda solo con INSERT+SELECT.
  - `auditoria_login` (T-021) y `auditoria` siguen siendo modelos distintos ✓.
  - ➕ Adición (decisión owner 2026-06-07): `GET /api/v1/auditoria` con filtros (accion/entidadTipo/entidadId/usuarioId/fechas) + paginación — `admin_plaza` ve SOLO su plaza (filtro explícito; las filas con plaza_id NULL son de plataforma y solo las ve superadmin). Verificado: admin demo 57 filas scoped; inquilino 403. Sin UI en v1.

### T-147 — Configurar Helmet con CSP estricta en NestJS

- **Descripción:** Activar Helmet con una Content Security Policy estricta que solo permita recursos del mismo origen y los assets necesarios. Materializa SEC-5.
- **Criterios de aceptación:**
  - [ ] `helmet` configurado en `main.ts` con:
    - `contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], fontSrc: ["'self'", "https://fonts.gstatic.com"], imgSrc: ["'self'", "data:", "blob:"], connectSrc: ["'self'", process.env.JSREPORT_URL, ...] } }`.
    - `hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }`.
    - `noSniff: true`, `frameguard: { action: 'deny' }`.
  - [ ] Headers de seguridad verificados con `curl -I`:
    - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `Referrer-Policy: strict-origin-when-cross-origin`
  - [ ] En dev, `hsts` se desactiva (porque se usa HTTP).
- **Dependencias:** T-015 (en `01-setup-base.md`).
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — Helmet ya estaba configurado desde T-015 (`common/security/helmet.config.ts`) con TODAS las directivas del plan (CSP con connectSrc a JSREPORT_URL, HSTS 1 año solo en prod, noSniff, frameguard DENY, referrerPolicy + extras: COOP/CORP, dnsPrefetch off, hidePoweredBy). Esta tarea fue verificación + un ajuste.
  - ⚠️ Fix: `scriptSrc` tenía un ternario sin efecto y `'unsafe-eval'` SIEMPRE activo — ahora `'unsafe-eval'` queda SOLO en dev (lo necesita Swagger UI); en prod `scriptSrc` = `'self' 'unsafe-inline'`.
  - Verificado con `curl -I`: `Content-Security-Policy` completa, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`; HSTS ausente en dev (correcto: criterio "en dev hsts se desactiva").

### T-148 — Configurar CORS restrictivo por env var

- **Descripción:** Configurar CORS para que solo permita los orígenes listados en `CORS_ORIGINS` (env var, lista separada por comas). Materializa SEC-5 y S-CORS.
- **Criterios de aceptación:**
  - [ ] `app.enableCors({ origin: env.CORS_ORIGINS.split(','), credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'x-plaza-slug', 'x-request-id'] })` en `main.ts`.
  - [ ] `CORS_ORIGINS=http://localhost:3000` en dev.
  - [ ] `CORS_ORIGINS=https://*.plazapp.com,https://app.plazapp.com` en prod.
  - [ ] Request desde origen no permitido: no recibe los headers CORS, el browser bloquea.
  - [ ] Request desde origen permitido: recibe `Access-Control-Allow-Origin` correcto.
  - [ ] Preflight `OPTIONS` con header `Access-Control-Request-Headers: authorization` es exitoso.
  - [ ] En producción, deshabilitar `Access-Control-Allow-Credentials: true` si el frontend y el backend están en el mismo origen (decisión de UX).
- **Dependencias:** T-009, T-015.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — CORS ya estaba en `main.ts` desde T-015 con `CORS_ORIGINS` (env, lista por comas), credentials, métodos y allowedHeaders exactos al criterio (+ exposedHeaders `x-request-id`/`Retry-After` y maxAge 24h del preflight). Esta tarea fue verificación + documentación.
  - Verificado: preflight OPTIONS con `Access-Control-Request-Headers: authorization` desde `http://localhost:3000` → headers Allow-* correctos; origen `http://evil.example.com` → CERO headers CORS (el browser bloquea).
  - ⚠️ Desviación de valores prod: `CORS_ORIGINS=https://app.plazapp.com` (documentado en `.env.example`) — el `https://*.plazapp.com` del criterio quedó OBSOLETO con T-V01 (single subdomain, sin wildcard).
  - Decisión documentada (criterio UX): `credentials: true` se MANTIENE en prod — el frontend usa BFF server-side (S-ARQ-E: el browser nunca llama a la API directamente), así que CORS solo aplica a tooling dev; no hay superficie que justifique romper el flujo.

### T-149 — Configurar @nestjs/throttler: 100 req/min global, 5 req/min login, otros límites

- **Descripción:** Configurar los rate limits con `@nestjs/throttler`. Materializa SEC-3, S-RateLimit, S-Lockout.
- **Criterios de aceptación:**
  - [ ] `ThrottlerModule.forRoot([{ name: 'global', ttl: 60000, limit: 100 }])` en `app.module.ts`.
  - [ ] `ThrottlerGuard` global con `APP_GUARD`.
  - [ ] `ThrottlerBehindProxyGuard` que lee la IP de `X-Forwarded-For` cuando está detrás de un proxy (T-014).
  - [ ] Decoradores específicos:
    - `POST /api/v1/auth/login`: `@Throttle({ default: { limit: 5, ttl: 60000 } })`.
    - `POST /api/v1/auth/reset-password`: `@Throttle({ default: { limit: 3, ttl: 60000 } })`.
    - `POST /api/v1/solicitudes/:id/enviar`: `@Throttle({ default: { limit: 10, ttl: 60000 } })`.
    - `POST /api/v1/locales/import-csv`: `@Throttle({ default: { limit: 2, ttl: 60000 } })`.
  - [ ] Cliente que excede el límite recibe `429 Too Many Requests` con header `Retry-After`.
  - [ ] Los `429` se loguean con `pino` y se reportan a Sentry (cuando T-156 esté lista).
- **Dependencias:** T-014.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — Base existente de T-014: ThrottlerModule 100 req/min + `ThrottlerBehindProxyGuard` global + login 5/min. Añadidos: `reset-password` 3/min y `solicitudes/:id/enviar` 10/min con `@Throttle({ default: ... })`.
  - ⚠️ Fix: el throttler se renombró de `'global'` a `'default'` — con nombre custom, @nestjs/throttler v6 sufija los headers (`Retry-After-global`); con `'default'` emite `Retry-After` limpio como exige el criterio. Verificado: 4ª request a reset-password → `429` + `Retry-After: 60` + envelope RFC 7807.
  - ⚠️ N/A: `POST /locales/import-csv` NO existe en el código (el import CSV de locales no se implementó en el módulo 04); el throttle se aplicará si esa funcionalidad llega.
  - Los 429 se loguean con pino vía `HttpExceptionFilter` (verificado en el log del backend); el reporte a Sentry queda para T-156 (módulo 13), como permite el criterio.

### T-150 — Implementar captura automática de auditoría en POST/PATCH/DELETE (Interceptor)

- **Descripción:** Implementar un `AuditoriaInterceptor` que capture el `antes` y `después` de cada mutación (POST/PATCH/DELETE) y la inserte en `auditoria`. Materializa SEC-7.
- **Criterios de aceptación:**
  - [ ] `backend/src/common/interceptors/auditoria.interceptor.ts`.
  - [ ] Usa `reflector` para detectar metadatos `@Auditable()` en el handler o controller. Si no está, NO captura.
  - [ ] Decorador `@Auditable({ accion, entidadTipo, getIdFromResponse? })` que el dev aplica en cada endpoint POST/PATCH/DELETE.
  - [ ] Para PATCH: el `antes` se obtiene con un SELECT antes del handler. El `después` con la response.
  - [ ] Para POST: el `antes` es null. El `después` es el body de la request (o la response).
  - [ ] Para DELETE: el `antes` es el registro antes. El `después` es null.
  - [ ] Registra `request_id`, `ip`, `user_agent`, `usuario_id` (de `request.user`).
  - [ ] Si la operación falla, NO se inserta en `auditoria` (solo se loguea el error en pino).
  - [ ] Aplicado a todos los endpoints de los módulos 02-11 (Tarea a hacer en cada módulo, aquí se documenta el patrón).
  - [ ] Decorador `@SkipAuditoria()` para excluir endpoints específicos (e.g. health checks).
- **Dependencias:** T-146, T-013, T-022.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — `AuditoriaInterceptor` (APP_INTERCEPTOR global) + decoradores `@Auditable({ accion, entidadTipo, paramId?, getIdFromResponse?, omitirBody? })` y `@SkipAuditoria()` en `common/decorators/auditable.decorator.ts`. PATCH/DELETE capturan `antes` con SELECT genérico best-effort sobre el modelo Prisma `entidadTipo`; POST persiste el body REDACTADO (llaves sensibles: password/token/secret/etc. → `[REDACTADO]`); si el handler lanza NO se inserta (tap solo en éxito).
  - ⚠️ Decisión de alcance (owner 2026-06-07): el interceptor es **OPT-IN y cubre huecos** — el survey confirmó que los ~45 endpoints de mutación de los módulos 02-11 YA auditan manualmente desde sus services (con antes/después curados). Migrarlos al interceptor duplicaría registros o degradaría la calidad; las llamadas manuales se mantienen y el interceptor es el patrón OFICIAL para endpoints nuevos.
  - Huecos cerrados: `POST /auth/reset-password/confirm` → `@Auditable('auth.password_reset_confirm', omitirBody: true)` (el body trae token+password). `@SkipAuditoria()` aplicado a los 3 endpoints dev de cron de aprobaciones (documental: el interceptor es opt-in, pero queda vinculante si se pasa a opt-out).
  - Verificado end-to-end: flujo completo de reset → fila en `auditoria` con accion/entidad/ip y antes/despues null (omitirBody); password del usuario de prueba restaurado tras el test.

### T-151 — Implementar sanitización HTML en descripciones de solicitudes

- **Descripción:** Sanitizar el HTML de las descripciones de solicitudes y comentarios para evitar XSS. Usar `sanitize-html` o `dompurify`. Permitir un subconjunto seguro de tags. Materializa SEC-6.
- **Criterios de aceptación:**
  - [ ] `backend/src/common/sanitizers/html-sanitizer.ts` con `sanitizeHtml(input)` que usa `sanitize-html`.
  - [ ] Whitelist: `p`, `br`, `strong`, `em`, `u`, `ul`, `ol`, `li`, `a` (con `href` validado), `blockquote`, `code`, `pre`.
  - [ ] Atributos: `a[href]` (solo `http://`, `https://`, `mailto:`, no `javascript:`).
  - [ ] Aplicado en `SolicitudService.create` y `SolicitudService.update` (campos `titulo`, `descripcion`, `comentarios.cuerpo`).
  - [ ] Test: `<script>alert(1)</script><p>Hola</p>` → `<p>Hola</p>`.
  - [ ] Test: `<a href="javascript:alert(1)">click</a>` → `<a>click</a>` (href eliminado).
- **Dependencias:** T-080, T-077.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — **`sanitize-html@2.17.4`** (+`@types/sanitize-html@2.16.1`), latest verificada en npm; elegida sobre dompurify (necesita DOM/jsdom — sanitize-html es nativa server-side). `common/sanitizers/html-sanitizer.ts` con `sanitizeHtml` (whitelist exacta del plan: p/br/strong/em/u/ul/ol/li/a[href http|https|mailto]/blockquote/code/pre) y `sanitizePlainText` (cero tags, para títulos).
  - Aplicado en `SolicitudesService.create` y `.update` (titulo → plano, descripcion → rico) y en `addComentario` (cuerpo → rico).
  - Verificado end-to-end con el backend: `<script>alert(1)</script><p>Hola</p>` → `<p>Hola</p>` ✓; `<a href="javascript:alert(1)">click</a>` → `<a>click</a>` (href eliminado, los https se conservan) ✓; titulo `<script>…</script>Titulo con <b>tags</b>` → `Titulo con tags` ✓; `<img src=x onerror=…>` en comentario → eliminado ✓.

### T-152 — Implementar excepciones RFC 7807 con códigos de dominio

- **Descripción:** Implementar el formato de error estándar RFC 7807 con códigos de dominio específicos. Materializa `docs/07` §4.5.
- **Criterios de aceptación:**
  - [ ] `backend/src/common/filters/all-exceptions.filter.ts` con `ExceptionFilter` global.
  - [ ] Formato del response:
    ```json
    {
      "type": "https://plazapp.com/errors/solicitud-locked",
      "title": "Solicitud bloqueada por otro administrador",
      "status": 409,
      "detail": "La solicitud SOL-DEMO-001 está siendo revisada por juan@plaza.com hasta las 18:30.",
      "instance": "/api/v1/solicitudes/abc-123/aprobar",
      "code": "SOLICITUD_LOCKED",
      "requestId": "req-uuid"
    }
    ```
  - [ ] Tabla centralizada de errores de dominio con `code`, `httpStatus`, `title`, `detailTemplate` en `backend/src/common/errors/domain-errors.ts`.
  - [ ] Códigos documentados en `docs/06` o en el README.
  - [ ] Errores 5xx logueados con stack completo en pino (Sentry cuando T-156 esté lista).
  - [ ] Errores 4xx no exponen stack ni detalles internos.
  - [ ] Aplicado a todos los módulos. Los servicios lanzan `new DomainException('SOLICITUD_LOCKED', { ...vars })` y el filter los traduce.
- **Dependencias:** T-013, T-022.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — El envelope RFC 7807 ya existía desde T-015 (`AllExceptionsFilter` + `HttpExceptionFilter`); esta tarea lo completó y centralizó:
  - `common/errors/domain-errors.ts`: catálogo de ~70 códigos relevados de los módulos 02-11 con `{ status, title, detailTemplate }` + clase **`DomainException(code, detail?, meta?)`** (extiende HttpException; el filter la traduce). Códigos documentados en `README.md` §7.2 (tabla por área).
  - ⚠️ Decisión de alcance (owner 2026-06-07): SIN refactor masivo — los throws actuales (`new XxxException({ code, title, message })`) ya producen el envelope correcto vía filters y quedan documentados como conformes; `DomainException` es la forma canónica para código nuevo.
  - Fix en `HttpExceptionFilter`: `instance` y `requestId` faltaban en sus dos caminos (el AllExceptionsFilter sí los tenía) — ahora TODOS los errores incluyen el envelope completo. Verificado: 404 de dominio responde `type/title/status/detail/instance/code/requestId` exactos al formato del plan.
  - 5xx con stack en pino ✓ (filter); 4xx sin stack ni internals ✓ (verificado).
