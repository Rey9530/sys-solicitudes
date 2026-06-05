# Módulo 12 — Seguridad y Auditoría

> **Propósito:** Helmet con CSP estricta, CORS restrictivo por env var, `@nestjs/throttler` con rate limit global y por endpoint, tabla `auditoria` append-only capturada por interceptor en cada POST/PATCH/DELETE, sanitización HTML en descripciones, errores RFC 7807 con códigos de dominio, validación Zod compartida.
>
> **Pre-requisito:** T-001 a T-145 (incluye Reportes) deben estar `Completada`. Algunas tareas de este módulo se solapan con las bases de `01-setup-base.md` y se consolidan aquí.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-146 | Crear migración Prisma con `auditoria` (append-only) | Alta | Pendiente |
| T-147 | Configurar Helmet con CSP estricta en NestJS | Alta | Pendiente |
| T-148 | Configurar CORS restrictivo por env var | Alta | Pendiente |
| T-149 | Configurar @nestjs/throttler: 100 req/min global, 5 req/min login, otros límites | Alta | Pendiente |
| T-150 | Implementar captura automática de auditoría en POST/PATCH/DELETE (Interceptor) | Alta | Pendiente |
| T-151 | Implementar sanitización HTML en descripciones de solicitudes | Alta | Pendiente |
| T-152 | Implementar excepciones RFC 7807 con códigos de dominio | Alta | Pendiente |

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*
