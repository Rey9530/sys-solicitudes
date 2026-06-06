# Módulo 03 — Plazas y Multi-tenant

> **Propósito:** Resolución de tenant (subdominio en producción, path en dev), RLS en PostgreSQL como segunda capa de defensa, CRUD de plazas (solo `superadmin`), branding por plaza (logo, color primario, nombre comercial, zona horaria), entidad `configuracion` 1:1 con plaza (SLA, MIME, tamaño máx), y pantallas del admin-plataform.
>
> **Pre-requisito:** T-001 a T-016 (`01-setup-base.md`) y T-017 a T-035 (`02-autenticacion-usuarios.md`) deben estar `Completada`.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-036 | Crear migración Prisma con `plaza` | Alta | Completada |
| T-037 | Crear migración Prisma con `configuracion` (1:1 con plaza) | Alta | Completada |
| T-038 | Implementar RLS en PostgreSQL con `SET LOCAL app.plaza_id` | Alta | Completada |
| T-039 | Configurar resolución de tenant en middleware Next.js (subdominio/path) | Alta | Completada |
| T-040 | CRUD plazas (POST/GET/PATCH /api/v1/plazas) — solo superadmin | Alta | Completada |
| T-041 | Implementar carga de logo y color_primario por plaza | Media | Completada |
| T-042 | Configurar branding dinámico en frontend (CSS variable con color_primario) | Media | Pendiente |
| T-043 | Configurar TZ de la plaza con date-fns-tz | Media | Pendiente |
| T-044 | CRUD configuracion plaza (SLA, MIME, tamaño máx) | Alta | Completada |
| T-045 | Seed inicial: crear superadmin y plaza demo | Alta | Completada |
| T-046 | Implementar pantallas /superadmin/plazas | Media | Pendiente |

---

### T-036 — Crear migración Prisma con `plaza`

- **Descripción:** Crear el modelo `plaza` raíz multi-tenant: `id` (UUID), `slug` (TEXT UNIQUE inmutable), `nombre_comercial`, `email_contacto`, `telefono_contacto`, `logo_url` (objeto en MinIO), `color_primario` (HEX), `timezone` (IANA, default `America/Costa_Rica`), `created_at`, `updated_at`, `deleted_at` (soft delete). Materializa S-MT-B y S-Branding.
- **Criterios de aceptación:**
  - [ ] Modelo `plaza` con todos los campos.
  - [ ] Índice `UNIQUE(slug)`, `INDEX(deleted_at)`.
  - [ ] Migración aplicada.
  - [ ] Validación Zod del slug: `^[a-z0-9-]+$`, longitud 3-32.
  - [ ] Validación Zod de `color_primario`: HEX `#RRGGBB`.
  - [ ] Validación Zod de `timezone`: debe ser IANA válida (validar con `Intl.supportedValuesOf('timeZone')`).
  - [ ] Test: dos plazas con el mismo slug → error `UNIQUE constraint violation`.
- **Dependencias:** T-010 (en `01-setup-base.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: El modelo `plaza` ya existía y fue migrado en el baseline `auth_usuarios` (módulo 02): `id`, `slug` UNIQUE, `nombre_comercial`, `email_contacto?`, `telefono_contacto?`, `logo_url?`, `color_primario` default `#2563eb`, `timezone`, soft delete, `@@index([deleted_at])`. Validaciones Zod (slug `^[a-z0-9-]+$`, HEX color) ya están en `packages/contracts/src/plazas`.
  - ⚠️ **T-V08:** `timezone` es **fija** `America/El_Salvador` (no `America/Costa_Rica` del enunciado) y **no editable**; `TimezoneSchema` es un literal, sin dropdown IANA.

### T-037 — Crear migración Prisma con `configuracion` (1:1 con plaza)

- **Descripción:** Crear el modelo `configuracion` con `plaza_id` (UNIQUE FK), `tamanio_max_archivo_mb` (JSONB), `mime_types_permitidos` (JSONB), `sla_dias_por_tipo` (JSONB), `sla_multiplicador_por_prioridad` (JSONB), `calendar_mostrar_hitos_contrato` (bool), `updated_at`. Materializa S-MD-G y S-SLA-Prioridad.
- **Criterios de aceptación:**
  - [ ] Modelo `configuracion` con todos los campos.
  - [ ] `plaza_id` UNIQUE (relación 1:1).
  - [ ] Migración aplicada.
  - [ ] Defaults al crear una plaza nueva: `tamanio_max_archivo_mb: 25`, `mime_types_permitidos: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/dwg']`, `sla_dias_por_tipo: { mantenimiento: 5, evento: 3, remodelacion: 15, otro: 7 }`, `sla_multiplicador_por_prioridad: { A: 0.5, B: 1.0, C: 1.5, D: 2.0, F: 3.0 }`, `calendar_mostrar_hitos_contrato: true`.
  - [ ] Función helper que crea la `configuracion` automáticamente al crear una `plaza` (hook Prisma `@default` o servicio de aplicación).
- **Dependencias:** T-036.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: El modelo `configuracion` ya existía y fue migrado en el baseline. `plaza_id` UNIQUE (1:1), defaults: `tamanio_max_archivo_mb=50` (⚠️ **T-V06**, no 25), `mime_types_permitidos`, `sla_dias_por_tipo`, `sla_multiplicador_por_prioridad`, `calendar_mostrar_hitos_contrato=true`, `aprobacion_especial_asistentes_min=200` (T-V05). `onDelete: Cascade` desde plaza.
  - El helper que crea la `configuracion` automáticamente al crear una plaza se implementa en **T-040** (transacción del CRUD), no como trigger Prisma.

### T-038 — Implementar RLS en PostgreSQL con `SET LOCAL app.plaza_id`

- **Descripción:** Habilitar Row Level Security en todas las tablas de negocio (las que tienen `plaza_id`) y crear una política que filtre por `plaza_id = current_setting('app.plaza_id')::uuid`. Configurar la conexión Prisma con un rol sin `BYPASSRLS` y ejecutar `SET LOCAL app.plaza_id` al inicio de cada transacción. Materializa S-MD-D, S-MD-I y la segunda capa de defensa de `docs/07` §4.2.
- **Criterios de aceptación:**
  - [ ] Migración SQL `00X_enable_rls/migration.sql` que habilita RLS y crea la política para cada tabla de negocio (`usuario`, `local`, `inquilino`, `contrato`, `categoria`, `subcategoria`, `solicitud`, `solicitud_historial`, `comentario`, `adjunto`, `evento_calendario`, `email_log`, `auditoria`, `configuracion`).
  - [ ] Política: `USING (plaza_id = current_setting('app.plaza_id', true)::uuid)`.
  - [ ] Rol `syssol_app` sin `BYPASSRLS`. `DATABASE_URL` usa este rol.
  - [ ] `PrismaService.$transaction()` que ejecuta `SET LOCAL app.plaza_id = '<uuid>'` al inicio.
  - [ ] `PrismaInterceptor` (NestJS) que lee `request.user.plaza_id` y lo setea en la transacción (excepto para `superadmin`, que usa un cliente "admin" con bypass, solo para `admin/plazas`).
  - [ ] Test manual: con un token de admin_plaza A, intentar `SELECT * FROM local WHERE plaza_id = '<B>'` retorna 0 filas. Sin el SET, retornaría filas (por lo que el SET es obligatorio en la app).
  - [ ] Test: `superadmin` puede listar todas las plazas vía el cliente admin.
  - [ ] `prisma db push` o `prisma migrate dev` aplica la migración correctamente.
- **Dependencias:** T-018, T-036, T-037, y modelos de las tablas que se protegen.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: Migración `enable_rls` aplicada. Crea el rol **`syssol_app`** (LOGIN, NOSUPERUSER, **NOBYPASSRLS**) con sus grants (+ `ALTER DEFAULT PRIVILEGES` para tablas futuras). Activa `ENABLE`+`FORCE ROW LEVEL SECURITY` y políticas `USING/WITH CHECK` en `plaza` (por `id`), `configuracion`, `usuario`, `rol_staff`, `auditoria_login` (por `plaza_id`).
  - **Dos clientes Prisma:** `PrismaService` (rol `syssol_app`, `DATABASE_URL`, RLS activa) con helper `withTenant(plazaId, fn)` que hace `SELECT set_config('app.plaza_id', $1, true)` (SET LOCAL parametrizado) dentro de una transacción; y `PrismaAdminService` (superusuario `syssol`, `DATABASE_ADMIN_URL`, bypassa RLS) para superadmin y auth pre-sesión.
  - ⚠️ **Refactor módulo 02:** `AuthService` ahora usa `PrismaAdminService` (login busca usuario por email sin contexto de plaza; con RLS activa devolvería 0 filas). `TokenService` sigue en `PrismaService` (la tabla `refresh_token` no tiene `plaza_id`/RLS). El seed usa la conexión admin.
  - ⚠️ **Env:** `DATABASE_URL`→`syssol_app`; nuevo `DATABASE_ADMIN_URL`→`syssol`. `prisma.config.ts` migra con la URL admin (las migraciones crean roles/políticas). `.env.example` y `.env` locales actualizados (puerto 5433).
  - **Verificado:** psql como `syssol_app` sin contexto → 0 filas (fail-closed); `syssol` ve todo; login/`/me`/readiness siguen `200`. Las tablas de módulos futuros añadirán su RLS en sus propias migraciones.

### T-039 — Configurar resolución de tenant en middleware Next.js (subdominio/path)

- **Descripción:** Implementar la lógica de extracción del slug de plaza desde el subdominio (producción) o path (dev/staging). Setea el header `x-plaza-slug` que viaja a NestJS. Materializa S-MT-A y S-ARQ-C.
- **Criterios de aceptación:**
  - [ ] `frontend/middleware.ts` con la lógica:
    - Si el host empieza con `{slug}.plazapp.com` (prod) → slug = primera parte.
    - Si el path empieza con `/p/{slug}/...` (dev/staging) → slug = segunda parte.
    - Si no hay slug → redirige a landing pública (TODO: definir landing en T-046).
  - [ ] El slug se pasa como header `x-plaza-slug` en cada Server Action / Server Component.
  - [ ] El slug se valida contra la BD (existe y no está `deleted`) antes de proceder.
  - [ ] Si la URL no es de admin-plataform (`/superadmin/...`) y no tiene slug → 404.
  - [ ] Si la URL es de admin-plataform → no requiere slug, va a `/superadmin/plazas`.
  - [ ] Las rutas de admin-plataform NO propagan slug al backend (NestJS no recibe `x-plaza-slug`).
- **Dependencias:** T-033 (en `02-autenticacion-usuarios.md`, auth middleware).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: ⚠️ **SUPERADO por T-V01.** No hay resolución de tenant por subdominio/path ni header `x-plaza-slug`: el `plaza_id` viaja en el JWT. El `frontend/src/middleware.ts` (módulo 02, T-033) ya protege rutas privadas por sesión y redirige a `/login`; las rutas `/superadmin/*` exigen sesión y el rol `superadmin` se valida en el layout/Server Actions (T-046). No se requiere código adicional de resolución de tenant. El criterio original de subdominio/slug queda anulado.

### T-040 — CRUD plazas (POST/GET/PATCH /api/v1/plazas) — solo superadmin

- **Descripción:** Implementar el CRUD de plazas accesible solo para `superadmin`. POST crea la plaza + su `configuracion` por defecto + opcionalmente el primer `admin_plaza`. PATCH solo puede editar nombre, contacto, color, logo y TZ (no slug). Soft delete con `deleted_at`. Materializa la matriz de permisos (S-RP-B, SC-5).
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/plazas` con `@Roles('superadmin')`. Body: `{ slug, nombreComercial, emailContacto, telefonoContacto, timezone, adminPlazaInicial?: { email, nombre, password, rolStaffId } }`.
  - [ ] Crea la plaza + la configuracion (T-037) en transacción. Si se pasa `adminPlazaInicial`, crea el usuario, asigna `rol_staff_id`, y envía email de bienvenida.
  - [ ] Slug validado (regex + uniqueness) → `400 INVALID_SLUG` o `409 PLAZA_SLUG_TAKEN`.
  - [ ] `GET /api/v1/plazas` con paginación `?page=1&pageSize=20&sort=createdAt:desc`. Lista solo para `superadmin`.
  - [ ] `GET /api/v1/plazas/:id` para `superadmin`. Para `admin_plaza`, retorna su propia plaza.
  - [ ] `PATCH /api/v1/plazas/:id` con `@Roles('superadmin')` para `slug` (rechaza), `@Roles('admin_plaza', 'superadmin')` para el resto.
  - [ ] `DELETE /api/v1/plazas/:id` con `@Roles('superadmin')` hace soft delete (`deleted_at = now()`).
  - [ ] Todas las mutaciones registradas en `auditoria` (T-150 en `12-seguridad-auditoria.md`).
  - [ ] Errores con códigos de dominio RFC 7807.
- **Dependencias:** T-036, T-037, T-038, T-022 (en `02-autenticacion-usuarios.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `PlazasModule` implementado. `POST /plazas` (superadmin) crea en una transacción del admin client: `plaza` + `configuracion` (defaults, **cierra T-037**) + 3 `rol_staff` por defecto (`tecnico/ingeniero/supervisor`) + opcional `admin_plaza` inicial (bcrypt, `rol_staff` por `rolStaffCodigo`) + email de bienvenida (`MailerService.sendBienvenida`). `GET /plazas` paginado (superadmin), `GET /plazas/:id` (superadmin: admin client; admin_plaza: su plaza vía `withTenant`), `PATCH /plazas/:id` (no slug/timezone), `DELETE` soft delete (superadmin). Cada mutación → `AuditoriaService.record`.
  - Verificado: crear plaza `201`, listar, slug duplicado `409`, bienvenida en MailHog; **RLS cross-tenant**: admin de Acme → su plaza `200`, plaza ajena `403 PLAZA_SCOPE_VIOLATION`, listar todas `403 ROLE_FORBIDDEN`.
  - ⚠️ **Hardening (multi-tenant-auditor):** `update` lee `before` y escribe con el mismo cliente acotado (admin_plaza vía `withTenant`, RLS como backstop); `PrismaAdminService` exige `DATABASE_ADMIN_URL` (sin fallback); `TokenService` pasó al admin client y se añadió RLS `USING(false)` a `refresh_token`/`password_reset_token` (solo admin client las toca).
  - ⚠️ **Auditoría mínima:** modelo `auditoria` + `AuditoriaService.record` (insert append-only vía admin client). El trigger no-update/delete, el interceptor automático y la retención son **T-146/T-150** (módulo 12).
  - ⚠️ Crear plaza siembra roles de staff por defecto para que el admin inicial tenga `rol_staff` (S-ResponsabilidadStaff); si `rolStaffCodigo` no existe → `400 ROL_STAFF_NO_EXISTE`.

### T-041 — Implementar carga de logo y color_primario por plaza

- **Descripción:** Permitir que el `admin_plaza` suba el logo (PNG/SVG, máx 2 MB) y cambie el `color_primario`. El logo se guarda en MinIO bucket `plaza-assets-{plaza_id}` y se retorna una URL pre-firmada. Materializa S-Branding.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/plazas/:id/logo` con multipart/form-data, `@Roles('admin_plaza', 'superadmin')`.
  - [ ] Valida MIME (image/png, image/svg+xml) y tamaño (2 MB).
  - [ ] Sube a MinIO bucket `plaza-assets-{plaza_id}` con key `logo/{uuid}.{ext}`.
  - [ ] Actualiza `plaza.logo_url` con la key de MinIO.
  - [ ] Retorna el logo URL pre-firmada (15 min expiración) para preview inmediata.
  - [ ] `PATCH /api/v1/plazas/:id/color` con body `{ colorPrimario: '#RRGGBB' }`. Valida regex HEX.
  - [ ] Logo y color visibles en el header de la app y en los emails.
  - [ ] Si el logo se reemplaza, el anterior se mueve a `quarantine-{plaza_id}`.
- **Dependencias:** T-040, T-110 (en `08-adjuntos.md`, MinIO client).
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `MinioService` mínimo (`common/storage`, instalado `minio@8.0.7`): `ensureBucket`, `putObject`, `presignedGetUrl` (15 min), `moveToQuarantine`. `POST /plazas/:id/logo` (multipart, `FileInterceptor`, `@Roles('superadmin','admin_plaza')`) valida PNG/SVG y ≤2 MB (`400 ADJUNTO_MIME_INVALIDO` / `413 ADJUNTO_DEMASIADO_GRANDE`), sube a `plaza-assets-{plazaId}` key `logo/{uuid}.{ext}`, mueve el anterior a `quarantine-{plazaId}`, actualiza `plaza.logo_url` (la key). Las respuestas de plaza resuelven `logoUrl` a URL pre-firmada; la auditoría guarda la key cruda (snapshot, no expira). Verificado: PNG `200` con presigned URL, PDF `400`.
  - El cambio de `color_primario` se hace por el `PATCH /plazas/:id` existente (no se añadió endpoint aparte). El color/logo se reflejan en el frontend en T-042.
  - ⚠️ Cliente MinIO **mínimo** (decisión de sesión): el cliente completo (cuarentena con retención, escaneo, adjuntos de solicitudes) es **T-110** (módulo 08).

- **Descripción:** Inyectar el `color_primario` y el logo de la plaza como variables CSS al renderizar el layout raíz. El logo se sirve desde MinIO vía URL pre-firmada. Materializa S-Branding.
- **Criterios de aceptación:**
  - [ ] `frontend/app/(plaza)/p/[slug]/layout.tsx` (Server Component) carga los datos de la plaza (cache 5 min con Redis opcional o `unstable_cache`).
  - [ ] Inyecta `--color-primary: <plaza.colorPrimario>` en `:root` del CSS.
  - [ ] Muestra el logo en el header.
  - [ ] Si no hay logo, usa un placeholder genérico.
  - [ ] El favicon también puede ser el logo (opcional).
  - [ ] shadcn/ui respeta la variable CSS en botones, focus, etc.
- **Dependencias:** T-039, T-041.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-043 — Configurar TZ de la plaza con date-fns-tz

- **Descripción:** Configurar `date-fns-tz` para que todas las fechas se muestren en la TZ de la plaza (default `America/Costa_Rica`). El backend siempre almacena en UTC (`TIMESTAMPTZ`), pero la conversión a display se hace en FE con la TZ de la plaza. Materializa S-Timezone.
- **Criterios de aceptación:**
  - [ ] `frontend/lib/datetime.ts` con helpers `formatInPlazaTz(date, plaza.timezone)`, `formatTimeInPlazaTz(...)`.
  - [ ] El calendario (T-133) muestra eventos en la TZ de la plaza.
  - [ ] Los emails (T-118 en `09-notificaciones-email.md`) muestran fechas en la TZ de la plaza.
  - [ ] Helper `parseISOToUTC(iso)` para inputs de formularios.
  - [ ] Test: una solicitud creada a las 23:00 UTC del 3 de junio, cuando la plaza está en `America/Costa_Rica` (UTC-6), se muestra como "3 de junio, 17:00".
- **Dependencias:** T-036.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-044 — CRUD configuracion plaza (SLA, MIME, tamaño máx)

- **Descripción:** Implementar el CRUD de `configuracion` por plaza. El `admin_plaza` puede editar los SLA, MIME permitidos, tamaño máx y configuración del calendario. `GET /api/v1/configuracion` retorna la config actual (usado por los formularios de solicitudes, adjuntos, calendario). Materializa S-SLA-Prioridad y la config en `docs/04` §1.1.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/configuracion` retorna `{ tamanioMaxArchivoMb, mimeTypesPermitidos, slaDiasPorTipo, slaMultiplicadorPorPrioridad, calendarMostrarHitosContrato }`.
  - [ ] `PATCH /api/v1/configuracion` con `@Roles('admin_plaza')`. Body parcial.
  - [ ] Validación de los SLA: deben ser números positivos.
  - [ ] Validación de los MIME: cada uno debe estar en una lista cerrada de MIME permitidos.
  - [ ] Cambios registrados en `auditoria` con `antes`/`después` en JSONB.
  - [ ] El `GET` se cachea 5 min en Redis (opcional) o `unstable_cache` de Next.js para no pegar a la BD.
- **Dependencias:** T-037, T-038.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `ConfiguracionModule` con `GET /configuracion` y `PATCH /configuracion` (`@Roles('admin_plaza')`, vía `withTenant` de la plaza del JWT). El PATCH valida MIME contra lista cerrada (`400 MIME_NO_PERMITIDO`) y SLA≥0 (Zod); registra antes/después en `auditoria`. Verificado: GET `200`, PATCH SLA `200`, MIME inválido `400`.
  - El cacheo de `GET` con `unstable_cache` (T-V11, sin Redis) se aplica en el frontend que lo consume (T-042/T-044 FE); el backend expone el endpoint directo.

### T-045 — Seed inicial: crear superadmin y plaza demo

- **Descripción:** Crear un seed completo que, en una BD vacía, cree: 3 roles globales (T-017), 1 superadmin, 1 plaza demo (`slug: demo`, `nombre: Plaza Demo`), su `configuracion` por defecto, 3 roles de staff (tecnico, ingeniero, supervisor), y 1 `admin_plaza` con `rol_staff = supervisor`. Idempotente. Materializa el flujo de onboarding inicial.
- **Criterios de aceptación:**
  - [ ] `backend/prisma/seed.ts` ejecuta todos los seeds.
  - [ ] Credenciales del superadmin: `superadmin@plazapp.com` / `Plazapp2026!` (solo dev, documentado).
  - [ ] Credenciales del admin demo: `admin@demo.com` / `Plazapp2026!`.
  - [ ] `npx prisma migrate reset` + seed deja la BD lista para usar.
  - [ ] El seed NO falla si ya existe (idempotencia con `upsert`).
  - [ ] Documentado en `README.md` cómo correr el seed.
- **Dependencias:** T-017, T-018, T-019, T-036, T-037, T-040 (parcialmente).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `backend/prisma/seed.ts` extendido (idempotente, vía admin client/bypass RLS): 3 roles globales + superadmin + **plaza demo** (`slug: demo`) + su `configuracion` + 3 `rol_staff` + **admin demo** `admin@demo.com` / `Plazapp2026!` (admin_plaza, `rol_staff=supervisor`). Verificado: seed corre, login `admin@demo.com` `200`, 2ª corrida idempotente. Documentado en `CONTRIBUTING.md`.

### T-046 — Implementar pantallas /superadmin/plazas

- **Descripción:** Implementar el módulo de admin-plataform (superadmin) con listado de plazas, alta, edición, soft delete, y vista de detalle. Materializa SC-5.
- **Criterios de aceptación:**
  - [ ] `frontend/app/(admin-plataform)/superadmin/plazas/page.tsx` con tabla paginada (shadcn DataTable).
  - [ ] Botón "Nueva plaza" abre modal con el formulario.
  - [ ] Formulario con React Hook Form + Zod (slug auto-slugged desde nombre, regex validado, color picker, timezone select con todas las IANA).
  - [ ] Opción "Crear admin_plaza inicial" con email, nombre, password, rol_staff (select con los disponibles).
  - [ ] Pantalla de detalle `/superadmin/plazas/[id]` con tabs: Datos, Configuración, Usuarios, Métricas (placeholder).
  - [ ] Botón "Desactivar" pide confirmación y hace soft delete.
  - [ ] Solo accesible para `superadmin` (verificado en middleware + server action).
- **Dependencias:** T-040, T-041, T-042, T-044.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*
