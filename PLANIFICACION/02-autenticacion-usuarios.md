# Módulo 02 — Autenticación y Usuarios

> **Propósito:** Triple guard (`JwtAuthGuard`, `PlazaScopeGuard`, `RolesGuard`), Auth.js (NextAuth v5) en frontend con JWT compartido HS256, endpoints de auth (login, refresh, logout, reset, change-password, me), CRUD de usuarios, CRUD de roles de staff, bitácora de login, lockout 5/15 min, y pantallas de login/reset/perfil.
>
> **Pre-requisito:** T-001 a T-016 (`01-setup-base.md`) deben estar `Completada`.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-017 | Crear migración Prisma con `rol` (catálogo global) | Alta | Completada |
| T-018 | Crear migración Prisma con `usuario` | Alta | Completada |
| T-019 | Crear migración Prisma con `rol_staff` | Alta | Completada |
| T-020 | Crear migración Prisma con `refresh_token` y `password_reset_token` | Alta | Completada |
| T-021 | Crear migración Prisma con `auditoria_login` | Alta | Completada |
| T-022 | Definir Zod schemas compartidos de auth y usuarios en @app/contracts | Alta | Completada |
| T-023 | Configurar JwtAuthGuard en NestJS | Alta | Completada |
| T-024 | Configurar PlazaScopeGuard | Alta | Completada |
| T-025 | Configurar RolesGuard + @Roles decorator | Alta | Completada |
| T-026 | Implementar POST /api/v1/auth/login (con lockout 5/15) | Alta | Completada |
| T-027 | Implementar POST /api/v1/auth/refresh | Alta | Completada |
| T-028 | Implementar POST /api/v1/auth/logout | Alta | Completada |
| T-029 | Implementar flujo de reset de contraseña (POST /reset-password, /reset-password/confirm) | Alta | Completada |
| T-030 | Implementar PATCH /api/v1/auth/change-password | Media | Completada |
| T-031 | Implementar GET /api/v1/auth/me | Alta | Completada |
| T-032 | Configurar Auth.js (NextAuth v5) en frontend con Credentials Provider | Alta | Pendiente |
| T-033 | Configurar middleware Next.js para inyectar token JWT en requests a NestJS | Alta | Pendiente |
| T-034 | Implementar pantalla /login | Alta | Pendiente |
| T-035 | Implementar pantallas /reset-password y /reset-password/[token] | Media | Pendiente |

---

### T-017 — Crear migración Prisma con `rol` (catálogo global)

- **Descripción:** Crear el modelo `rol` en `backend/prisma/schema.prisma` con seed de los 3 roles globales (`superadmin`, `admin_plaza`, `inquilino`). Catálogo global no editable. Migración generada con `prisma migrate dev`. Materializa D1, R2, y la decisión de catálogos sin `plaza_id` (docs/04 §1.1).
- **Criterios de aceptación:**
  - [ ] Modelo `rol` en schema.prisma con campos: `id` (UUID PK), `codigo` (TEXT UNIQUE NOT NULL), `nombre` (TEXT NOT NULL), `descripcion` (TEXT), `created_at` (TIMESTAMPTZ default now()).
  - [ ] Sin `plaza_id` (catálogo global).
  - [ ] Migración `0002_init_roles/migration.sql` generada.
  - [ ] Seed en `backend/prisma/seed.ts` inserta los 3 roles con códigos fijos.
  - [ ] `package.json` tiene script `prisma:seed` configurado con `ts-node prisma/seed.ts` y `prisma.seed` apunta al script.
  - [ ] `npx prisma migrate dev` aplica la migración + seed.
  - [ ] `npx prisma studio` muestra 3 filas en `rol`.
- **Dependencias:** T-010 (en `01-setup-base.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: El modelo `rol` ya existía en el schema base (módulo 01). Se completó el **seed** de los 3 roles globales en `backend/prisma/seed.ts` (`upsert` por `codigo`, idempotente). Verificado: `rol` tiene 3 filas.
  - ⚠️ La relación inversa de `rol` cambió de `usuarios usuario_rol[]` a `usuarios usuario[]` (ver T-018).
  - ⚠️ El script de seed se llama vía `prisma.config.ts` (`migrations.seed`), no vía el campo `prisma.seed` de `package.json` (Prisma 7). Se agregó además el script de conveniencia `prisma:seed`.
  - ⚠️ La migración no se llama `0002_init_roles`: todo el módulo se materializó en una sola migración `20260606053858_auth_usuarios` (las tablas comparten FKs; dividirlas era artificial) + `20260606054011_superadmin_email_index`.

### T-018 — Crear migración Prisma con `usuario`

- **Descripción:** Crear el modelo `usuario` con `plaza_id` (nullable para `superadmin`), `rol_id` (FK a `rol`), `rol_staff_id` (FK a `rol_staff`, NULL salvo si `admin_plaza`), `inquilino_id` (FK a `inquilino`, NULL salvo si `inquilino`), `email` único por plaza, `password_hash` (bcrypt cost 12), `nombre`, `telefono`, `email_invalido` (bool, marcado tras hard bounce), `last_login_at`, `created_at`, `updated_at`, `deleted_at`. Materializa `docs/04` §1.1 y RN-AU-1 a RN-AU-10.
- **Criterios de aceptación:**
  - [ ] Modelo `usuario` con todos los campos, FKs e índices: `UNIQUE(plaza_id, email)`, `INDEX(rol_id)`, `INDEX(deleted_at)`.
  - [ ] Migración generada y aplicada.
  - [ ] Validación en aplicación (no en BD): `password_hash` siempre empieza con `$2b$` o `$2a$` (RI-5).
  - [ ] Validación en aplicación: `rol=admin_plaza` requiere `rol_staff_id` NOT NULL (S-ResponsabilidadStaff).
  - [ ] Seed de superadmin inicial creado en `prisma/seed.ts` con email `superadmin@plazapp.com` y password `Plazapp2026!` (documentado como solo dev).
  - [ ] El seed es idempotente: no falla si ya existe.
- **Dependencias:** T-017, T-019 (rol_staff y usuario se crean juntos), T-062 en `04-locales-inquilinos-contratos.md` (FK a inquilino, pero puede ser nullable).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: Modelo `usuario` creado con todos los campos, índices (`@@unique([plaza_id, email])`, `@@index([rol_id])`, `@@index([deleted_at])`) y FKs (plaza, rol, rol_staff). Migración aplicada. Seed de superadmin (`superadmin@plazapp.com` / `Plazapp2026!`, solo dev) idempotente y verificado (hash con prefijo `$2b$`, RI-5).
  - ⚠️ **Decisión de sesión (2026-06-06):** se modela `rol_id` como **FK directa** en `usuario` y se **eliminó la tabla pivote `usuario_rol`** que había creado el módulo 01. Coincide con docs/04 §1.1 y simplifica las queries.
  - ⚠️ **Hashing bcrypt (no argon2):** el módulo 01 había instalado `argon2`; se reemplazó por `bcrypt@6` cost 12 para respetar RI-5/RN-AU-2 (hash `$2b$`). Decisión confirmada por el owner en sesión.
  - `inquilino_id` se modela como columna `String? @db.Uuid` **sin** `@relation` (la tabla `inquilino` llega en módulo 04 / T-062; ahí se añadirá la FK).
  - Refuerzo de unicidad para superadmin (`plaza_id IS NULL`): índice parcial único `usuario_email_superadmin_uniq` añadido en migración `superadmin_email_index` (un `UNIQUE(plaza_id,email)` no aplica con `plaza_id` NULL).
  - Validaciones `rol_staff_id` obligatorio para `admin_plaza` y prefijo bcrypt se aplican en la capa de aplicación (servicios de usuarios/auth), no en BD.

### T-019 — Crear migración Prisma con `rol_staff`

- **Descripción:** Crear el modelo `rol_staff` configurable por plaza: `plaza_id` (FK), `codigo` (slug único por plaza), `nombre`, `descripcion`, `activo`, `created_at`, `updated_at`. Materializa S-RolStaff y S-MD-K.
- **Criterios de aceptación:**
  - [ ] Modelo `rol_staff` con todos los campos.
  - [ ] Índice `UNIQUE(plaza_id, codigo)`, `INDEX(plaza_id, activo)`.
  - [ ] Migración generada y aplicada.
  - [ ] Seed inicial crea 3 roles de staff por plaza demo: `tecnico`, `ingeniero`, `supervisor` (solo si la plaza existe).
- **Dependencias:** T-036 (en `03-plazas-multitenant.md`, plaza debe existir). En práctica se implementa después; T-018 puede referenciar este modelo aunque aún no haya filas.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: Modelo `rol_staff` creado con `@@unique([plaza_id, codigo])` e `@@index([plaza_id, activo])`, FK a plaza y relación inversa a `usuario`. Migración aplicada.
  - El seed de roles de staff demo (`tecnico`/`ingeniero`/`supervisor`) es **defensivo**: solo inserta si ya existe una plaza (las plazas se crean en el módulo 03). Hoy no hay plazas → el seed lo omite con un log informativo. Quedará efectivo al sembrar la plaza demo en el módulo 03.

### T-020 — Crear migración Prisma con `refresh_token` y `password_reset_token`

- **Descripción:** Crear los modelos `refresh_token` (hasheado SHA-256, `expires_at`, `revoked_at`, `user_agent`, `ip`) y `password_reset_token` (hasheado, `expires_at`, `used_at`). Materializa D3 (JWT HS256 + refresh rotado).
- **Criterios de aceptación:**
  - [ ] Modelo `refresh_token` con campos: `id` (UUID PK), `usuario_id` (FK), `token_hash` (TEXT, SHA-256 del token), `expires_at` (TIMESTAMPTZ, +7 días), `revoked_at` (nullable), `user_agent` (TEXT), `ip` (TEXT), `created_at`.
  - [ ] Modelo `password_reset_token` con campos: `id`, `usuario_id` (FK), `token_hash` (SHA-256), `expires_at` (+30 min), `used_at` (nullable), `created_at`.
  - [ ] Índices: `INDEX(usuario_id)` en ambos.
  - [ ] Migración generada y aplicada.
  - [ ] Ningún campo expone el token original (solo el hash).
- **Dependencias:** T-018.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: Modelos `refresh_token` y `password_reset_token` creados; ambos guardan solo `token_hash` (SHA-256), nunca el token plano. Índices `@@index([usuario_id])`. Migración aplicada.
  - Los TTL efectivos (refresh 14d, reset 30 min) se aplican en los servicios de auth leyendo `.env` (T-V13), no se fijan en el schema.

### T-021 — Crear migración Prisma con `auditoria_login`

- **Descripción:** Crear el modelo `auditoria_login` (separado de `auditoria` que es transversal) para registrar intentos de login: `id`, `plaza_id` (nullable si el email no existe), `email` (texto, aunque no exista), `exitoso` (bool), `ip`, `user_agent`, `motivo_fallo` (TEXT, ej. `password_invalido`, `usuario_no_existe`, `cuenta_bloqueada`), `created_at`. Materializa RN-AU-4 (5 intentos en 15 min).
- **Criterios de aceptación:**
  - [ ] Modelo con todos los campos.
  - [ ] Índice `INDEX(email, created_at)` para consultar historial.
  - [ ] Índice `INDEX(plaza_id, created_at)` para consultas por plaza.
  - [ ] Migración aplicada.
  - [ ] Endpoint `GET /api/v1/usuarios/auditoria-login` (admin_plaza ve su plaza, superadmin ve todas) — implementado en T-035.
- **Dependencias:** T-018.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: Modelo `auditoria_login` creado con `@@index([email, created_at])` y `@@index([plaza_id, created_at])`. Migración aplicada.
  - ⚠️ El campo se llama `motivo_fallo` (no `razon_fallo` como aparece en docs/04 §1.x); se conservó el nombre del plan T-021/T-026. Valores: `usuario_no_existe`, `password_invalido`, `cuenta_bloqueada`.
  - El endpoint `GET /api/v1/usuarios/auditoria-login` (mencionado en el criterio) pertenece al CRUD de usuarios (módulo 02, parte de usuarios) — no incluido en el alcance T-017..T-035 de esta entrega; queda para la implementación del controlador de usuarios.

### T-022 — Definir Zod schemas compartidos de auth y usuarios en @app/contracts

- **Descripción:** Crear los schemas Zod compartidos en `packages/contracts/src/`: `auth.ts` (LoginInput, RefreshInput, ResetPasswordRequest, ResetPasswordConfirm, ChangePasswordInput), `usuarios.ts` (CreateUsuarioInput, UpdateUsuarioInput, ListUsuariosQuery, UsuarioOutput), `roles-staff.ts` (CreateRolStaffInput, etc.). Materializa D7 (S-Validación) y la decisión de compartir FE/BE.
- **Criterios de aceptación:**
  - [ ] `packages/contracts/src/auth.ts` exporta `LoginSchema` (email, password), `RefreshSchema` (refreshToken), `ResetPasswordRequestSchema` (email), `ResetPasswordConfirmSchema` (token, newPassword), `ChangePasswordSchema` (currentPassword, newPassword), y los tipos inferidos.
  - [ ] `packages/contracts/src/usuarios.ts` exporta schemas para CRUD de usuarios.
  - [ ] `packages/contracts/src/roles-staff.ts` exporta schemas para CRUD de roles de staff.
  - [ ] Política de contraseña validada con regex: `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{10,}$` (RN-AU-1).
  - [ ] El paquete compila sin errores y los tipos se infieren correctamente.
  - [ ] Tanto el frontend como el backend importan los schemas (validación en tiempo de build).
- **Dependencias:** T-005 (en `01-setup-base.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: Los schemas ya estaban implementados en el módulo 01 (`auth/`, `usuarios/`, `roles-staff/`, `common/`). Verificado que el paquete `@app/contracts` compila sin errores (`npm run build`). No requirió cambios.
  - ⚠️ Política de contraseña: **8 chars + 3 tipos** (mayús/minús/dígito), regex `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$` — conforme a **T-V13**, no a la regex de 10 chars + símbolo del enunciado original de T-022 (que quedó desactualizado).

### T-023 — Configurar JwtAuthGuard en NestJS

- **Descripción:** Implementar `JwtAuthGuard` que valida el JWT del header `Authorization: Bearer <token>`. Verifica la firma HS256 con `JWT_SECRET` compartido, la expiración (`exp`), y emite los claims (`sub`, `plaza_id`, `rol`, `rol_staff_id`, `iat`, `exp`) en `request.user`. Materializa D3, SEC-4.
- **Criterios de aceptación:**
  - [ ] `backend/src/modules/auth/guards/jwt-auth.guard.ts` con la lógica de `@nestjs/passport` y `passport-jwt`.
  - [ ] `Strategy` configurada con `secretOrKey: process.env.JWT_SECRET`, `algorithms: ['HS256']`, `ignoreExpiration: false`.
  - [ ] Decorator `@CurrentUser()` que extrae `request.user`.
  - [ ] Token expirado → `401 Unauthorized` con código `TOKEN_EXPIRED`.
  - [ ] Token inválido → `401 Unauthorized` con código `TOKEN_INVALID`.
  - [ ] Token sin firma → `401 Unauthorized` con código `TOKEN_MISSING_SIGNATURE`.
  - [ ] Token NO se acepta en query string (validar que venga en header).
  - [ ] JwtAuthGuard global con `APP_GUARD` (excepto endpoints públicos como `/auth/login`, `/auth/reset-password`).
  - [ ] Cada request autenticado lleva `request.user` con los claims correctos.
- **Dependencias:** T-022.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `JwtStrategy` (passport-jwt, HS256, `ignoreExpiration:false`, token solo del header) + `JwtAuthGuard` (`modules/auth/guards/jwt-auth.guard.ts`), decorators `@CurrentUser()` y `@Public()` (en `common/decorators/`). Registrado como `APP_GUARD` global. Verificado: `GET /auth/me` sin token → `401 TOKEN_INVALID`; con token → `200`.
  - Diferenciación de errores: `TOKEN_EXPIRED` (token vencido), `TOKEN_MISSING_SIGNATURE` (firma ausente) y `TOKEN_INVALID` (resto), vía `handleRequest`.
  - El `HealthController` se marcó `@Public()` para no romper los health checks con el guard global. La ruta express directa `/api/ping` no pasa por guards.

### T-024 — Configurar PlazaScopeGuard

- **Descripción:** Implementar `PlazaScopeGuard` que verifica que el `plaza_id` del token coincida con el `plaza_id` del recurso solicitado (extraído de la URL o de la query). `superadmin` pasa sin scope (puede operar entre plazas). Aplica el header `x-plaza-slug` que llega del middleware de Next.js. Materializa SC-1 y S-MT-A.
- **Criterios de aceptación:**
  - [ ] `backend/src/modules/auth/guards/plaza-scope.guard.ts` con la lógica.
  - [ ] Si el `rol === 'superadmin'`, pasa sin restricción.
  - [ ] Si el `rol !== 'superadmin'`, verifica que el `plaza_id` del recurso (extraído de la URL `:plazaId` o del body) coincida con `user.plaza_id`.
  - [ ] Mismatch → `403 Forbidden` con código `PLAZA_SCOPE_VIOLATION`.
  - [ ] `superadmin` puede listar todas las plazas pero no puede crear solicitudes (SC-5).
  - [ ] Test manual: token de admin_plaza A no puede leer GET `/locales?plazaId=B` → 403.
  - [ ] Test manual: token de superadmin sí puede.
- **Dependencias:** T-023, T-038 (en `03-plazas-multitenant.md`, RLS).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `PlazaScopeGuard` (`modules/auth/guards/plaza-scope.guard.ts`) registrado como `APP_GUARD`. `superadmin` pasa sin scope; el resto compara un `plazaId` presente en ruta/query/body contra `user.plazaId` del JWT → mismatch `403 PLAZA_SCOPE_VIOLATION`.
  - ⚠️ **T-V01:** se eliminó toda referencia a `x-plaza-slug`/subdominio. La resolución de tenant es **únicamente** por `plaza_id` del JWT. El criterio original de T-024 que mencionaba el header `x-plaza-slug` quedó desactualizado.
  - ⚠️ La verificación cross-tenant end-to-end (token de plaza A pidiendo recurso de plaza B → 403) requiere usuarios con `plaza_id`, que se crean en el módulo 03. La lógica del guard está lista y unit-probada por inspección; queda pendiente la prueba manual con dos plazas al implementar T-036+. La capa RLS (T-038) es complementaria y vive en el módulo 03.

### T-025 — Configurar RolesGuard + @Roles decorator

- **Descripción:** Implementar `RolesGuard` con decorator `@Roles('admin_plaza', 'superadmin')` que valida que el rol del usuario esté en la lista. Materializa SC-1, SC-5, y la matriz de permisos de `docs/06-roles-y-permisos.md` §6.2.
- **Criterios de aceptación:**
  - [ ] `backend/src/common/decorators/roles.decorator.ts` con `SetMetadata('roles', roles)`.
  - [ ] `backend/src/common/guards/roles.guard.ts` que lee los metadatos y compara con `user.rol`.
  - [ ] Guard global con `APP_GUARD` (después de JwtAuthGuard y PlazaScopeGuard, formando el triple guard).
  - [ ] Si el rol no está en la lista → `403 Forbidden` con código `ROLE_FORBIDDEN`.
  - [ ] Si no hay `@Roles()` definido, el endpoint es accesible para cualquier rol autenticado.
  - [ ] Triple guard funciona en serie: una falla → 401 o 403 antes de llegar al handler.
- **Dependencias:** T-023, T-024.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `RolesGuard` (`common/guards/roles.guard.ts`) + decorator `@Roles()` (`common/decorators/roles.decorator.ts`), registrado como `APP_GUARD` después de Jwt y PlazaScope (triple guard en serie). Sin `@Roles()`, cualquier autenticado pasa; rol fuera de lista → `403 ROLE_FORBIDDEN`.
  - Los tres guards saltan los endpoints `@Public()`. Orden efectivo: Throttler → Jwt → PlazaScope → Roles.

### T-026 — Implementar POST /api/v1/auth/login (con lockout 5/15)

- **Descripción:** Implementar el endpoint de login con `email` + `password`. Verifica la contraseña con bcrypt, valida que el usuario no esté soft-deleted, registra el intento en `auditoria_login`, e implementa el lockout de 5 intentos en 15 min (RN-AU-4). Si es exitoso, emite access token (15 min) y refresh token (7 días), guarda el refresh hasheado en BD. Materializa S-PwdPolicy y S-Lockout.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/auth/login` con body `{ email, password }`.
  - [ ] Validación con `LoginSchema` de `@app/contracts`.
  - [ ] Verifica `bcrypt.compare(password, usuario.password_hash)`.
  - [ ] Si el email no existe: registra `auditoria_login` con `motivo_fallo: 'usuario_no_existe'` y retorna `401 INVALID_CREDENTIALS` (no revela si el email existe).
  - [ ] Si la contraseña es incorrecta: registra `auditoria_login` con `motivo_fallo: 'password_invalido'`.
  - [ ] Si hay 5 o más intentos fallidos en los últimos 15 min para ese email (o para esa IP): retorna `429 ACCOUNT_LOCKED` con tiempo restante.
  - [ ] Si es exitoso: emite access token JWT (HS256) con claims `sub`, `plaza_id`, `rol`, `rol_staff_id`, `iat`, `exp`. Genera refresh token UUID v4, lo hashea con SHA-256 y lo guarda en `refresh_token`.
  - [ ] Actualiza `usuario.last_login_at = now()`.
  - [ ] Retorna `{ accessToken, refreshToken, expiresIn: 900, user: { id, email, nombre, rol, plazaId, rolStaffId } }`.
  - [ ] Throttle: 5 req/min por IP (T-014).
  - [ ] Sanitización: el email siempre se trimea y se lowercases antes de buscar.
- **Dependencias:** T-018, T-020, T-021, T-022, T-023, T-025.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `POST /api/v1/auth/login` implementado. Verificado: éxito `200` con `{accessToken, refreshToken, expiresIn:3600, user{...}}`; password incorrecto / email inexistente → `401 INVALID_CREDENTIALS` (no revela cuál); registra `auditoria_login` en cada intento; `last_login_at` actualizado; email trim+lowercase; throttle `5 req/min` por IP verificado (`429`).
  - ⚠️ **Lockout T-V13 (no 5/15 del título):** **10** intentos fallidos en ventana de **15 min**, por email **o** IP → `429 ACCOUNT_LOCKED` con `retryAfter`. Valores desde `.env` (`LOGIN_LOCKOUT_THRESHOLD`/`LOGIN_LOCKOUT_WINDOW`).
  - Hashing bcrypt cost 12 (`PasswordService`); refresh = UUID v4, en BD solo su SHA-256 (`TokenService`).

### T-027 — Implementar POST /api/v1/auth/refresh

- **Descripción:** Implementar la rotación del refresh token: recibe el `refreshToken` del frontend, valida que exista, no esté revocado, no esté expirado, lo revoca, y emite un nuevo par access+refresh. Implementa detección de reuso (si se usa un refresh revocado, se revocan todos los del usuario como medida de seguridad).
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/auth/refresh` con body `{ refreshToken }`.
  - [ ] Hashea el token recibido con SHA-256 y busca en `refresh_token`.
  - [ ] Si no existe o `revoked_at` no es null → `401 REFRESH_INVALID`. Y se revocan todos los refresh del usuario por seguridad.
  - [ ] Si `expires_at < now()` → `401 REFRESH_EXPIRED`.
  - [ ] Si es válido: marca el actual como `revoked_at = now()`, genera uno nuevo, lo guarda.
  - [ ] Retorna el nuevo par access+refresh.
  - [ ] El endpoint NO está protegido por JwtAuthGuard (es el que se usa cuando el access expiró).
- **Dependencias:** T-020, T-023, T-026.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `POST /api/v1/auth/refresh` (`@Public()`). Verificado: rota tokens (`200` con par nuevo); detección de reuso → al usar un refresh revocado, `401 REFRESH_INVALID` **y se revocan todos** los del usuario (confirmado: el refresh recién emitido también quedó inválido); expirado → `401 REFRESH_EXPIRED`.

### T-028 — Implementar POST /api/v1/auth/logout

- **Descripción:** Implementar logout que revoca el refresh token actual. El access token expira solo (15 min), pero el refresh se marca como `revoked_at = now()`.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/auth/logout` con body `{ refreshToken }` (alternativamente, Auth.js limpia la cookie).
  - [ ] Marca el refresh como `revoked_at = now()`.
  - [ ] Retorna `204 No Content`.
  - [ ] Endpoint protegido por JwtAuthGuard.
  - [ ] Opcional: si se llama con un access token que tiene un `refreshToken` en sus claims, también lo revoca.
- **Dependencias:** T-020, T-023, T-027.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `POST /api/v1/auth/logout` (protegido por JwtAuthGuard) revoca el refresh recibido y responde `204`.

### T-029 — Implementar flujo de reset de contraseña

- **Descripción:** Implementar `POST /api/v1/auth/reset-password` (recibe email, envía email con token de un solo uso, 30 min) y `POST /api/v1/auth/reset-password/confirm` (recibe token + newPassword, marca `used_at`, actualiza `usuario.password_hash`). Materializa RN-AU-6 y S-Reset.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/auth/reset-password` con body `{ email }`. Genera UUID v4, hashea con SHA-256, guarda en `password_reset_token` con `expires_at = now() + 30 min`. Envía email con plantilla `reset-password.html` y link `https://{plaza.slug}.plazapp.com/reset-password/{token}`.
  - [ ] Si el email no existe, retorna `200 OK` igualmente (no revela si existe).
  - [ ] `POST /api/v1/auth/reset-password/confirm` con body `{ token, newPassword }`. Hashea token, busca en BD, verifica `expires_at > now()` y `used_at IS NULL`. Si OK: marca `used_at = now()`, hashea newPassword con bcrypt cost 12 y actualiza `usuario.password_hash`, revoca todos los `refresh_token` del usuario.
  - [ ] Validación Zod de la nueva contraseña.
  - [ ] Token usado o expirado → `400 RESET_TOKEN_INVALID`.
  - [ ] El email de reset es crítico (no se desactiva con unsubscribe).
- **Dependencias:** T-020, T-022, T-118 (en `09-notificaciones-email.md`, plantilla).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `POST /reset-password` (genera token UUID, SHA-256, TTL 30 min, envía email; responde `200` exista o no el email) y `POST /reset-password/confirm` (valida no usado/no expirado, `used_at=now()`, re-hashea con bcrypt, revoca todos los refresh). Verificado end-to-end con MailHog: email entregado, reset confirmado `200`, login con nueva clave OK, reuso del token → `400 RESET_TOKEN_INVALID`.
  - ⚠️ **Link de reset T-V01:** `${FRONTEND_URL}/reset-password/{token}` (single domain, la plaza NO va en la URL). No se usa `{plaza.slug}.plazapp.com` del criterio original.
  - ⚠️ **Mailer provisional (pendiente de T-118):** `MailerService` envía directo por SMTP (MailHog) con plantilla HTML inline. El módulo 09 (cola `email_log` + worker + plantillas) lo reemplazará. Marcado en el código.

### T-030 — Implementar PATCH /api/v1/auth/change-password

- **Descripción:** Implementar cambio de contraseña con sesión activa: el usuario autenticado envía `currentPassword` y `newPassword`. Verifica el actual con bcrypt, hashea el nuevo, actualiza, y revoca todos los `refresh_token` del usuario para forzar re-login en otros dispositivos.
- **Criterios de aceptación:**
  - [ ] `PATCH /api/v1/auth/change-password` con body `{ currentPassword, newPassword }`. Protegido por JwtAuthGuard.
  - [ ] Verifica `currentPassword` con `bcrypt.compare`. Si no coincide → `400 INVALID_CURRENT_PASSWORD`.
  - [ ] Valida `newPassword` con la política (Zod regex, 10+ chars, etc.).
  - [ ] Hashea `newPassword` con bcrypt cost 12.
  - [ ] Actualiza `usuario.password_hash`.
  - [ ] Marca todos los `refresh_token` del usuario con `revoked_at = now()`.
  - [ ] Retorna `204 No Content`.
- **Dependencias:** T-018, T-022, T-023.
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `PATCH /api/v1/auth/change-password` (protegido). Verifica `currentPassword` con bcrypt (`400 INVALID_CURRENT_PASSWORD` si no coincide), valida `newPassword` (Zod), re-hashea, revoca todos los refresh. Responde `204`. Verificado end-to-end.

### T-031 — Implementar GET /api/v1/auth/me

- **Descripción:** Endpoint que retorna el perfil del usuario autenticado. Útil para que el frontend hidrate el estado de Auth.js.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/auth/me` retorna el usuario del JWT actual.
  - [ ] Protegido por JwtAuthGuard.
  - [ ] Nunca expone `password_hash` ni tokens.
  - [ ] Response: `{ id, email, nombre, telefono, rol, rolStaffId, inquilinoId, plazaId, lastLoginAt, createdAt }`.
  - [ ] `404` si el usuario fue soft-deleted entre tanto.
- **Dependencias:** T-018, T-023.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `GET /api/v1/auth/me` (protegido) retorna el perfil del usuario del JWT sin `password_hash` ni tokens; `404 USER_NOT_FOUND` si fue soft-deleted. Verificado.

### T-032 — Configurar Auth.js (NextAuth v5) en frontend con Credentials Provider

- **Descripción:** Configurar NextAuth v5 (Auth.js) con Credentials Provider que consume el endpoint `POST /api/v1/auth/login` del backend. La sesión se persiste en cookie httpOnly (S-ARQ-F). El JWT nunca llega a JavaScript del cliente. Materializa D3, S-ARQ-F.
- **Criterios de aceptación:**
  - [ ] `frontend/auth.ts` (raíz de Next.js) con `NextAuth({ providers: [Credentials({...})], session: { strategy: 'jwt' }, callbacks: { jwt, session } })`.
  - [ ] Credentials Provider hace `fetch` a `${NEXT_PUBLIC_API_URL}/api/v1/auth/login` con `{ email, password }`.
  - [ ] El callback `jwt` guarda `accessToken` y `refreshToken` en el token de NextAuth (no en la sesión).
  - [ ] El callback `session` solo expone `user` (sin tokens).
  - [ ] Cookie httpOnly con `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'lax'`.
  - [ ] `auth()` (server-side helper) retorna la sesión.
  - [ ] `signIn` y `signOut` server actions disponibles.
  - [ ] La sesión se refresca automáticamente cuando el access está a punto de expirar.
- **Dependencias:** T-026, T-027.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-033 — Configurar middleware Next.js para inyectar token JWT en requests a NestJS

- **Descripción:** Configurar el middleware de Next.js que añade el `accessToken` y el header `x-plaza-slug` (resolución de tenant) a cada Server Action/Server Component que llama al backend. Materializa S-ARQ-E, S-ARQ-F.
- **Criterios de aceptación:**
  - [ ] `frontend/middleware.ts` con `auth` middleware de NextAuth.
  - [ ] Función helper `apiFetch(path, options)` que toma el `accessToken` de la sesión y lo pasa como `Authorization: Bearer <token>`.
  - [ ] Resolución de tenant: extrae el slug del subdominio (`acme.plazapp.com` → `acme`) o del path (`/p/acme/...`) y lo añade como header `x-plaza-slug`.
  - [ ] Si el access token está expirado, llama a `POST /api/v1/auth/refresh` y reintenta una vez.
  - [ ] Si el refresh falla, redirige a `/login`.
  - [ ] El helper está disponible tanto en Server Components como en Server Actions.
- **Dependencias:** T-032, T-038 (en `03-plazas-multitenant.md`, RLS).
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-034 — Implementar pantalla /login

- **Descripción:** Implementar la pantalla de login con React Hook Form + Zod, fondo con branding de la plaza (logo + color primario), mensaje de error de credenciales inválidas, manejo de cuenta bloqueada, y link a `/reset-password`.
- **Criterios de aceptación:**
  - [ ] Ruta `frontend/app/(public)/login/page.tsx` (Server Component) con un Client Component interno para el formulario.
  - [ ] Formulario con React Hook Form + `LoginSchema` de `@app/contracts`.
  - [ ] Campos: email, password.
  - [ ] Al submit: server action llama a `signIn` de Auth.js (Credentials Provider → backend login).
  - [ ] Si las credenciales son inválidas: muestra toast "Email o contraseña incorrectos" (no revela cuál).
  - [ ] Si la cuenta está bloqueada: muestra toast con tiempo restante.
  - [ ] Si OK: redirige a `/dashboard` (o `/admin/dashboard` si es admin_plaza, o `/superadmin/plazas` si es superadmin).
  - [ ] Link "¿Olvidaste tu contraseña?" apunta a `/reset-password`.
  - [ ] Si ya hay sesión, redirige a la home.
  - [ ] Logo y color de la plaza visibles (resueltos desde la URL o desde una config pública).
- **Dependencias:** T-032, T-033, T-042 (en `03-plazas-multitenant.md`, branding).
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-035 — Implementar pantallas /reset-password y /reset-password/[token]

- **Descripción:** Implementar la pantalla de solicitud de reset y la pantalla de confirmación con el token. Materializa el flujo end-to-end con T-029.
- **Criterios de aceptación:**
  - [ ] `frontend/app/(public)/reset-password/page.tsx` con formulario de email. Submit → server action llama a `POST /api/v1/auth/reset-password` → muestra mensaje "Si el email existe, recibirás un enlace".
  - [ ] `frontend/app/(public)/reset-password/[token]/page.tsx` con formulario de nueva contraseña (con confirmación). Valida con `ResetPasswordConfirmSchema`. Submit → `POST /api/v1/auth/reset-password/confirm` → redirige a `/login` con toast "Contraseña actualizada".
  - [ ] Si el token es inválido o expirado: muestra mensaje "El enlace es inválido o ha expirado" con link para solicitar uno nuevo.
  - [ ] Branding aplicado (logo + color).
- **Dependencias:** T-029, T-032, T-033, T-034.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*
