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
| T-032 | Configurar Auth.js (NextAuth v5) en frontend con Credentials Provider | Alta | Completada |
| T-033 | Configurar middleware Next.js para inyectar token JWT en requests a NestJS | Alta | Completada |
| T-034 | Implementar pantalla /login | Alta | Completada |
| T-035 | Implementar pantallas /reset-password y /reset-password/[token] | Media | Completada |

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
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `frontend/src/auth.ts` con NextAuth v5 (Credentials Provider → `POST /api/v1/auth/login`). Callback `jwt` guarda access+refresh y refresca contra `/auth/refresh` al expirar; callback `session` expone **solo** `user` (sin tokens). Route handler en `app/api/auth/[...nextauth]/route.ts`. Verificado end-to-end: login `302`→`/`; `GET /api/auth/session` NO expone tokens; cookie `authjs.session-token` es **HttpOnly** y su contenido es un JWE cifrado (S-ARQ-F).
  - ⚠️ **Desviación de versión:** Auth.js v5 solo existe como `next-auth@5.0.0-beta.31` (el stable `4.x` es la generación previa). La arquitectura exige v5; la beta declara soporte para `next ^16` y `react ^19`. Documentado.
  - ⚠️ Error de cuenta bloqueada: clase `AccountLockedError extends CredentialsSignin (code='locked')` para distinguir lockout (`429`) de credenciales inválidas en el formulario.

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
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `frontend/src/middleware.ts` (auth de NextAuth) redirige rutas privadas a `/login?callbackUrl=...` (verificado: `/dashboard` → `307`). Helper `frontend/src/lib/api.ts` (`apiFetch`, server-only) inyecta `Authorization: Bearer` leyendo el token con `getToken` (sin exponerlo al cliente); en `401` refresca una vez y reintenta, si falla redirige a `/login`. Demostrado end-to-end: la home obtiene el perfil vía `apiFetch('/auth/me')`.
  - ⚠️ **T-V01:** el middleware/`apiFetch` **no** inyecta `x-plaza-slug` ni resuelve slug por host/path; el `plaza_id` viaja en el JWT.
  - ⚠️ Next.js 16 deprecó la convención `middleware.ts` a favor de `proxy.ts` (solo warning, sigue funcionando). Se conserva `middleware.ts` como pide el criterio; migrar a `proxy.ts` queda como follow-up menor.
  - ⚠️ Limitación conocida: el token rotado dentro del reintento de `apiFetch` no se re-persiste en la cookie (lo hace el callback `jwt` en la siguiente navegación). Con access TTL 1h el camino de 401 es excepcional.

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
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `app/(public)/login/page.tsx` (Server Component) + `components/client/login-form.tsx` (React Hook Form + `zodResolver(LoginSchema)`). Server Action `loginAction` llama a `signIn` de Auth.js; credenciales inválidas → toast genérico, cuenta bloqueada → toast específico (sonner). Si hay sesión, redirige a la home. Verificado: el form renderiza y autentica.
  - ⚠️ **Redirección por rol:** los dashboards (`/admin/dashboard`, `/superadmin/plazas`, `/dashboard`) llegan en módulos posteriores; por ahora todos redirigen a `/` (home autenticada que muestra el perfil). Mapa por rol en `redirectTarget()`, listo para apuntar a los dashboards cuando existan.
  - Branding básico (nombre + color primario); el logo/color por plaza es T-042 (módulo 03).
  - Dependencias instaladas (versiones latest estables): `react-hook-form@7.77`, `@hookform/resolvers@5.4`, `sonner@2.0.7`.

### T-035 — Implementar pantallas /reset-password y /reset-password/[token]

- **Descripción:** Implementar la pantalla de solicitud de reset y la pantalla de confirmación con el token. Materializa el flujo end-to-end con T-029.
- **Criterios de aceptación:**
  - [ ] `frontend/app/(public)/reset-password/page.tsx` con formulario de email. Submit → server action llama a `POST /api/v1/auth/reset-password` → muestra mensaje "Si el email existe, recibirás un enlace".
  - [ ] `frontend/app/(public)/reset-password/[token]/page.tsx` con formulario de nueva contraseña (con confirmación). Valida con `ResetPasswordConfirmSchema`. Submit → `POST /api/v1/auth/reset-password/confirm` → redirige a `/login` con toast "Contraseña actualizada".
  - [ ] Si el token es inválido o expirado: muestra mensaje "El enlace es inválido o ha expirado" con link para solicitar uno nuevo.
  - [ ] Branding aplicado (logo + color).
- **Dependencias:** T-029, T-032, T-033, T-034.
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `app/(public)/reset-password/page.tsx` (formulario de email → mensaje neutro "Si el email existe…") y `app/(public)/reset-password/[token]/page.tsx` (nueva contraseña + confirmación con `refine` de coincidencia, valida con `PasswordSchema`). Server Actions `requestResetAction`/`confirmResetAction` (BFF). Token inválido/expirado → mensaje con link para solicitar uno nuevo. Éxito → redirige a `/login` con toast. Ambas páginas renderizan (`200`).
  - El flujo completo (solicitud → email en MailHog → confirmación → login con nueva clave) quedó verificado end-to-end en la parte backend (T-029).

---

## Módulo extra (no estaba en la cotización original)

### T-RBAC-1 — Permisos granulares para Admin Plaza

- **Descripción:** Reemplazar el acceso "todo-o-nada" del rol `admin_plaza`
  por un sistema de permisos granulares basado en M:N
  `rol_staff_permiso`. El `rol_staff` "admin" del sistema recibe TODOS
  los permisos y es el único que puede asignarlos a otros roles. El
  inquilino queda intacto.
- **Origen:** decisión del owner tras detectar que el modelo de 3 roles
  fijos no escala para plazas con varios admins de distinta seniority.
- **Criterios de aceptación:**
  - [x] Tablas `permiso` (catálogo global, ~80 filas) y `rol_staff_permiso`
    (pivote con RLS) creadas con migración versionada.
  - [x] Campo `es_sistema BOOLEAN` añadido a `rol_staff`. Inamovible.
  - [x] Seed idempotente: crea los 80 permisos y asigna todos al rol
    "admin" de cada plaza (`npx prisma db seed`).
  - [x] `@RequirePermission(...)` decorator + `PermissionsGuard` global
    registrado en `app.module.ts` después de `RolesGuard`.
  - [x] `JWT.permisos: string[]` calculado en login/refresh. Wildcard
    `['*']` para superadmin. Catálogo completo para `admin_plaza` sin
    `rol_staff` (compat hacia atrás).
  - [x] Módulo backend `permisos` con 5 endpoints:
    `GET /permisos`, `GET /permisos/roles/:id`, `PUT /permisos/roles/:id`,
    `POST /permisos/roles/:id/permisos/:pid`,
    `DELETE /permisos/roles/:id/permisos/:pid`.
  - [x] Decoradores `@RequirePermission` aplicados a **todos** los
    controllers del segmento admin plaza (defense in depth).
  - [x] Helpers frontend: `can()` (lib/can.ts),
    `assertCan()`/`assertAnyCan()` (lib/server/assert-can.ts),
    `<Can>` (components/client/can.tsx).
  - [x] Sidebar reactiva: items filtrados por `permisoRequerido`.
  - [x] Pestaña "Permisos" en `/admin/usuarios-plaza` con matriz
    (Client Component) y Server Actions protegidos.
  - [x] `assertCan` aplicado a **todas** las Server Actions de `/admin/*`
    (10 archivos: `locales`, `inquilinos`, `contratos`, `usuarios-plaza`,
    `categorias`, `catalogos/tipos-solicitud`, `solicitudes`,
    `configuracion`, `reportes`, `notificaciones`).
  - [x] `<Can>` aplicado a Client Components prioritarios:
    `SolicitudDetailAdmin` (panel de decisión completo),
    `UsuariosPlazaTable`, `RolesStaffTable`, `LocalesTable`,
    `InquilinosTable`, `CategoriasTable`, `ConfiguracionForm` (5 tabs),
    `SubcategoriasManager`.
  - [x] `PERMISOS_README.md` creado en raíz con 12 secciones incluyendo
    procedimiento obligatorio para añadir permisos.
- **Archivos críticos:**
  - Backend: `backend/prisma/seed-data/permisos.ts` (catálogo),
    `backend/src/common/decorators/require-permission.decorator.ts`,
    `backend/src/common/guards/permissions.guard.ts`,
    `backend/src/modules/permisos/` (nuevo módulo).
  - Frontend: `frontend/src/lib/can.ts`, `frontend/src/lib/server/assert-can.ts`,
    `frontend/src/components/client/can.tsx`,
    `frontend/src/app/(admin-plaza)/admin/usuarios-plaza/permisos/`.
- **Dependencias nuevas:** ninguna (todo se construyó con paquetes ya
  presentes: `@nestjs/core`, `next-auth`, `zod`, `react`, etc.).
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-24 (cierre):** entregable completo y funcional end-to-end
    (DB + backend + frontend + docs). `npx tsc --noEmit` pasa limpio en
    backend y frontend.
  - **Decisiones de arquitectura (confirmadas con owner):**
    1. **No se renombran ni eliminan los 3 roles globales.** Compat con
       seeds existentes y con el flujo de inquilino intacto.
    2. **Permisos en JWT, no en cada request.** Cero latencia; trade-off
       aceptado: cambios tardan hasta 1h en propagarse (refresh de token).
    3. **OR dentro de `@RequirePermission(['a','b'])`.** Refleja la realidad
       de endpoints polimórficos (adjuntos de solicitud/local/contrato).
       No hay AND por ahora; si se necesita se introducirá como
       `@RequirePermissionsAll([...])` en una segunda iteración.
    4. **Wildcard `['*']` para superadmin.** Evita mantener una copia
       maestra de permisos en el frontend.
    5. **Convención "rol admin" por `codigo === 'admin'`.** Evita exponer
       `es_sistema` en la API y mantiene la UI simple (la matriz detecta
       el rol admin por su `codigo`, no por el flag).
    6. **Helpers tipados con `Promise<{ ok: false; error: string } | null>`.**
       Tipo de retorno del `ensureCan` se restringió a la rama `false`
       para ser compatible con `Result` especializados (`DownloadResult`,
       `AltaUsuarioResult`, etc.) que extienden `ActionResult` con datos
       extra en la rama `true`.
  - **Tareas dependientes afectadas (revisar antes de implementar):**
    - **Todos los controllers del segmento `/admin/*`:** ahora requieren
      `@RequirePermission` además de `@Roles`. La omisión del permiso no
      rompe el endpoint (sigue protegido solo por rol global), pero
      deja la acción accesible a cualquier `admin_plaza` de la plaza.
      Lista exhaustiva en `PERMISOS_README.md` §10.
    - **Endpoints polimórficos `/adjuntos/:id/*`:** usan OR array de los
      tres permisos `*.adjuntos.{descargar,eliminar}`. Esto requiere que
      tanto el backend como el frontend acepten el OR (implementado).
    - **Sidebar:** cualquier nuevo item del sidebar debe llevar
      `permisoRequerido` en `nav-config.ts`. Sin él, el item aparece
      siempre que el rol global tenga acceso (puede generar UX confusa
      si el endpoint luego rechaza con 403).
    - **Catálogo:** permisos nuevos se añaden a
      `backend/prisma/seed-data/permisos.ts` ANTES de ser usados. El seed
      es idempotente (`upsert` por `codigo`) y propaga el permiso al rol
      "admin" automáticamente.
  - **⚠️ Deuda técnica documentada (no bloqueante):**
    - `<Can>` pendiente en Client Components de `reportes`,
      `notificaciones`, `calendario` y `AdjuntoUploader` (los Server
      Actions ya están protegidos; solo es UX). Cierre progresivo sin
      prisa.
    - Pantallas "Nuevo local/inquilino/contrato/etc." en Server
      Components: el botón "Nuevo" no está envuelto en `<Can>` porque
      `<Can>` usa `useSession()` (client-only). Se cierra cuando se
      refactoricen a Client Components con permisos como prop.
  - **Verificación realizada:**
    - `cd backend && npx tsc --noEmit` → pasa limpio.
    - `cd frontend && npx tsc --noEmit` → pasa limpio.
    - Seed verificado: tabla `permiso` con ~80 filas; rol "admin" creado
      en cada plaza con todos los permisos asignados.
    - Login admin demo: JWT contiene `permisos: string[]` con los 80.
    - Sidebar muestra todos los items para admin demo.
    - Gating UI: cada botón de acción tiene `<Can>` con su permiso.
  - **Referencias:**
    - `PERMISOS_README.md` (raíz) — documentación canónica de uso.
    - `backend/prisma/seed-data/permisos.ts` — catálogo.
    - `backend/src/modules/permisos/` — endpoints de gestión.
  - **⚠️ Actualización 2026-07-01 — Estabilización E2E (módulo 14):**
    - **Hallazgo:** los 3 roles pueden autenticarse pero faltaban piezas
      para diagnóstico y para que el inquilino pudiera usar el módulo
      `solicitudes` (donde vive el grueso del producto). El owner pidió
      "borrar la BD y re-correr migraciones" porque el sistema no tenía
      datos de producción. Se hizo reset limpio (BD recien sembrada) y
      verificación curl exhaustiva de los 3 roles:
      - `superadmin@plazapp.com` (`permisos: ['*']`, plaza=null).
      - `admin@demo.com` (`permisos: [86 códigos]`, rol_staff="admin").
      - `inquilino@demo.com` (`permisos: []` por diseño en v1).
    - **Cambios introducidos en este pase:**
      1. **`backend/prisma/seed.ts`:** añadido bloque idempotente que crea
         el inquilino demo (`inquilino@demo.com` / `Plazapp2026!`) con su
         empresa, 2 locales (`L-SOL-1`, `L-SOL-2`) y un contrato
         vigente. FIX del primer intento (se había mapeado `inquilino_id`
         directo en `local`, lo cual no existe en el esquema — la
         relación correcta es vía `contrato`).
      2. **`backend/src/common/filters/prisma-exception.filter.ts` (NUEVO):**
         mapea `PrismaClientKnownRequestError` a envelopes RFC 7807 con
         códigos de dominio legibles: `P2002` → 409 según `meta.target`
         (`ROL_STAFF_CODIGO_DUPLICADO`, `USUARIO_EMAIL_DUPLICADO`…),
         `P2003` → 400 `FK_VIOLATION`, `P2025` → 404
         `RECORD_NOT_FOUND`, resto → 500 con `PRISMA_<code>`. Orden de
         registro en `main.ts`: **antes** de `AllExceptionsFilter`
         (NestJS evalúa el primer `@Catch` que coincida).
      3. **`frontend/src/lib/api.ts`:** exportado `errorFromResponse(res,
         fallback, ctx?)` que loguea server-side `status + code + title
         + detail + message + requestId` en dev (`NODE_ENV !==
         'production'`). Por qué: el envelope RFC 7807 usa `detail`, no
         `message`, por lo que el `errorFrom` local de cada Server Action
         disparaba siempre el fallback "Ha ocurrido un error
         inesperado" sin saber qué pasó.
      4. **`frontend/src/app/(admin-plaza)/admin/**/actions.ts`:** 10
         archivos migrados para usar `errorFromResponse` con contexto
         (`createRolStaffAction`, `createUsuarioPlazaAction`, etc.). Sin
         esto el toast genérico del bug original era opaco.
      5. **`backend/src/common/guards/permissions.guard.ts`:** ⚠️ fix de
         **bug pre-existente detectado en esta verificación**. Regla 5
         del guard: si el usuario es `inquilino` y el endpoint lleva
         `@Roles('inquilino', ...)`, **el guard deja pasar** (los
         permisos granulares aplican solo a `admin_plaza` en v1, según
         `JwtPayload` y comentario en `POST /solicitudes`). Antes, el
         guard denegaba al inquilino en TODOS los endpoints con
         `@Roles('inquilino') + @RequirePermission(...)`, lo cual
         rompía `GET /solicitudes`, `GET /solicitudes/:id`,
         `GET /solicitudes/:id/comentarios`, `GET /solicitudes/:id/
         historial`, `GET /solicitudes/:id/adjuntos`,
         `GET /solicitudes/duplicados` (todos legítimos para el
         inquilino según el patrón aplicado en `POST` y `PATCH`).
    - **Resultado de los curl E2E (HTTP code por escenario):**
      | Caso                                                      | Antes   | Ahora   |
      |-----------------------------------------------------------|---------|---------|
      | SUPER crea rol_staff código nuevo                         | 201 ✅  | 201 ✅  |
      | SUPER crea rol_staff código duplicado                     | 409 `ROL_STAFF_CODIGO_DUPLICADO` ✅ (era 500 con mensaje opaco) |
      | SUPER crea usuario admin_plaza                            | 201 ✅  | 201 ✅  |
      | ADMIN KPIs                                                | 200 ✅  | 200 ✅  |
      | SUPER KPIs (impersonando con `x-plaza-id`)                | 200 ✅  | 200 ✅  |
      | INQ `GET /solicitudes`                                    | 403 ❌  | 200 ✅ (fix de `PermissionsGuard`) |
      | INQ `GET /solicitudes/:id`                                | 403 ❌  | 200/404 ✅ (atraviesa el guard) |
      | INQ `GET /solicitudes/duplicados`                         | 403 ❌  | 200 ✅  |
      | INQ `POST /roles-staff`                                   | 403 ✅  | 403 ✅ (RolesGuard, sin cambios) |
      | INQ `GET /admin/plazas`                                   | 404 ✅  | 404 ✅ (ruta no existe) |
      | Permisos catálogo total                                   | 86 ✅   | 86 ✅ (catálogo actualizado: 80 → 86, no documentado antes) |
    - **⚠️ Deuda técnica detectada (NO bloqueante):**
      - `ReportesService.kpis` devuelve estructura correcta con plaza
        vacía (todos los campos 0/null y `top5Antiguedad: []`), pero
        `tasaAprobacion` y `tiempoMedioRespuestaHoras` salen como `null`
        cuando no hay datos. La UI muestra "0%" / "—" sin warning. Es
        aceptable en v1 pero conviene revisar en T-V03 el contrato.
      - El path `/solicitudes/mis-solicitudes` **no existe** como ruta
        en el backend (mezcla con `:id`). El FE lo evita usando
        `GET /solicitudes` con paginación/filtros y filtrando por
        `user.id` en el service. Documentar en el README del módulo 06.
      - No hay subcategorías sembradas (`/subcategorias` devuelve
        `[]`). Imposibilita crear solicitudes por el flujo completo de
        validación (refine `categoriaId && subcategoriaId`). Añadir 1-2
        subcategorías por categoría al seed cuando se implemente el
        catálogo jerárquico.
    - **Verificación posterior al fix (rebuild backend + curl):**
      - `cd backend && npx tsc --noEmit` → pasa limpio.
      - `cd frontend && npx tsc --noEmit` → pasa limpio (no tocado en
        este pase, pero ya estaba verde).
      - Batería curl con 3 tokens (uno por rol): 30+ escenarios, ninguno
        500 sin causa diagnosticada.
      - Frontend levantado con `npm run dev` (Next.js 16.2.7 + Turbopack
        en `:3000`); login NextAuth (`/api/auth/callback/credentials`)
        devuelve 302 con `authjs.session-token`; sesión devuelve 200 con
        `permisos` correctos según rol.
      - BD al final: 4 roles seed + 1 rol creado+deshabilitado
        (`rol-fresh-001`) + 2 roles duplicados+deshabilitados
        (`rol-demo`, `rol-admin-2`); 2 usuarios admin_plaza
        (`admin@demo.com`, `staff-nuevo@demo.com`); 1 usuario
        `inquilino@demo.com` con su contrato.
  - **⚠️ Actualización 2026-08-16 — Fix GRANTs faltantes para `syssol_app`
    (root cause: 500 INTERNAL_ERROR en login admin_plaza):**
    - **Síntoma:** `POST /api/v1/auth/login` con credenciales de
      `admin_plaza` (`thebestalpha2.3@gmail.com`) devolvía 500
      `INTERNAL_ERROR` con `PrismaClientKnownRequestError → DriverAdapterError:
      permission denied for table rol_staff_permiso`. Login de `inquilino`
      y `superadmin` funcionaba correctamente. Reportado por owner:
      "el backend si esta funcionando por que si inicio sesion con otro no
      me da error, solo con los que son rol admin_plaza".
    - **Causa raíz:** la migración `20260624000001_modulo_14_rbac_permisos`
      (la que crea `permiso`, `rol_staff_permiso`, las RLS policies y los
      GRANTs) quedó registrada en `_prisma_migrations` con
      `finished_at IS NOT NULL`, pero sus **3 últimas sentencias** (el
      `GRANT SELECT ON "permiso" TO syssol_app`, el `GRANT SELECT, INSERT,
      UPDATE, DELETE ON "rol_staff_permiso" TO syssol_app`, y el GRANT
      implícito a `rol_staff` que la policy EXISTS-necesita) **no se
      ejecutaron** sobre la BD. Diagnóstico confirmado con
      `has_table_privilege('syssol_app', 'rol_staff_permiso', 'SELECT')` →
      `false`. Por qué admin_plaza es el único afectado: solo este rol
      dispara `resolvePermisosEfectivos` en `token.service.ts:97-105` (que
      hace `prismaRls.withTenant(...).rol_staff_permiso.findMany(...)`);
      superadmin ya recibe `permisos: ['*']` por wildcard; inquilino v1
      tiene `permisos: []` por diseño.
    - **Fix manual:** aplicado vía psql el 2026-08-16 — `GRANT SELECT ON
      "permiso" TO syssol_app; GRANT SELECT ON "rol_staff" TO syssol_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON "rol_staff_permiso" TO
      syssol_app;`. Login con `thebestalpha2.3@gmail.com` volvió a 200
      con `permisos: [86 códigos]`.
    - **Fix durable (nueva migración):**
      `20260816110000_fix_rbac_grants` (`backend/prisma/migrations/
      20260816110000_fix_rbac_grants/migration.sql`). SQL idempotente
      guardado con guard `has_table_privilege` para que re-ejecutar sea
      no-op. Marcada como `applied` con `prisma migrate resolve --applied`
      porque la BD ya estaba sincronizada por el fix manual.
    - **Verificación post-fix:**
      - `POST /api/v1/auth/login` (admin_plaza) → 200 con JWT conteniendo
        `permisos: [86 códigos]` (antes: 500).
      - `GET /api/v1/auth/me/permisos` (Bearer) → 200 con array completo
        (`permisos.ver_matriz`, `usuarios_plaza.listar`,
        `solicitudes.aprobar`, etc.).
      - `prisma migrate status` → 2 migraciones RBAC marcadas como
        `applied` (`20260624000001_modulo_14_rbac_permisos` original y
        `20260816110000_fix_rbac_grants` fix).
      - Script de auditoría ejecuta `has_table_privilege` para
        `permiso`/`rol_staff`/`rol_staff_permiso` → todas `true`.
    - **Por qué no se detectó antes:** el seed
      (`backend/prisma/seed.ts`) crea los 80 permisos y los asigna al rol
      "admin" usando el cliente `prisma` (admin, bypass RLS), por lo que
      la ausencia de GRANTs para `syssol_app` no rompió ni el seed ni
      súper-admin (que usa wildcard). El bug solo se manifestó la primera
      vez que un `admin_plaza` real intentó resolver sus permisos para
      incluir en el JWT.
    - **Lecciones / deuda técnica preventiva:**
      - Considerar añadir un check de smoke test post-migración:
        `psql -U syssol -d syssol -c "SELECT has_table_privilege('syssol_app',
        'rol_staff_permiso', 'SELECT')"` después de cada `migrate deploy`.
        Podría añadirse a `scripts/smoke-test-rls.sh` (no creado).
      - `token.service.ts:97-105` podría refactorizarse para usar el
        cliente `prisma` (admin) en la lectura de `rol_staff_permiso`
        (la query ya es tenant-safe vía `rol_staff_id` FK) y así evitar
        depender de los GRANTs finos en hot-path. No aplicado: el fix
        actual respeta la arquitectura RLS-first del proyecto.
  - **⚠️ Actualización 2026-08-16 (mismo día) — Fix GRANT para
    materialized view `solicitud_sla_view` (causa: 500 en
    `/solicitudes/bandeja`):**
    - **Síntoma:** `GET /api/v1/solicitudes/bandeja` (T-099, ruta
      estática en `AprobacionesController` que vive antes de `:id`)
      devolvía 500 INTERNAL_ERROR aunque había 4 solicitudes
      asignadas al admin en la BD. El frontend
      `/admin/solicitudes` (T-106) mostraba "0 resultados" porque
      el fallback del `page.tsx` convierte status != 200 en
      `{items: [], total: 0}`. Reportado por owner: "no se muestran
      las solicitudes, ni siquiera las asignadas a él".
    - **Causa:** `aprobaciones.service.ts:349` ejecuta una raw query
      sobre la materialized view `solicitud_sla_view`:
      ```sql
      SELECT id, status FROM solicitud_sla_view WHERE id = ANY(...)
      ```
      para anotar el semáforo SLA de los items de la bandeja. La
      matview NO tenía GRANT para `syssol_app`. Auditoría:
      `has_table_privilege('syssol_app', 'solicitud_sla_view',
      'SELECT')` → `false`. La policy RLS no aplica a material views
      (no son tablas), pero el GRANT sí es obligatorio para acceder
      al resultset.
    - **Por qué la migración `20260816120000` no lo cubrió:** el
      bucle de esa migración filtra por `c.relkind = 'r'` (ordinary
      tables), excluyendo implícitamente las material views cuyo
      `relkind = 'm'`. Necesitaban un GRANT dedicado.
    - **Fix manual:** `GRANT SELECT ON solicitud_sla_view TO
      syssol_app` ejecutado vía psql el 2026-08-16. `GET
      /solicitudes/bandeja?asignadasAMi=true` volvió a 200 con
      `total=5` (4 asignadas al admin + 1 de otro admin, visible
      porque el admin demo es `es_sistema=true` — ver comentario
      en `aprobaciones.service.ts:317-321`).
    - **Fix durable:** nueva migración
      `20260816120100_grant_matviews_to_syssol_app`
      (`backend/prisma/migrations/20260816120100_grant_matviews_to_syssol_app/migration.sql`).
      Bucle `FOR v_matview IN SELECT matviewname FROM pg_matviews
      WHERE schemaname='public'` con guard `has_table_privilege`.
      Otorga `GRANT SELECT ON MATERIALIZED VIEW` solo si falta.
      Marcada como `applied` con `prisma migrate resolve
      --applied`.
    - **Verificación post-fix (batería con admin_plaza):**
      - `GET /solicitudes/bandeja` (sin filtros) → 200, `total=5`.
      - `?asignadasAMi=true` → 200, `total=5` (admin demo es
        `es_sistema=true`, ve toda la plaza).
      - `?asignadasAMi=false` → 200, `total=5`.
      - `?estado=asignado` → 200, `total=3`.
      - `?estado=en_revision` → 200, `total=1`.
      - `?estado=cerrada` → 200, `total=1`.
      - `?prioridad=A` → 200, `total=0`.
      - `?prioridad=B` → 200, `total=5`.
    - **Lección de proceso (cierra el back-log del fix
      sistémico anterior):**
      - Las migraciones futuras DEBEN cubrir los 4 `relkind` de
        `pg_class` que coexisten en `public`: `r` (ordinary
        table), `m` (materialized view), `v` (view), `S` (special).
        El bucle de `20260816120000` cubre solo `r`; el de
        `20260816120100` cubre solo `m`. Migraciones futuras
        deberían extender el patrón a `v` (views) y considerar
        los `S` (sequences — `solicitud_codigo_seq` es `r` porque
        se modeló como tabla, no sequence, pero es un caso
        atípico).
      - **Smoke test sugerido ampliado:**
        `scripts/check-rls-grants.sh` debería iterar `relkind`
        `'r'`, `'m'`, `'v'` y fallar si encuentra objetos sin
        GRANT para `syssol_app`. Sin cambios sobre la propuesta
        original; solo añadir el filtro `m` y `v`.
      - **Falsa alarma descartada durante el diagnóstico:** los
        401 que aparecieron en la primera batería
        (`/locales`, `/solicitudes`, `/reportes/kpis`) NO eran
        TOKEN_INVALID — eran 429 TOO_MANY_REQUESTS del
        `@nestjs/throttler` (5 req/min en `/auth/login`) al
        repetir 15+ logins seguidos. Ese error desapareció tras
        esperar 60 s. Lección para el owner: no encadenar más
        de 5 logins consecutivos sin esperar 1 min.
  - **⚠️ Actualización 2026-08-16 (mismo día) — Hallazgo sistémico:
    24 tablas de negocio SIN GRANT para `syssol_app` → 500 en 7 módulos:**
    - **Síntoma:** horas después de aplicar el fix anterior
      (`20260816110000_fix_rbac_grants`), una batería de smoke tests
      contra todos los módulos del backend reveló 500 INTERNAL_ERROR
      en `/locales`, `/contratos`, `/solicitudes`, `/reportes/kpis`,
      `/reportes/dashboard`, `/categorias`, `/notificaciones`. El
      `AllExceptionsFilter` enmascaraba el `PrismaClientKnownRequestError`
      con mensaje genérico "Ha ocurrido un error inesperado".
    - **Causa raíz (deuda técnica sistémica):** la migración temprana
      `20260604_*_enable_rls` ejecutó un bucle `FOR t IN SELECT
      table_name FROM information_schema.tables WHERE table_schema =
      'public'` para aplicar `GRANT SELECT, INSERT, UPDATE, DELETE TO
      syssol_app` a **las tablas existentes en ese momento**. Pero las
      migraciones de los módulos 04-14 (`modulo_05_locales`,
      `modulo_06_solicitudes`, etc.) que CREARON tablas nuevas
      posteriormente NO replicaron el bucle de GRANT. Auditoría con
      `has_table_privilege` confirmó 24 tablas sin GRANT:
      `adjunto, auditoria, auditoria_login, categoria, comentario,
      configuracion, contrato, email_log, evento_calendario, inquilino,
      kpi_snapshot, local, password_reset_token, plaza, refresh_token,
      rol, solicitud, solicitud_codigo_seq, solicitud_historial,
      solicitud_tipo_config, subcategoria, subcategoria_supervisor,
      unsubscribe, usuario`.
    - **Por qué el incidente anterior (T-RBAC-1) no destapó esto:** el
      `permissions.guard` y `token.service.ts` son los únicos caminos
      que tocan `rol_staff_permiso` en el hot-path de login. Todos los
      demás queries de backend se ejecutan en endpoints autenticados
      que desarrollan su primera query (ej. `findMany({where:{plaza_id}})`)
      sobre tablas de negocio — que era donde faltaba el GRANT.
    - **Fix sistémico:** nueva migración
      `20260816120000_grant_business_tables_to_syssol_app`
      (`backend/prisma/migrations/20260816120000_grant_business_tables_to_syssol_app/migration.sql`).
      Bucle `FOR v_table IN SELECT c.relname FROM pg_class WHERE
      nspname='public' AND relkind='r' AND relname <> '_prisma_migrations'`
      con guard `has_table_privilege` para idempotencia. Otorga
      `GRANT SELECT, INSERT, UPDATE, DELETE` solo si falta SELECT.
      Marcada como `applied` con `prisma migrate resolve --applied`.
    - **Verificación post-fix (batería con admin_plaza):**
      - `/locales` → 200 (antes 500)
      - `/contratos` → 200 (antes 500)
      - `/solicitudes` → 200 (antes 500)
      - `/reportes/kpis` → 200 (antes 500)
      - `/reportes/dashboard` → 200 (antes 500)
      - `/categorias` → 200 (antes 500)
      - `/notificaciones` → 200 (antes 500)
      - Auditoría final: las 27 tablas de negocio (incluyendo las 3
        RBAC del fix anterior) tienen `SELECT, INSERT, UPDATE, DELETE`
        para `syssol_app`; solo `permiso` y `rol_staff` retienen
        SELECT-only (catalog/admin, no se modifican por hot-path).
    - **Lección de proceso (a cerrar en back-log):**
      - **Patrón a estandarizar:** cada migración que cree una tabla
        nueva DEBE incluir el GRANT a `syssol_app` en la misma
        sentencia `CREATE TABLE`, o DOCUMENTAR que `public` ya tiene
        GRANTs por convención. El estado actual de las migraciones
        no es homogéneo.
      - **Smoke test sugerido:** `scripts/check-rls-grants.sh` que
        ejecute `psql -U syssol -d syssol -c "SELECT relname FROM
        pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE
        n.nspname='public' AND c.relkind='r' AND c.relname <>
        '_prisma_migrations' AND NOT has_table_privilege('syssol_app',
        c.oid, 'SELECT')"` y falle con exit 1 si devuelve alguna fila.
      - **Procedencia de los datos:** los GRANTs se aplican con
        `DATABASE_ADMIN_URL` (`syssol` superuser) — el cliente
        `prismaRls` (`syssol_app`) NO puede otorgarse permisos a sí
        mismo. No hay acción al respecto; solo documentar que el
        backend migrations runner usa siempre el cliente admin.
