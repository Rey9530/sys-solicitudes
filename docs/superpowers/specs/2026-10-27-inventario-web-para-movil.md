# Inventario funcional del frontend web de Plazapp → app Flutter

> **Fuente:** lectura del código real de `frontend/src` (Next.js 16, App Router), `backend/src/modules/**` (NestJS) y `packages/contracts/src` (Zod). Rama `fix/auditoria-responsive` (base `a01f9de`) con la auditoría del 2026-10-27; los bugs F1, F5, F6 y F7 de §7 ya están corregidos (ver `docs/08-auditoria-qa-y-mejoras.md`). Fecha: 2026-10-27.
> **Objetivo:** replicar 1:1 el web en una app Flutter que habla **directamente** con el backend (sin el BFF de Next). Cada endpoint citado está respaldado por un controller (Anexo A, con archivo:línea).
> **Convenciones:** rutas de backend relativas a `/api/v1` salvo que se indique. Roles: AP = `admin_plaza`, SA = `superadmin`, IN = `inquilino`, SA* = superadmin con plaza seleccionada (header `x-plaza-id`). ⚠️ = dudoso o inconsistente (ver §7). "Permiso" = código RBAC; varios separados por `|` u "o" = basta uno (OR).

## Índice
0. Convenciones del API
1. Auth y sesión (login, refresh, logout, me, permisos, cambio y reset de contraseña, JWT, impersonación, catálogo de permisos)
2. Navegación por rol (menús, home, shell)
3. Pantallas: índice de las 42 rutas y dónde está su detalle
4. Solicitudes en profundidad
   - 4.1 Modelo de datos y enums
   - 4.2 Creación y edición (wizard, fechas, `camposExtra`, adjuntos)
   - 4.3 Bandeja, detalle y transiciones (matriz por estado y rol, comentarios, historial, PDF, SLA)
5. Módulos
   - 5.1 Locales, inquilinos, contratos, carga inicial Excel
   - 5.2 Usuarios staff, roles, matriz de permisos, categorías, tipos de solicitud, configuración
   - 5.3 Campana de notificaciones in-app
   - 5.4 Log de emails
   - 5.5 Calendario
   - 5.6 Reportes
   - 5.7 Dashboard
   - 5.8 Auditoría
   - 5.9 Superadmin: plazas e impersonación
   - 5.10 Endpoints de los módulos 5.3–5.9
6. Detalles de presentación (badges, fechas 12 h, branding, tokens de tema)
7. Riesgos / cosas raras
- Anexo A. Tabla maestra de los 138 endpoints (roles y permisos)

## 0. Convenciones generales del API (aplican a todo el documento)

| Tema | Detalle (verificado en `backend/src/main.ts`, `app.module.ts`, filtros) |
|---|---|
| Base URL | `{API_URL}/api/v1` (dev `http://localhost:4000/api/v1`). Versionado URI, `defaultVersion: '1'`. Swagger vivo en `{API_URL}/api/docs`. Ping sin auth: `GET /api/ping` (fuera de `/v1`); `GET /api/v1/health` y `/api/v1/health/ready` (sin throttle). |
| Cabeceras de request | `Authorization: Bearer <accessToken>`; `Content-Type: application/json` (NO fijarlo en multipart: dejar que el cliente HTTP ponga el boundary). Solo superadmin: `x-plaza-id: <uuid>` opcional (impersonación, ver §1.10). Recomendado enviar `User-Agent` (se guarda en refresh tokens y `auditoria_login`). |
| Cabeceras de respuesta | `x-request-id` (correlación; aparece también como `requestId` en errores), `Retry-After` en 429 del throttler. |
| Guards globales (orden) | `ThrottlerBehindProxyGuard` → `JwtAuthGuard` → `PlazaScopeGuard` → `RolesGuard` → `PermissionsGuard` (+ `AuditoriaInterceptor` en POST/PATCH/DELETE). |
| Errores (RFC 7807) | `{ type, title, status, detail, instance, code, requestId, meta? }`. El web muestra `body.message ?? body.detail ?? fallback` (el envelope real NO trae `message`; usar `detail`). **`VALIDATION_ERROR` (400, ZodValidationPipe): `detail` es un ARRAY de strings `"campo.ruta: mensaje"` y `meta.issues` trae los issues de Zod** → el parser de Flutter debe aceptar `detail: String | List<String>`. `PERMISSION_DENIED` (403) trae `meta.permisosRequeridos` y `meta.permisosUsuario`. `ACCOUNT_LOCKED` trae `meta.retryAfter` (s). |
| Errores de auth/guards | 401 `TOKEN_EXPIRED` / `TOKEN_INVALID` / `TOKEN_MISSING_SIGNATURE` (JwtAuthGuard); 403 `ROLE_FORBIDDEN` (RolesGuard); 403 `PERMISSION_DENIED` (PermissionsGuard); 403 `PLAZA_SCOPE_VIOLATION` (plazaId en ruta/query ≠ JWT); 400 `PLAZA_ID_INVALIDO` (`x-plaza-id` no es UUID v1-5). |
| Paginación | Query `?page=1&pageSize=20&sort=` (`PaginationSchema`: page ≥1, pageSize 1–100, default 20). Respuesta `{ items, total, page, pageSize, totalPages }`. |
| Booleanos en query | Strings `"true"`/`"false"` (`QueryBooleanSchema`; nunca `1/0`). |
| UUIDs | `UuidSchema` = regex 8-4-4-4-12 hex (acepta UUID nil). Los `:id` de ruta suelen llevar `ParseUUIDPipe` (400 si no es UUID). |
| Fechas | Instantes ISO-8601 UTC (`TIMESTAMPTZ`); fechas civiles `YYYY-MM-DD` y horas `HH:mm` en hora local de plaza. Mostrar siempre en `America/El_Salvador` (ver §6.2). |
| Rate limit | Global **100 req/min por IP** (`req.ip` con `trust proxy` = loopback/linklocal/uniquelocal). Overrides: `POST /auth/login` 5/min, `POST /auth/reset-password` 3/min, `POST /solicitudes/:id/enviar` 10/min. 429 genérico → `code: TOO_MANY_REQUESTS` + header `Retry-After`. |
| CORS | Irrelevante para la app nativa (CORS solo aplica a navegadores). Para referencia: métodos permitidos `GET, POST, PATCH, DELETE, OPTIONS` (sin `PUT`), headers `Content-Type, Authorization, x-plaza-slug, x-request-id, x-plaza-id`. |
| Auditoría | Todo POST/PATCH/DELETE queda en `auditoria` (interceptor) — no requiere nada del cliente. |

---

## 1. Auth y sesión

### 1.1 Cómo lo hace el web (para entender, NO replicar)
El web usa Auth.js (Credentials provider) que llama al backend desde el servidor Next; guarda `accessToken`/`refreshToken` dentro de la cookie cifrada de Auth.js (nunca en JS del cliente). `lib/api.ts#apiFetch` antepone `/api/v1`, inyecta `Bearer`, añade `x-plaza-id` si el rol es superadmin, y ante un 401 refresca una vez y reintenta (sin re-persistir el token rotado: limitación conocida). El callback `jwt` de Auth.js refresca proactivamente cuando quedan < 60 s de vida del access. **La app Flutter habla directo al backend**: debe guardar los tokens en almacenamiento seguro (Keychain/Keystore) y replicar refresh + reintento.

### 1.2 Login — `POST /api/v1/auth/login` (`@Public`, throttle 5/min/IP)
- **Body** (`LoginSchema`): `{ "email": string, "password": string }` — `email` = `EmailSchema` (trim, lowercase, 1–254, formato email); `password` min 1 (sin validar política).
- **200** (`TokenResponseSchema`):
```json
{
  "accessToken": "<JWT HS256>",
  "refreshToken": "<uuid v4 opaco>",
  "expiresIn": 3600,
  "user": {
    "id": "uuid", "email": "a@b.com", "nombre": "Nombre",
    "rol": "superadmin | admin_plaza | inquilino",
    "plazaId": "uuid | null", "rolStaffId": "uuid | null", "inquilinoId": "uuid | null",
    "permisos": ["solicitudes.aprobar", "..."]   // ['*'] superadmin, [] inquilino
  }
}
```
- **Errores**: 401 `INVALID_CREDENTIALS` ("Email o contraseña incorrectos."); 429 `ACCOUNT_LOCKED` con `meta.retryAfter` (lockout: **10 fallos por email O por IP en 15 min**; los intentos durante el bloqueo no lo extienden); 429 `TOO_MANY_REQUESTS` del throttler (6.º intento en 1 min); 400 `VALIDATION_ERROR`.
- **UI web** (`/login`, `components/client/login-form.tsx`): campos Email (placeholder `tucorreo@plazapp.com`) y Contraseña; botón "Iniciar sesión" ("Iniciando…"); link "¿Olvidaste tu contraseña?" → `/reset-password`. Toasts: éxito "Sesión iniciada"; 429 (cualquiera) → "Cuenta bloqueada temporalmente por varios intentos fallidos. Intenta más tarde."; otro error → "Email o contraseña incorrectos" / "No se pudo iniciar sesión. Intenta de nuevo.". Query `?expired=1` → toast "Tu sesión expiró. Vuelve a iniciar sesión."; `?password_changed=1` → "Contraseña actualizada. Inicia sesión con tu nueva contraseña.". Tras login redirige a la home del rol (§2.2). Título del layout: "Inicia sesión" / "Accede a la consola de tu plaza.".
- El login no comprueba un flag `activo`: un usuario deshabilitado no entra porque el backend busca `deleted_at: null` (ver deshabilitar en §5).

### 1.3 Refresh — `POST /api/v1/auth/refresh` (`@Public`)
- **Body** (`RefreshSchema`): `{ "refreshToken": string }` → **200** misma forma que login (nuevo par + `user` + `permisos`).
- **Rotación**: el refresh usado se revoca y se emite uno nuevo. **Detección de reuso**: presentar un refresh ya revocado → se revocan TODOS los refresh del usuario → 401 `REFRESH_INVALID`. Expirado → 401 `REFRESH_EXPIRED`. Usuario borrado → 401 `REFRESH_INVALID`.
- **TTLs reales** (`backend/.env*`, T-V13): access **1 h** (`JWT_ACCESS_TTL=3600s`), refresh **14 días** (`JWT_REFRESH_TTL=14d`), token de reset **30 min**. (CLAUDE.md aún dice 15 min / 7 d: está desactualizado.)
- **Recomendación Flutter**: refresco *single-flight* (un solo refresh en vuelo; las demás peticiones esperan), proactivo cuando falten < 60 s (como el web) y reactivo ante 401 `TOKEN_EXPIRED` (reintentar una vez). Por la detección de reuso, dos refresh concurrentes con el mismo token cierran todas las sesiones del usuario. Persistir el par nuevo atómicamente.

### 1.4 Logout — `POST /api/v1/auth/logout` (requiere Bearer)
- **Body**: `{ "refreshToken": string }` → **204**. Revoca ese refresh. El web además borra la cookie `sa_plaza` (plaza impersonada) y redirige a `/login`. Si falla la revocación remota, igual cierra local.

### 1.5 Perfil — `GET /api/v1/auth/me`
- **200**: `{ id, email, nombre, telefono|null, rol, rolStaffId|null, inquilinoId|null, plazaId|null, lastLoginAt|null, createdAt }`. 404 `USER_NOT_FOUND` si el usuario ya no existe o su `plaza_id` cambió respecto al JWT. **El web no lo usa** (toma nombre/rol del login); útil para la app al reanudar sesión.

### 1.6 Permisos efectivos — `GET /api/v1/auth/me/permisos`
- **200**: `{ "permisos": string[] }`. Siempre leído fresco de BD (no del JWT): superadmin `['*']`; inquilino `[]`; admin_plaza **sin** `rolStaffId` (legacy) → todos los códigos del catálogo; admin_plaza con `rolStaffId` → los permisos asignados a su rol staff.
- El web lo llama en cada render de layout (cacheado por request) y lo distribuye por `PermisosProvider` → `<Can permiso="…">` (oculta botones) y `assertCan()` en server actions (lanza "Permiso denegado: requiere X o Y"). Reglas de `can()`: wildcard `*` pasa todo; lista = **OR**; lista vacía = denegado. **Flutter**: pedirlo tras login/refresh y al volver a primer plano; el backend re-valida siempre (`PermissionsGuard`).
- Regla backend: si el endpoint lleva `@Roles(... 'inquilino' ...)`, el inquilino pasa el `PermissionsGuard` aunque tenga `[]` (el gating fino solo aplica a admin_plaza en v1).

### 1.7 Cambio de contraseña — `PATCH /api/v1/auth/change-password` (Bearer)
- **Body** (`ChangePasswordSchema`): `{ currentPassword: string(min 1), newPassword: PasswordSchema }` → **204**. El backend **revoca todos los refresh tokens** del usuario → el cliente debe cerrar sesión (el web hace logout y va a `/login?password_changed=1`).
- **Form** (`ChangePasswordFormSchema`): añade `confirmPassword` (= `newPassword`, "Las contraseñas no coinciden") y `newPassword ≠ currentPassword` ("La nueva contraseña debe ser distinta de la actual").
- **`PasswordSchema`**: 8–128 caracteres, al menos una minúscula, una mayúscula y un dígito ("La contraseña debe incluir mayúscula, minúscula y dígito").
- **Errores**: 400 `INVALID_CURRENT_PASSWORD` (marca el campo actual), 400 `SAME_PASSWORD` (marca la nueva), 404 `USER_NOT_FOUND`, 400 `VALIDATION_ERROR`.
- **UI**: diálogo "Cambiar contraseña" abierto desde el pie de la sidebar (icono lucide `KeyRound`); 3 campos con ojo mostrar/ocultar (`Eye`/`EyeOff`): "Contraseña actual", "Nueva contraseña", "Confirmar nueva contraseña"; botón "Cambiar contraseña" ("Guardando…").

### 1.8 Reset de contraseña

| Paso | Endpoint | Body | Respuesta / errores |
|---|---|---|---|
| Solicitar | `POST /api/v1/auth/reset-password` (`@Public`, throttle **3/min**) | `ResetPasswordRequestSchema` `{ email }` | **200** siempre `{ message: "Si el email existe, recibirás un enlace para restablecer la contraseña." }` (no revela existencia). Envía email con link **`{FRONTEND_URL}/reset-password/{token}`** (URL del web). |
| Confirmar | `POST /api/v1/auth/reset-password/confirm` (`@Public`) | `ResetPasswordConfirmSchema` `{ token, newPassword: PasswordSchema }` | **200** `{ message: "Contraseña actualizada. Ya puedes iniciar sesión." }`; 400 `RESET_TOKEN_INVALID` (inexistente, usado o expirado). Marca el token usado y revoca todos los refresh. |
- **UI web**: `/reset-password` ("Restablecer contraseña" / "Te enviaremos un enlace para crear una nueva.") → tras enviar muestra banner verde "Si el email existe, recibirás un enlace para restablecer tu contraseña. Expira en 30 minutos." + "Volver a iniciar sesión". `/reset-password/[token]` ("Elige una nueva contraseña" / "Debe tener al menos 8 caracteres.") con Nueva + Confirmar (deben coincidir); éxito → toast "Contraseña actualizada" y `/login`; token inválido → banner rojo "El enlace es inválido o ha expirado." + link "Solicitar un enlace nuevo".
- **Flutter**: el email apunta al web; para hacerlo en la app hace falta deep link/universal link sobre `/reset-password/{token}` (⚠️ decisión de producto) o dejar que se complete en el navegador.

### 1.9 Claims del JWT de acceso (HS256, `backend/src/modules/auth/types/jwt-payload.ts`)
`{ sub (usuario.id), email, rol, plazaId|null, rolStaffId|null, inquilinoId|null, iat, exp }`. **No** incluye `permisos` (se eliminó para no inflar la cookie del web) → usar §1.6. `plazaId` es null solo para superadmin. Un usuario = una plaza y un rol (S-MT-C). El `plaza_id` NUNCA se manda en el body como autoridad.

### 1.10 Superadmin: plaza seleccionada (impersonación)
- **Web**: cookie httpOnly `sa_plaza` = UUID de la plaza elegida (`lib/selected-plaza.ts`); `apiFetch` la reenvía como header **`x-plaza-id`** solo si `rol === 'superadmin'`. `PlazaScopeGuard` la acepta solo para superadmin (para otros roles se ignora), fija `user.plazaId` y marca `actingAsPlaza` (auditoría); los services y RLS scopean a esa plaza.
- **Selector** (`components/shell/plaza-selector.tsx`, topbar): lista `GET /api/v1/plazas?page=1&pageSize=100` (`id, nombreComercial, slug, colorPrimario`). Opciones: "Todas las plazas" (icono `Globe`, "Vista global de la plataforma") + cada plaza con punto de su color y slug; buscador si hay > 7 plazas ("Buscar plaza…", vacío: "Sin plazas que coincidan."). Elegir plaza → navega a `/admin/dashboard`; elegir "Todas" → `/superadmin/dashboard`. Logout borra la selección.
- **Gate**: si el superadmin entra a cualquier `/admin/*` sin plaza seleccionada ve la tarjeta "Selecciona una plaza para operar — Usa el selector de plaza en la barra superior para elegir sobre qué plaza quieres ver y operar (Solicitudes, Locales, Contratos, etc.)." (icono `Building2`).
- **Flutter**: guardar la plaza elegida localmente y añadir `x-plaza-id` a TODAS las peticiones mientras haya selección; sin selección, las pantallas plaza-scoped deben mostrar el gate. El superadmin no tiene campana de notificaciones (ni al impersonar).

### 1.11 Catálogo completo de permisos (`backend/prisma/seed-data/permisos.ts`, 90 códigos)
Formato `<modulo>.<accion>` (OR entre los requeridos). El rol staff de sistema "admin" (`es_sistema`) recibe todos.

| Módulo (UI) | Códigos |
|---|---|
| permisos | `permisos.ver_matriz`, `permisos.asignar_a_roles` |
| usuarios-plaza | `usuarios_plaza.listar`, `.crear`, `.editar`, `.deshabilitar`, `.reactivar`, `.resetear_clave`; `roles_staff.listar`, `.crear`, `.editar`, `.deshabilitar`, `.gestionar_permisos` |
| solicitudes | `solicitudes.bandeja.ver`, `solicitudes.bandeja.asignadas_a_mi`, `solicitudes.detalle.ver`, `solicitudes.tomar`, `.liberar`, `.aprobar`, `.cerrar`, `.rechazar`, `.pedir_subsanacion`, `.reasignar`, `.cambiar_prioridad`, `.cancelar`, `.pausar`, `.reanudar`, `.comentar`, `solicitudes.adjuntos.subir`, `solicitudes.adjuntos.descargar`, `solicitudes.adjuntos.eliminar` |
| locales | `locales.listar`, `.crear`, `.editar`, `.deshabilitar`, `.fuera_de_servicio`, `locales.adjuntos.subir`, `.adjuntos.descargar`, `.adjuntos.eliminar` |
| inquilinos | `inquilinos.listar`, `.crear`, `.editar`, `.deshabilitar`, `.alta_usuario`, `.resetear_clave`, `.deshabilitar_usuario`, `.reactivar_usuario` |
| contratos | `contratos.listar`, `.crear`, `.editar`, `.cerrar`, `.renovar`, `.importar`, `contratos.adjuntos.subir`, `.adjuntos.descargar`, `.adjuntos.eliminar` |
| categorias | `categorias.listar`, `.crear`, `.editar`, `.deshabilitar`; `subcategorias.crear`, `.editar`, `.deshabilitar`, `.asignar_responsable`, `.gestionar_supervisores` |
| tipos-solicitud | `tipos_solicitud.listar`, `tipos_solicitud.editar` |
| reportes | `reportes.dashboard.ver`, `reportes.kpis.ver`, `reportes.preview`, `reportes.exportar_csv`, `reportes.exportar_xlsx`, `reportes.exportar_pdf`, `reportes.ficha_local_pdf`, `reportes.ficha_inquilino_pdf` |
| auditoria | `auditoria.ver` |
| notificaciones | `notificaciones.ver_log`, `.reintentar`, `.ver_preview`, `.gestionar_desuscripciones` |
| configuracion | `configuracion.ver`, `.editar_general`, `.editar_branding`, `.editar_sla`, `.editar_adjuntos`, `.editar_calendario` |
| calendario | `calendario.ver`, `calendario.exportar_ics`, `calendario.choques.ver`, `calendario.mover_evento` |

(Los `.x` abreviados repiten el prefijo de la fila: p. ej. `usuarios_plaza.crear`, `locales.adjuntos.subir`.)

---

## 2. Navegación por rol

### 2.1 Menú (`components/shell/nav-config.ts`; iconos = lucide-react)
Un ítem con permiso se oculta si `can(permisos, permiso)` es falso; un grupo sin ítems visibles desaparece. Ítem activo si `pathname == href` o empieza por `href/`.

**admin_plaza** (cabecera sidebar: "Plazapp" + nombre de la plaza; pie: "Admin de plaza")

| Grupo | Etiqueta | Icono | Ruta | Permiso requerido |
|---|---|---|---|---|
| — | Dashboard | `LayoutDashboard` | `/admin/dashboard` | — (siempre) |
| Operación | Solicitudes | `Inbox` | `/admin/solicitudes` | `solicitudes.bandeja.ver` |
| Operación | Calendario | `CalendarDays` | `/admin/calendario` | `calendario.ver` |
| Catálogo | Locales | `Store` | `/admin/locales` | `locales.listar` |
| Catálogo | Inquilinos | `UsersRound` | `/admin/inquilinos` | `inquilinos.listar` |
| Catálogo | Contratos | `FileText` | `/admin/contratos` | `contratos.listar` |
| Catálogo | Categorías | `Tags` | `/admin/categorias` | `categorias.listar` |
| Catálogo | Tipos de solicitud | `Shapes` | `/admin/catalogos/tipos-solicitud` | `tipos_solicitud.listar` |
| Plataforma | Usuarios \| Roles | `UserCog` | `/admin/usuarios-plaza` | `usuarios_plaza.listar` |
| Plataforma | Reportes | `BarChart3` | `/admin/reportes` | `reportes.dashboard.ver` |
| Plataforma | Auditoría | `ScrollText` | `/admin/auditoria` | `auditoria.ver` |
| Plataforma | Notificaciones | `Bell` | `/admin/notificaciones` | `notificaciones.ver_log` |
| Plataforma | Configuración | `Settings` | `/admin/configuracion` | `configuracion.ver` |

**superadmin** (cabecera: "Consola de plataforma"; pie: "Superadmin"; sin permisos por ítem: tiene `*`)

| Grupo | Etiqueta | Icono | Ruta |
|---|---|---|---|
| — | Dashboard global | `LayoutDashboard` | `/superadmin/dashboard` |
| Plataforma | Plazas | `Building2` | `/superadmin/plazas` |
| Operación global | Solicitudes globales | `Globe` | `/superadmin/solicitudes` |
| Operación | Solicitudes · Calendario | `Inbox` · `CalendarDays` | `/admin/solicitudes` · `/admin/calendario` |
| Catálogo | Locales · Inquilinos · Contratos · Categorías · Tipos de solicitud | `Store` · `UsersRound` · `FileText` · `Tags` · `Shapes` | `/admin/locales` · `/admin/inquilinos` · `/admin/contratos` · `/admin/categorias` · `/admin/catalogos/tipos-solicitud` |
| Gestión | Usuarios \| Roles · Reportes · Auditoría · Notificaciones · Configuración | `UserCog` · `BarChart3` · `ScrollText` · `Bell` · `Settings` | `/admin/usuarios-plaza` · `/admin/reportes` · `/admin/auditoria` · `/admin/notificaciones` · `/admin/configuracion` |

(Los grupos "Operación", "Catálogo" y "Gestión" del superadmin son plaza-scoped: requieren plaza seleccionada, §1.10.)

**inquilino** (cabecera: "Portal de inquilino"; pie: "Inquilino")

| Grupo | Etiqueta | Icono | Ruta |
|---|---|---|---|
| Portal | Mis solicitudes | `Inbox` | `/inquilino/solicitudes` |
| Portal | Calendario | `CalendarDays` | `/inquilino/calendario` |

⚠️ Existen `/inquilino/contratos` y `/inquilino/contratos/[id]` ("Mis contratos") pero **no están en el menú ni enlazadas** desde ninguna pantalla (ruta huérfana; decidir si la app la expone).

### 2.2 Home por rol (`lib/home-redirect.ts`)
`superadmin` → `/superadmin/plazas` · `admin_plaza` → `/admin/dashboard` · `inquilino` → `/inquilino/solicitudes` · otro → `/login`. (Ojo: el selector de plaza del superadmin, al limpiar la selección, lleva a `/superadmin/dashboard`, no a la home.)

### 2.3 Shell (sidebar + topbar)
- **Sidebar** navy permanente: logo "P" + "Plazapp" + subtítulo; grupos con etiqueta en mayúsculas; pie con avatar de iniciales (1–2 letras: primera letra del primer y último nombre), nombre, etiqueta de rol, botón cambiar contraseña (`KeyRound`) y cerrar sesión (`LogOut`). Colapsable en escritorio (persistido en `localStorage['sidebar-collapsed']`); drawer en móvil (≤ 920 px).
- **Topbar**: botón `PanelLeft` (colapsa/abre drawer); buscador "Buscar…" con `⌘K` (**decorativo, sin funcionalidad**); a la derecha: superadmin → selector de plaza; admin/inquilino → chip con punto de color y nombre de la plaza ("Mi plaza" si no hay); toggle de tema (`Moon`/`Sun`); campana (solo admin_plaza e inquilino); avatar con iniciales.
- **Inquilino**: el shell recibe `plaza = null` → chip "Mi plaza" y color por defecto (el inquilino no tiene endpoint para leer el branding de su plaza: `GET /plazas/:id` es solo superadmin/admin_plaza).
- Toasts efímeros con `sonner`; confirmaciones con SweetAlert2 (`confirmAction`: icono `warning` para destructivas con foco en "Cancelar", `question` para neutras; botón afirmativo específico "Sí, deshabilitar", "Sí, eliminar"…). En Flutter: SnackBar + AlertDialog equivalentes.
- **Listados**: `ResponsiveDataView` muestra tabla si cabe; en teléfono, **tarjetas** con la columna `primary` como título y el resto como pares etiqueta/valor (`cardLabel`) y acciones al pie. Es el patrón natural para la app.

## 3. Pantallas: índice de las 42 rutas `page.tsx`

Las páginas **no** comprueban permisos por sí mismas (salvo la matriz de permisos): el permiso de la columna es el del ítem de menú y/o el que exige el endpoint principal. Si el backend responde 403, el web muestra la lista vacía, un banner o un 404. El detalle de cada pantalla (datos, filtros, columnas, acciones, validaciones, vacíos) está en la sección indicada. "SA*" = superadmin con plaza seleccionada (header `x-plaza-id`).

| # | Ruta web | Rol | Permiso (menú / endpoint) | Endpoints principales (`/api/v1`) | Detalle |
|---|---|---|---|---|---|
| 1 | `/` | todos | — | — (redirige a la home del rol) | §2.2 |
| 2 | `/login` | público | — | `POST /auth/login` | §1.2 |
| 3 | `/reset-password` | público | — | `POST /auth/reset-password` | §1.8 |
| 4 | `/reset-password/[token]` | público | — | `POST /auth/reset-password/confirm` | §1.8 |
| 5 | `/superadmin/dashboard` | SA | — (`*`) | `GET /reportes/kpis`, `GET /reportes/dashboard` (sin `x-plaza-id`) | §5.7 |
| 6 | `/superadmin/plazas` | SA | — | `GET/POST /plazas`, `DELETE /plazas/:id` | §5.9 |
| 7 | `/superadmin/solicitudes` | SA | — | `GET /admin/solicitudes`, `GET /admin/solicitudes/export.csv`, `GET /plazas` | §4.3.1.5 |
| 8 | `/superadmin/solicitudes/[id]` | SA | — | `GET /admin/solicitudes/:id` | §4.3.1.6 |
| 9 | `/admin/dashboard` | AP, SA* | menú: ninguno · BE: `reportes.kpis.ver` + `reportes.dashboard.ver` | `GET /reportes/kpis`, `GET /reportes/dashboard` | §5.7 |
| 10 | `/admin/solicitudes` | AP, SA* | `solicitudes.bandeja.ver` (BE: o `…asignadas_a_mi`) | `GET /solicitudes/bandeja` | §4.3.1.1 |
| 11 | `/admin/solicitudes/[id]` | AP, SA* | `solicitudes.detalle.ver` + uno por acción | `GET /solicitudes/:id`, `GET /usuarios?rol=admin_plaza`, transiciones | §4.3.1.2, §4.3.2 |
| 12 | `/admin/calendario` | AP (SA* → 403) | `calendario.ver` | `GET /calendario`, `GET /locales`, `GET /inquilinos`, `GET /configuracion`, `PATCH /calendario/eventos/:id/fechas`, `GET /calendario/export.ics` | §5.5 |
| 13 | `/admin/locales` | AP, SA* | `locales.listar` | `GET /locales`, `DELETE /locales/:id` | §5.1.2.1 |
| 14 | `/admin/locales/nuevo` | AP, SA* | `locales.crear` | `POST /locales` | §5.1.2.2 |
| 15 | `/admin/locales/[id]` | AP, SA* | `locales.listar` / `.editar` / `.adjuntos.*` | `GET/PATCH /locales/:id`, `GET/POST /locales/:id/adjuntos` | §5.1.2.3 |
| 16 | `/admin/inquilinos` | AP, SA* | `inquilinos.listar` | `GET /inquilinos`, `DELETE /inquilinos/:id` | §5.1.2.4 |
| 17 | `/admin/inquilinos/nuevo` | AP, SA* | `inquilinos.crear` | `POST /inquilinos` | §5.1.2.5 |
| 18 | `/admin/inquilinos/[id]` | AP, SA* | `inquilinos.listar` / `.editar` / usuarios | `GET/PATCH /inquilinos/:id`, `GET /inquilinos/:id/usuarios`, `/usuarios/*` | §5.1.2.6, §5.1.4 |
| 19 | `/admin/contratos` | AP, SA* | `contratos.listar` | `GET /contratos`, `GET /locales`, `GET /inquilinos` | §5.1.2.7 |
| 20 | `/admin/contratos/nuevo` | AP, SA* | `contratos.crear` | `POST /contratos` | §5.1.2.8 |
| 21 | `/admin/contratos/[id]` | AP, SA* | `contratos.listar` / `.cerrar` / `.renovar` / `.adjuntos.*` | `GET /contratos/:id`, `POST …/cerrar`, `POST …/renovar`, `GET/POST …/adjuntos` | §5.1.2.9, §5.1.3 |
| 22 | `/admin/contratos/importar` | AP, SA* | `contratos.importar` | `POST /importacion/carga-inicial/{analizar,ejecutar}` | §5.1.5 |
| 23 | `/admin/categorias` | AP, SA* | `categorias.listar` | `GET /categorias`, `DELETE /categorias/:id` | §5.2.1.4 |
| 24 | `/admin/categorias/nueva` | AP, SA* | `categorias.crear` | `POST /categorias` | §5.2.1.5 |
| 25 | `/admin/categorias/[id]` | AP, SA* | `categorias.listar` / `.editar` | `GET/PATCH /categorias/:id` | §5.2.1.6 |
| 26 | `/admin/categorias/[id]/subcategorias` | AP, SA* | `categorias.listar` + `subcategorias.*` | `/categorias/:id/subcategorias/*`, `GET /usuarios?rol=admin_plaza` | §5.2.1.7 |
| 27 | `/admin/catalogos/tipos-solicitud` | AP, SA* | `tipos_solicitud.listar` | `GET /admin/tipos-solicitud` | §5.2.1.8 |
| 28 | `/admin/catalogos/tipos-solicitud/[id]` | AP, SA* | `tipos_solicitud.editar` | `GET/PATCH /admin/tipos-solicitud/:id` | §5.2.1.9 |
| 29 | `/admin/usuarios-plaza` (tabs usuarios / roles / permisos) | AP, SA* | `usuarios_plaza.listar` (+ `roles_staff.*`) | `/usuarios/*`, `/roles-staff/*`, `GET /permisos` | §5.2.1.1 |
| 30 | `/admin/usuarios-plaza/[id]` ⚠️ huérfana | AP, SA* | `usuarios_plaza.listar` | `GET /usuarios/:id`, `GET /roles-staff` | §5.2.1.2 |
| 31 | `/admin/usuarios-plaza/permisos` | AP, SA* | página: `permisos.ver_matriz` o `roles_staff.gestionar_permisos` | `GET /permisos`, `GET/PUT /permisos/roles/:id` | §5.2.1.3 |
| 32 | `/admin/reportes` | AP, SA* | menú `reportes.dashboard.ver`; `reportes.preview` / `.exportar_*` | `GET /reportes/:entidad/preview`, `GET /reportes/:entidad/export.{csv,xlsx,pdf}` | §5.6 |
| 33 | `/admin/auditoria` | AP, SA* | `auditoria.ver` | `GET /auditoria` | §5.8 |
| 34 | `/admin/notificaciones` | AP, SA* | `notificaciones.ver_log` (+ `ver_preview`, `reintentar`, `gestionar_desuscripciones`) | `GET /notificaciones`, `…/:id/preview`, `…/:id/reintentar`, `/notificaciones/unsubscribes*` | §5.4 |
| 35 | `/admin/configuracion` | AP (SA* → no funciona) | `configuracion.ver` + `configuracion.editar_*` | `GET/PATCH /configuracion`, `GET/PATCH /plazas/:id`, `POST /plazas/:id/logo` | §5.2.1.10 |
| 36 | `/inquilino/solicitudes` | IN | — | `GET /solicitudes` | §4.3.1.3 |
| 37 | `/inquilino/solicitudes/nueva` | IN | — | `GET /categorias(+/:id)`, `GET /contratos?estado=vigente`, `GET /solicitudes/tipos`, `GET /solicitudes/duplicados`, `POST /solicitudes`, `POST …/adjuntos`, `POST …/enviar` | §4.2 |
| 38 | `/inquilino/solicitudes/[id]` | IN | — | `GET /solicitudes/:id` + acciones del inquilino | §4.3.1.4 |
| 39 | `/inquilino/solicitudes/[id]/editar` | IN | — | `GET/PATCH /solicitudes/:id` | §4.2.1 |
| 40 | `/inquilino/calendario` | IN | — | `GET /calendario`, `GET /contratos?estado=vigente`, `GET /calendario/export.ics` | §5.5 |
| 41 | `/inquilino/contratos` ⚠️ sin menú | IN | — | `GET /contratos?page=1&pageSize=50` | §5.1.2.11 |
| 42 | `/inquilino/contratos/[id]` | IN | — | `GET /contratos/:id`, `GET/POST /contratos/:id/adjuntos` | §5.1.2.12 |

**Elementos que no son rutas pero sí "pantallas" en la app:** campana de notificaciones (popover del topbar, §5.3), selector de plaza del superadmin (§1.10), diálogo "Cambiar contraseña" (§1.7).

**Route handlers del web (BFF; la app llama directamente al endpoint del backend):**

| Route handler web | Endpoint backend real | Respuesta |
|---|---|---|
| `GET /api/solicitudes/[id]/permiso-pdf` | `GET /reportes/solicitudes/:id/permiso.pdf` | `application/pdf`, `attachment; filename="permiso-{codigo}.pdf"` |
| `GET /api/calendario/export.ics?localId=` | `GET /calendario/export.ics?localId=` | `text/calendar`, `attachment; filename="plazapp-{slug}.ics"` |
| `GET /api/reportes/export?entidad=&formato=&…` | `GET /reportes/{entidad}/export.{csv\|xlsx\|pdf}?…` | binario con `Content-Disposition` |
| `/api/auth/[...nextauth]` | `POST /auth/login`, `POST /auth/refresh` (vía Auth.js) | — |

## 4. Solicitudes en profundidad

### 4.1 Modelo de datos de solicitudes (contracts `packages/contracts/src/solicitudes/index.ts`)

**Enums**

| Enum | Valores |
|---|---|
| `SolicitudEstadoSchema` | `borrador`, `enviada`, `asignado`, `en_revision`, `aprobada`, `cerrada`, `rechazada`, `cancelada`, `requerida_subsanacion`, `pausada` |
| `SOLICITUD_ESTADOS_TERMINALES` | `cerrada`, `rechazada`, `cancelada` (⚠️ `aprobada` NO es terminal: queda "pendiente de cierre") |
| `SolicitudTipoSchema` | `mantenimiento`, `evento`, `remodelacion`, `otro` |
| `SolicitudPrioridadSchema` (en `categorias/index.ts`) | `A`, `B`, `C`, `D`, `F` (no existe `E`, aunque el CSS define `.prio-E`) |
| `SolicitudResultadoCierreSchema` | `exitoso`, `parcial`, `fallido`, `no_realizado` |
| `SlaStatusSchema` | `verde` \| `amarillo` \| `rojo` \| `null` |
| `ComentarioTipoSchema` | `decision`, `subsanacion`, `general` |
| `SolicitudHistorialEventoSchema` | `creada`, `enviada`, `asignada`, `tomada`, `aprobada`, `cerrada`, `rechazada`, `subsanada`, `reasignada`, `cancelada`, `comentario`, `adjunto_agregado`, `prioridad_cambiada`, `pausada`, `reanudada` |

**`SolicitudOutput`** (respuesta de TODAS las transiciones): `id, plazaId, localId, inquilinoId, usuarioCreadorId, adminAsignadoId|null, categoriaId|null, subcategoriaId|null, codigo ("SOL-…"), tipo, prioridad, titulo, descripcion, estado, camposExtra (objeto libre), fechaEventoInicio|null ("YYYY-MM-DD"), fechaEventoFin|null, horaInicio|null ("HH:MM" 24 h), horaFin|null, empresaNombre, empresaResponsable, empresaTelefono, empresaEmail, emergenciaContacto, emergenciaTelefono, esEmergencia, enviadaAt|null, asignadaAt|null, decisionAt|null, resultadoCierre|null, cierreComentario|null, cerradaAt|null, createdAt, updatedAt` (timestamps ISO-8601 UTC).

**`SolicitudListItem`** = `SolicitudOutput` + `localCodigo|null, categoriaNombre|null, subcategoriaNombre|null, adminAsignado {id,nombre,email}|null, slaStatus`.

**`SolicitudDetailOutput`** = `SolicitudListItem` + `inquilinoRazonSocial|null, usuarioCreador {id,nombre,email}|null, adjuntos: AdjuntoOutput[]` (orden `created_at DESC`), `comentarios: ComentarioOutput[]` (ASC), `historial: SolicitudHistorialOutput[]` (ASC).
- `AdjuntoOutput`: `id, plazaId, entidadTipo, entidadId, nombreOriginal, mimeType, tamanoBytes, usuarioSubioId, createdAt`.
- `ComentarioOutput`: `id, solicitudId, usuario {id,nombre,email}|null, tipo, cuerpo, createdAt`.
- `SolicitudHistorialOutput`: `id, solicitudId, usuario|null (null = sistema/cron), evento, estadoAnterior|null, estadoNuevo|null, comentario|null, createdAt`.

**Paginado**: `{ items, total, page, pageSize, totalPages }`. Paginación `page` (≥1, default 1), `pageSize` (1–100, default 20).

### 4.2 Creación y edición de solicitudes (inquilino), adjuntos y catálogo de tipos

> Alcance: `/inquilino/solicitudes/nueva`, `/inquilino/solicitudes/[id]/editar`, todas las server actions de `app/(inquilino)/inquilino/solicitudes/actions.ts`, `solicitud-wizard.tsx`, `adjunto-uploader.tsx`, `lib/solicitud-fechas.ts`, `lib/solicitudes-data.ts`. Cada endpoint está verificado contra su controller (archivo:línea). Rutas relativas a `/api/v1`.
>
> Para el inquilino, el `PermissionsGuard` **no aplica permisos granulares**: cualquier endpoint cuyo `@Roles` incluya `inquilino` le pasa, aunque declare `@RequirePermission` (ver `permissions.guard.ts`, regla 5a). Los permisos de la tabla solo afectan a `admin_plaza` con `rolStaffId`.

---

#### 4.2.1 Pantallas

##### `/inquilino/solicitudes/nueva`: Nueva solicitud

- **Rol:** `inquilino` (el layout redirige a cualquier otro rol). Sin permiso granular.
- **Propósito:** wizard de 3 pasos que crea una solicitud en `borrador` y opcionalmente la envía.
- **Cabecera:** título "Nueva solicitud", subtítulo "Se guarda como borrador hasta que la envíes; al enviarla entra a la cola de asignación.", breadcrumb `Mis solicitudes › Nueva`.
- **Prefill por query (desde el calendario, T-132):** `?tipo=<mantenimiento|evento|remodelacion|otro>&fecha=YYYY-MM-DD&hora=HH:MM&localId=<uuid>`. Cada valor se valida (enum, regex de fecha `^\d{4}-\d{2}-\d{2}$`, hora `^([01]\d|2[0-3]):[0-5]\d$`, `localId` debe estar entre los locales del inquilino). `fecha` rellena **fecha inicio y fecha fin**; `hora` rellena solo la hora de inicio. Un `tipo` desactivado en la plaza se ignora.

**Datos que carga (en paralelo):**

| Dato | Endpoint backend | Params | Respuesta usada |
|---|---|---|---|
| Categorías + subcategorías activas | `GET /categorias` (categorias.controller.ts:62) y luego **N×** `GET /categorias/:id` (:73) | `page=1&pageSize=100` | Lista: `{items: CategoriaOutput[], total, page, pageSize, totalPages}`. Detalle: `CategoriaDetailOutput` = categoría + `subcategorias[]` (solo activas, ordenadas por nombre) con `{id, nombre, prioridad, responsable{id,nombre,email}, supervisores[]…}`. Para el inquilino el backend fuerza `activo=true`. El wizard solo usa `{id, nombre, subcategorias[{id,nombre,prioridad}]}`. |
| Locales del inquilino | `GET /contratos` (contratos.controller.ts:87) | `estado=vigente&page=1&pageSize=100` | Paginado de `ContratoListItem`. El backend fuerza `inquilino_id` del JWT. El front deduplica por `localId` y usa `{id: localId, codigo: localCodigo ?? localId}`. |
| Tipos activos de la plaza | `GET /solicitudes/tipos` (tipos-solicitud.controller.ts:36) | ninguno | **Array** (no paginado) de `SolicitudTipoConfigOutput {id, plazaId, codigo, etiqueta, descripcion, activo, orden, createdAt, updatedAt}`, filtrado a `activo=true` y ordenado `orden ASC, codigo ASC`. El wizard usa `{codigo, etiqueta}`. |

Si alguna carga falla, el front devuelve `[]` sin avisar. No hay estado vacío explícito: si el inquilino no tiene contratos vigentes, el select de Local solo muestra "Selecciona…" y el paso 2 no se puede completar.

##### `/inquilino/solicitudes/[id]/editar`: Editar solicitud

- **Rol:** `inquilino`.
- **Carga:** `GET /solicitudes/:id` (solicitudes.controller.ts:102) → `SolicitudDetailOutput`. Si no es `ok` → 404. **Si `estado` ∉ {`borrador`, `requerida_subsanacion`} → redirect** a `/inquilino/solicitudes/:id`. Además carga categorías, locales y tipos igual que en "nueva".
- **Cabecera:** "Editar {codigo}", subtítulo "El cambio de local solo está permitido en borrador y requerida_subsanacion (S-FS-F).", breadcrumb `Mis solicitudes › {codigo} › Editar`.
- **Diferencias con "nueva":** el wizard se precarga con la solicitud. El paso 3 **no muestra adjuntos** (se gestionan en el detalle). Solo hay un botón, **"Guardar cambios"** (PATCH, sin enviar). Al guardar navega al detalle. El reenvío tras subsanación se hace desde el detalle (`POST :id/subsanar`), no desde aquí.

---

#### 4.2.2 Wizard (`solicitud-wizard.tsx`) en profundidad

##### Pasos (stepper)
1. **"Tipo y categoría"**
2. **"Detalles"**
3. **"Adjuntos y revisión"**

Botones: "Atrás" (deshabilitado en el paso 1) y "Siguiente", que valida el paso actual y muestra el error en un toast. En el paso 3 aparecen "Guardar borrador" (en edición, "Guardar cambios") y "Enviar ahora" (solo al crear; mientras envía dice "Enviando…").

##### Paso 1: Tipo y categoría

| Campo (UI) | Payload | Tipo | Oblig. | Reglas |
|---|---|---|---|---|
| Tipo de solicitud * | `tipo` | select de `tipos` activos (muestra `etiqueta`, envía `codigo`) | sí | Al cambiar de tipo se vacían categoría y subcategoría. Default: el tipo del borrador, luego el prefill y, si no hay, el primer tipo activo (o `mantenimiento`). |
| Categoría * | `categoriaId` | select | sí (todos los tipos, T-V21) | Al cambiar se vacía la subcategoría. **No** se filtra por tipo. |
| Subcategoría * | `subcategoriaId` | select (deshabilitado sin categoría) | sí | Opción: `"{nombre} (prioridad {A-F})"`. |

Error del paso: "Selecciona categoría y subcategoría.".
**Prioridad:** el inquilino no la elige. El backend la hereda de la subcategoría (`resolverSubcategoria`). Enum `SolicitudPrioridadSchema` = `A|B|C|D|F`.

##### Paso 2: Detalles (orden de validación = orden de los mensajes)

| Bloque | Campo (UI) | Payload | Tipo / límites UI | Regla FE (mensaje) |
|---|---|---|---|---|
| General | Local * | `localId` | select | "Selecciona un local." |
| | Título * | `titulo` | input, maxLength 120 | "El título es obligatorio." |
| | Descripción * | `descripcion` | textarea de 4 filas, maxLength 4000 | "La descripción es obligatoria." |
| Empresa ejecutante | Nombre de la empresa * | `empresaNombre` | max 160 | "Indica el nombre de la empresa ejecutante." |
| | Responsable * | `empresaResponsable` | max 160 | "Indica el responsable de la empresa." |
| | Teléfono * | `empresaTelefono` | max 20, placeholder `+503 7000 0000` | obligatorio + `/^[0-9+\-\s()]{8,20}$/` → "Teléfono de empresa inválido (8-20 dígitos)." |
| | Correo electrónico * | `empresaEmail` | type=email, max 254 | obligatorio + regex básico → "Email de empresa inválido." |
| Contacto de emergencia | Persona de contacto * | `emergenciaContacto` | max 160 | "Indica el contacto de emergencia." |
| | Teléfono de emergencia * | `emergenciaTelefono` | max 20 | obligatorio + regex → "Teléfono de emergencia inválido (8-20 dígitos)." |
| Fechas del permiso | Fecha inicio * | `fechaEventoInicio` | `date` con min/max dinámicos (ver reglas) | "Indica fecha y hora de inicio y fin del permiso." + `validarRangoFechas` |
| | Fecha fin * | `fechaEventoFin` | `date`, min = fecha inicio | idem |
| | Hora inicio * / Hora fin * | `horaInicio` / `horaFin` | `time` (`HH:MM` 24 h, sin límites) | idem |
| | Checkbox **Emergencia** | `esEmergencia` | boolean | Al activarlo se abre un SweetAlert (ver abajo). |
| Por tipo | ver la sección "camposExtra" | `camposExtra.*` | | |
| Personal (todos los tipos) | Cantidad de Personal * | `camposExtra.asistentes_estimados` | number 1..20 (si se escribe más de 20, se toma 20) | "Indica al menos 1 persona de personal." / "El máximo de personal es 20." |
| | Por cada persona i: Nombre * / Documento * | `camposExtra.asistentes[i].{nombre, documento}` | nombre max 120; documento 3..20 | "Completa el nombre y documento del asistente {i}." / "El documento del asistente {i} debe tener entre 3 y 20 caracteres." |

Textos de ayuda: en modo estándar, "La fecha de inicio debe ser entre 48 horas y 5 días después de este momento; el permiso puede durar hasta 7 días.". En emergencia, "Modo emergencia activo: el inicio debe ser dentro de las próximas 48 horas; el permiso puede durar hasta 7 días.". En personal: "Obligatorio (mínimo 1, máximo 20). Completa nombre y documento de cada persona." (en evento añade la frase sobre el umbral de aprobación especial). Si N=0 se muestra el aviso "Indicá al menos 1 persona de personal.".

**SweetAlert de emergencia** (solo al activar; al desactivar no pregunta): `title: 'Modo emergencia'`, `text: 'Solamente tiene un máximo de 3 permisos de emergencia al mes.'`, `icon: 'info'`, `confirmButtonText: 'Entendido'`, `cancelButtonText: 'Cancelar'`. Si se cancela, el checkbox no se activa.

**Aviso de duplicados (no bloqueante, T-090):** cada vez que cambian `localId` o `tipo` (y al montar, si ya hay local) se llama `GET /solicitudes/duplicados?localId=&tipo=`. Si devuelve elementos (se excluye la propia en edición), se muestra el banner "Ya existe una solicitud reciente similar: SOL-…, SOL-…. Puedes continuar de todas formas.".

##### `camposExtra` por tipo (forma exacta enviada)
El bloque de personal es transversal: `asistentes_estimados: number` (1..20) y `asistentes: {nombre, documento}[]`, con **longitud exactamente igual a `asistentes_estimados`**.

| `tipo` | `camposExtra` | Schema contracts |
|---|---|---|
| `mantenimiento` | `{ area_afectada: string(1..200), requiere_ingreso_a_local: boolean, asistentes_estimados, asistentes }` | `CamposExtraMantenimientoSchema` (= objeto `.and(AsistentesBloqueSchema)`) |
| `evento` | `{ asistentes_estimados, asistentes }` (se eliminaron `requiere_corte_calle` y `requiere_amplificacion`, T-091d-remove) | `CamposExtraEventoSchema` |
| `remodelacion` | `{ fecha_inicio_estimada: 'YYYY-MM-DD', duracion_dias: int 1..365, empresa_constructora: string(1..160), monto_presupuesto: number ≥0, asistentes_estimados, asistentes }` | `CamposExtraRemodelacionSchema` |
| `otro` | `{ asistentes_estimados, asistentes }` | `CamposExtraOtroSchema` (= `AsistentesBloqueSchema`) |

`AsistenteSchema`: `nombre` trim 1..120, `documento` trim 3..20. UI del tipo: mantenimiento muestra "Área afectada *" y el checkbox "Requiere ingreso al local". Remodelación muestra "Fecha inicio estimada *" (date sin límites), "Duración (días) *" (1..365), "Empresa constructora *" y "Monto presupuesto (USD) *" (paso 0.01). Mensajes FE: "Indica el área afectada.", "Indica la fecha de inicio estimada.", "Indica la duración en días.", "Indica la empresa constructora.", "Indica el monto del presupuesto.".
**Server-side (solo `evento`):** el backend añade `requiere_aprobacion_especial: asistentes_estimados > configuracion.aprobacion_especial_asistentes_min` (umbral por defecto: 200).
**Tipos configurables (T-V20):** el catálogo **no crea tipos nuevos**. Solo cambia `etiqueta`, `descripcion`, `orden` y `activo` de los 4 códigos fijos. La rama de `camposExtra` se decide siempre por `codigo`.

##### Reglas de fechas (`lib/solicitud-fechas.ts` ⇄ `CreateSolicitudSchema.superRefine`)
Se usa el "momento de elaboración": `new Date()` congelado al montar el wizard (en el backend, el momento del request). Las fechas se combinan como `new Date('YYYY-MM-DDTHH:MM:00')` en **hora local** del proceso (navegador, servidor Next o backend). El backend corre con `TZ=America/El_Salvador` (`backend/.env`, `.env.produccion`), UTC−6 sin horario de verano, así que **la app móvil debe enviar fecha y hora como hora de pared de El Salvador**.

| Regla | Estándar (`esEmergencia=false`) | Emergencia (`esEmergencia=true`) |
|---|---|---|
| Inicio mínimo | ahora + 48 h → "La fecha de inicio debe ser al menos 48 horas después de este momento." | ahora → "La fecha/hora de inicio no puede ser en el pasado." (FE: "La fecha de inicio no puede ser en el pasado.") |
| Inicio máximo | ahora + 5 días → "La fecha de inicio no puede ser más de 5 días después de este momento." | ahora + 48 h → "En modo emergencia el inicio debe ser dentro de las próximas 48 horas. Para fechas posteriores usa un permiso estándar." |
| Fin máximo | inicio + 7 días → "La fecha fin no puede exceder 7 días desde la fecha de inicio." | ahora + 7 días → "En modo emergencia la fecha fin no puede exceder 7 días desde hoy." |
| Orden | fin ≥ inicio (el mismo día vale) → "La fecha/hora de fin debe ser posterior al inicio." | igual |
| `min`/`max` del date picker | inicio ∈ [hoy+48h, hoy+5d]; fin ∈ [inicio, inicio+7d] | inicio ∈ [hoy, hoy+48h]; fin ∈ [inicio, hoy+7d] |
| Cupo mensual | – | máx. 3 solicitudes con `es_emergencia=true` **creadas** en el mes (contadas desde el día 1 en UTC, en cualquier estado) → `422 PERMISO_EMERGENCIA_LIMITE` "Solamente tiene un máximo de 3 permisos de emergencia al mes." |

Formatos: `fechaEvento*` = `z.iso.date()` (`YYYY-MM-DD`), `hora*` = `^([01]\d|2[0-3]):[0-5]\d$`. La respuesta devuelve `fechaEventoInicio/Fin` como `YYYY-MM-DD` y `horaInicio/Fin` como string `HH:MM` (columna `String`).

##### Borrador frente a envío (secuencia exacta de `onSubmit(enviarAhora)`)
1. Re-valida los pasos 1 y 2 en el cliente.
2. **Crear:** `POST /solicitudes` con el payload completo. Siempre nace en `borrador`, con `codigo` `SOL-{SLUG}-{seq}` (trigger) y prioridad heredada. Responde `SolicitudOutput`.
   **Editar:** `PATCH /solicitudes/:id` con el mismo payload completo (incluye `tipo` y `camposExtra`).
3. **Solo al crear:** sube los archivos del paso 3 **uno por uno** con `POST /solicitudes/:id/adjuntos` (multipart, campo `file`). Un fallo muestra el toast `Adjunto "{nombre}": {error}` y **continúa**. Los adjuntos se suben tanto en "Guardar borrador" como en "Enviar ahora", aunque el texto de la UI dice "solo al enviar".
4. Si `enviarAhora`: `POST /solicitudes/:id/enviar` (sin body). Si falla: toast "Guardada como borrador, pero no se pudo enviar: {error}" y navega al detalle.
5. Toast final: "Solicitud {codigo} enviada: quedó en cola de asignación" o "Borrador {codigo} guardado", y navega a `/inquilino/solicitudes/:id`.

Payload de creación (JSON, todos los campos):
```json
{
  "localId": "uuid", "tipo": "mantenimiento", "titulo": "…", "descripcion": "…",
  "categoriaId": "uuid", "subcategoriaId": "uuid",
  "fechaEventoInicio": "2026-10-30", "fechaEventoFin": "2026-10-31",
  "horaInicio": "08:00", "horaFin": "17:00",
  "empresaNombre": "…", "empresaResponsable": "…", "empresaTelefono": "+503 7000 0000",
  "empresaEmail": "a@b.com", "emergenciaContacto": "…", "emergenciaTelefono": "…",
  "esEmergencia": false,
  "camposExtra": { "area_afectada": "…", "requiere_ingreso_a_local": true,
                   "asistentes_estimados": 1, "asistentes": [{"nombre":"…","documento":"…"}] }
}
```

##### Paso 3: Adjuntos y revisión
- **Tarjeta Adjuntos** (solo al crear): dropzone con un máximo de 10 archivos (contador `n / 10`). `accept` = `mimeAcceptMap(MIME_PERMITIDOS_DEFAULT)` y `maxSize` = 50 MB. Errores: `"{nombre}" excede 50 MB.` / `"{nombre}" no es un tipo permitido (PDF, JPG, …).`. Cada archivo muestra icono por MIME (imagen, video o documento), nombre, tipo, tamaño y botón quitar. Nota: "Los adjuntos son opcionales…".
- **Tarjeta Revisión** ("Verifica antes de enviar"), por secciones:
  - *Identificación:* Tipo (etiqueta), Local (código), Título, Descripción, Categoría, Subcategoría.
  - *Empresa ejecutante:* Empresa, Responsable, Tel. empresa, Email empresa.
  - *Contacto de emergencia:* Contacto, Tel. emerg., Modo emerg. (badge rojo "Sí · máx. 3/mes" o "No").
  - *Fechas del permiso:* Inicio y Fin como `dd/mm/yyyy h:mm AM/PM` (`formatFechaDMY` + `formatHora12`).
  - *Personal:* cantidad y lista numerada `nombre · documento`.
  - *Datos del tipo:* mantenimiento (Área afectada, Requiere ingreso Sí/No) o remodelación (fecha estimada, duración, constructora, monto USD).
  - Valor vacío → "—".

---

#### 4.2.3 Server actions de `inquilino/solicitudes/actions.ts` → endpoints

Todas comprueban `session.user.rol === 'inquilino'` (si no, lanzan `Error('Forbidden')`). Los errores se leen como `message ?? detail` y, si es un array (caso de `VALIDATION_ERROR`), se unen con `; `.

| Action | Endpoint | Body / params | Quién la usa | Notas |
|---|---|---|---|---|
| `createSolicitudAction` | `POST /solicitudes` | `CreateSolicitudSchema` (se valida antes en Next) | wizard | devuelve `SolicitudOutput` |
| `updateSolicitudAction` | `PATCH /solicitudes/:id` | `UpdateSolicitudSchema` | wizard (edición) | |
| `enviarSolicitudAction` | `POST /solicitudes/:id/enviar` | ninguno | wizard, detalle (botón "Enviar" en `borrador`) | throttle 10/min |
| `cancelarSolicitudAction` | `POST /solicitudes/:id/cancelar` | `{motivo?}` (`CancelarSolicitudSchema`: trim 1..1000, opcional) | detalle | el detalle pide el motivo con `promptAction` (SweetAlert, opcional; "Volver" aborta) |
| `subsanarSolicitudAction` | `POST /solicitudes/:id/subsanar` | ninguno | detalle (botón "Reenviar subsanada" en `requerida_subsanacion`) | `requerida_subsanacion → enviada` |
| `duplicarSolicitudAction` | `POST /solicitudes/:id/duplicar` | ninguno | detalle (botón "Duplicar", siempre visible) | nuevo borrador "Copia de …" sin fechas, sin adjuntos y con `esEmergencia=false`; copia empresa, contacto y `camposExtra` |
| `addComentarioAction` | `POST /solicitudes/:id/comentarios` | `{cuerpo}` (`CreateComentarioSchema`: trim 1..4000; `tipo` por defecto `general`) | detalle | |
| `subirAdjuntoSolicitudAction` | `POST /solicitudes/:id/adjuntos` | `FormData{file}` | wizard, detalle | |
| `descargarAdjuntoSolicitudAction` | `GET /adjuntos/:adjuntoId/download` | ninguno | detalle | → `{url}` |
| `eliminarAdjuntoSolicitudAction` | `DELETE /adjuntos/:adjuntoId` | ninguno | detalle | 204 |
| `checkDuplicadosAction` | `GET /solicitudes/duplicados?localId=&tipo=` | query | wizard | ante un error devuelve `[]` |

---

#### 4.2.4 Adjuntos (flujo exacto)

- **Subida: multipart directo al backend, sin URL pre-firmada.** `POST /solicitudes/:id/adjuntos` (solicitudes.controller.ts:242), `Content-Type: multipart/form-data`, **un archivo por request en el campo `file`**, sin otros campos. Sin archivo → `400 ADJUNTO_REQUERIDO`.
  - Respuesta: `UploadAdjuntoResponse { adjunto: AdjuntoOutput, url?: string }` (URL pre-firmada para preview, 15 min). La web la ignora.
  - `AdjuntoOutput`: `{id, plazaId, entidadTipo:'solicitud', entidadId, nombreOriginal, mimeType, tamanoBytes, usuarioSubioId, createdAt}`.
  - Inserta un evento `adjunto_agregado` en el historial (con el nombre del archivo como comentario).
- **Quién y cuándo:** el inquilino dueño solo sube en `borrador` o `requerida_subsanacion` (si no, `403 UPLOAD_FORBIDDEN` "Solo puedes adjuntar en borrador o requerida_subsanacion."). El admin sube en cualquier estado no terminal (incluido `aprobada`).
- **Validaciones del backend, en orden** (`AdjuntoValidator.validateAll`):
  1. Extensión ejecutable (`exe|bat|sh|msi|com|cmd|vbs|js|jar|app|dmg|scr|ps1|psm1`) → `400 EJECUTABLE_NO_PERMITIDO`.
  2. **MIME declarado en la parte multipart** (no se detecta del contenido) ∈ `configuracion.mime_types_permitidos` de la plaza → `400 ADJUNTO_MIME_INVALIDO`. ⚠️ En Flutter hay que fijar el `contentType` del `MultipartFile`: con `application/octet-stream` el archivo se rechaza.
  3. Tamaño ≤ `configuracion.tamanio_max_archivo_mb` (default 50) → `413 ADJUNTO_TAMANO_EXCEDIDO`. Tope duro de multer: **100 MB** (y nginx `client_max_body_size 100M`).
  4. Magic bytes según el MIME declarado: PDF `%PDF`; JPEG `FFD8FF`; PNG `89504E47…`; WebP `RIFF` + `WEBP`@8; XLS OLE2 `D0CF11E0…`; XLSX/DOCX `PK\x03\x04`; DWG `AC10`; MP4 `ftyp`@4; MOV `ftyp|moov|mdat|wide|free|skip`@4; WebM EBML `1A45DFA3` + "webm" en los primeros 64 bytes → `400 ADJUNTO_MIME_INVALIDO` "El contenido del archivo no coincide con el tipo declarado.".
  - Máximo **10 adjuntos vivos** por solicitud → `400 MAX_ADJUNTOS_EXCEDIDO`.
- **`MIME_PERMITIDOS_DEFAULT`** (`packages/contracts/src/adjuntos/index.ts`, excluye el alias legacy `application/acad`):

| MIME | Etiqueta | Extensiones |
|---|---|---|
| `application/pdf` | PDF | .pdf |
| `image/jpeg` | JPG | .jpg, .jpeg |
| `image/png` | PNG | .png |
| `image/webp` | WebP | .webp |
| `application/vnd.ms-excel` | XLS | .xls |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | XLSX | .xlsx |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | DOCX | .docx |
| `application/dwg` | DWG | .dwg |
| `video/mp4` | MP4 | .mp4, .m4v |
| `video/quicktime` | MOV | .mov |
| `video/webm` | WebM | .webm |

  El inquilino **no puede leer** la configuración real de su plaza (`GET /configuracion` es solo `admin_plaza`). La web usa siempre los defaults (lista anterior y 50 MB) para validar en cliente, y el backend aplica la configuración real.
- **Listado:** `GET /solicitudes/:id/adjuntos` → `AdjuntoOutput[]` (solo vivos, `created_at DESC`). También vienen en `GET /solicitudes/:id` (`adjuntos[]`).
- **Descarga:** `GET /adjuntos/:id/download` (adjuntos.controller.ts:29) → `{ url }`: URL **pre-firmada GET de MinIO**, TTL `MINIO_PRESIGNED_URL_TTL` (por defecto 900 s = 15 min). Si se configura `MINIO_PUBLIC_ENDPOINT`, el host se reescribe al público. La web la abre en una pestaña nueva. Un inquilino nunca accede a adjuntos de local (responde 404).
- **Eliminación:** `DELETE /adjuntos/:id` (adjuntos.controller.ts:44) → 204. El archivo se mueve al bucket `quarantine-{plazaId}` (purga a los 30 días) y se hace soft delete. Solo puede borrarlo **quien lo subió** o un admin/superadmin (`403 ADJUNTO_DELETE_FORBIDDEN`). La web confirma con SweetAlert: `title: '¿Eliminar "{nombre}"?'`, `text: 'El archivo se moverá a cuarentena.'`, `icon: 'warning'`, `confirmButtonText: 'Sí, eliminar'`. Toast: "Adjunto eliminado (movido a cuarentena)". En el detalle del inquilino, el botón solo aparece en `borrador` o `requerida_subsanacion`.
- **Preview:** no hay preview inline (pospuesto a v1.1 en T-117). La lista muestra icono, nombre, `tamaño · mime · fecha (TZ plaza)` y los botones Descargar/Eliminar.
- **Uploader genérico (`AdjuntoUploader`):** dropzone con `noClick` y un enlace "Subir archivos" que abre el selector. Sube secuencialmente con toasts "{nombre} subido" o "{nombre}: {error}", muestra "Subiendo N archivo(s)…", y "Sin adjuntos todavía." cuando la lista está vacía.

---

#### 4.2.5 Resumen de endpoints de §4.2

| Método y ruta | Controller | @Roles | @RequirePermission (solo admin_plaza con rolStaff) | Body / Query | Respuesta | Errores de dominio |
|---|---|---|---|---|---|---|
| `GET /solicitudes/tipos` | tipos-solicitud.controller.ts:36 | admin_plaza, superadmin, inquilino | `tipos_solicitud.listar` | – | `SolicitudTipoConfigOutput[]` (activos) | `PLAZA_SCOPE_VIOLATION` |
| `GET /categorias` | categorias.controller.ts:62 | admin_plaza, superadmin, inquilino | `categorias.listar` | `ListCategoriasQuerySchema` (page, pageSize≤100, sort, activo, search 1..100); el inquilino siempre recibe solo activas | `Paginated<CategoriaOutput>` | – |
| `GET /categorias/:id` | categorias.controller.ts:73 | idem | `categorias.listar` | – | `CategoriaDetailOutput` (subcategorías activas con responsable/supervisores) | `404 CATEGORIA_NOT_FOUND` |
| `GET /contratos` | contratos.controller.ts:87 | admin_plaza, superadmin, inquilino | `contratos.listar` | `ListContratosQuerySchema` (page, pageSize, localId, inquilinoId, estado `vigente\|finalizado\|cancelado`); el inquilino solo recibe los suyos | `Paginated<ContratoListItem>` (incluye `localId`, `localCodigo`) | – |
| `GET /solicitudes/duplicados` | solicitudes.controller.ts:60 | admin_plaza, superadmin, inquilino | `solicitudes.bandeja.ver` **o** `solicitudes.detalle.ver` | `DuplicadosQuerySchema {localId: uuid, tipo}` (ambos obligatorios) | `SolicitudListItem[]` (máx. 5; mismo local y tipo, últimos 30 días, sin estados `aprobada/cerrada/rechazada/cancelada`) | `VALIDATION_ERROR` |
| `POST /solicitudes` | solicitudes.controller.ts:75 | **inquilino** | – | `CreateSolicitudSchema` | `SolicitudOutput` (estado `borrador`) | `VALIDATION_ERROR`, `404 LOCAL_NOT_FOUND`, `400 LOCAL_NO_DISPONIBLE`, `403 LOCAL_NO_DEL_INQUILINO`, `422 PERMISO_EMERGENCIA_LIMITE`, `400 SUBCATEGORIA_REQUERIDA`, `404 SUBCATEGORIA_NOT_FOUND`, `400 SUBCATEGORIA_INACTIVA`, `403 PLAZA_SCOPE_VIOLATION`, `403 INQUILINO_SCOPE_VIOLATION` |
| `GET /solicitudes/:id` | solicitudes.controller.ts:102 | admin_plaza, superadmin, inquilino | `solicitudes.detalle.ver` | – | `SolicitudDetailOutput` (+ `inquilinoRazonSocial`, `usuarioCreador`, `adjuntos[]`, `comentarios[]`, `historial[]`) | `404 SOLICITUD_NOT_FOUND` (también si es de otro inquilino) |
| `PATCH /solicitudes/:id` | solicitudes.controller.ts:110 | **inquilino** | – | `UpdateSolicitudSchema` (todo opcional, `camposExtra` = unión de los 4 schemas) | `SolicitudOutput` | `400 INVALID_STATE_FOR_EDIT`, errores de local, `422 PERMISO_EMERGENCIA_LIMITE`, `422 CAMPOS_EXTRA_INVALIDOS`, `422 ASISTENTES_COHERENCIA`, errores de subcategoría, `404 SOLICITUD_NOT_FOUND` |
| `POST /solicitudes/:id/enviar` | solicitudes.controller.ts:126 | **inquilino** | – (throttle 10/min) | – | `SolicitudOutput` (`enviada`, `enviadaAt`) | `400 LOCAL_NO_DISPONIBLE`, `400 SUBCATEGORIA_INACTIVA`, errores del validador de responsable (staff), `400 INVALID_STATE_TRANSITION`, `404` |
| `POST /solicitudes/:id/cancelar` | solicitudes.controller.ts:143 | admin_plaza, superadmin, inquilino | `solicitudes.cancelar` | `CancelarSolicitudSchema {motivo?}` | `SolicitudOutput` (`cancelada`) | `400 INVALID_STATE_TRANSITION` (desde `aprobada` o terminal), `404` |
| `POST /solicitudes/:id/subsanar` | solicitudes.controller.ts:158 | **inquilino** | – | – | `SolicitudOutput` (`enviada`, `adminAsignadoId=null`) | `400 INVALID_STATE_TRANSITION`, `404` |
| `POST /solicitudes/:id/duplicar` | solicitudes.controller.ts:176 | **inquilino** | – | – | `SolicitudOutput` (nuevo borrador) | `404` |
| `POST /solicitudes/:id/comentarios` | solicitudes.controller.ts:206 | admin_plaza, superadmin, inquilino | `solicitudes.comentar` | `CreateComentarioSchema {cuerpo, tipo?='general'}` | `ComentarioOutput` | `403 COMENTARIO_TIPO_FORBIDDEN` (inquilino con `decision/subsanacion`), `404` |
| `POST /solicitudes/:id/adjuntos` | solicitudes.controller.ts:242 | admin_plaza, superadmin, inquilino | `solicitudes.adjuntos.subir` | multipart `file` | `UploadAdjuntoResponse` | `400 ADJUNTO_REQUERIDO`, `403 UPLOAD_FORBIDDEN`, `400 MAX_ADJUNTOS_EXCEDIDO`, `400 EJECUTABLE_NO_PERMITIDO`, `400 ADJUNTO_MIME_INVALIDO`, `413 ADJUNTO_TAMANO_EXCEDIDO`, `404 SOLICITUD_NOT_FOUND` |
| `GET /solicitudes/:id/adjuntos` | solicitudes.controller.ts:271 | idem | `solicitudes.adjuntos.descargar` **o** `solicitudes.detalle.ver` | – | `AdjuntoOutput[]` | `404` |
| `GET /adjuntos/:id/download` | adjuntos.controller.ts:29 | idem | `solicitudes\|locales\|contratos.adjuntos.descargar` (OR) | – | `{url}` (pre-firmada, 15 min) | `404 ADJUNTO_NOT_FOUND`, `404 CONTRATO_NOT_FOUND` (código usado para cualquier scope de inquilino) |
| `DELETE /adjuntos/:id` | adjuntos.controller.ts:44 | idem | `…adjuntos.eliminar` (OR) | – | 204 | `403 ADJUNTO_DELETE_FORBIDDEN`, `404` |

Errores transversales: si falla Zod, la respuesta es `400 VALIDATION_ERROR` con **`detail` como array** de `"ruta: mensaje"` y `meta.issues`. Los UUID de ruta mal formados dan 400 (`ParseUUIDPipe`). Rate limit global: 100 req/min por IP.

---

### 4.3 Bandeja, detalle y transiciones (todos los roles)

> Alcance: listados (admin, inquilino, superadmin), detalle por rol, máquina de estados en la UI, comentarios, historial, adjuntos en el detalle, PDF de permiso, SLA y prioridad. El wizard de creación/edición, `adjunto-uploader` (subida) y `solicitud-fechas` están en §4.2.
> Todas las rutas son relativas a `/api/v1`. Para el superadmin "actuando como plaza" el web manda la cabecera `x-plaza-id` (ver §1.10); sin ella, todo endpoint de `/solicitudes/*` y `/reportes/*` responde `403 PLAZA_SCOPE_VIOLATION` (`requirePlaza`).

#### 4.3.1 Pantallas

##### 4.3.1.1 `/admin/solicitudes` — Bandeja de solicitudes
- **Rol**: `admin_plaza` y `superadmin` (este último solo con plaza seleccionada; layout `(admin-plaza)`). **Permiso**: el ítem de menú exige `solicitudes.bandeja.ver`; la página NO valida permiso propio (si el backend responde ≠2xx muestra lista vacía). Backend: `bandeja.ver` OR `bandeja.asignadas_a_mi`.
- **Propósito**: cola de trabajo del admin con semáforo SLA.
- **Carga**: `GET /solicitudes/bandeja?page={n}&pageSize=20[&estado][&tipo][&prioridad][&orden][&asignadasAMi]` (schema `BandejaQuerySchema`).
- **Auto-refresh**: cada **60 s** (`AutoRefresh` → `router.refresh()`), badge "⟳ 60 s" en la cabecera.
- **Cabecera**: título "Bandeja de solicitudes"; subtítulo `"{total} resultados · ordenadas por fecha, más reciente primero | ordenadas por prioridad (A→F) · semáforo SLA."`. Segmento **Todas** (`asignadasAMi=false`) / **Asignadas a mí** (`asignadasAMi=true`, default).
- **Filtros** (form GET, botón "Filtrar"):

| Campo | Valores | Param backend |
|---|---|---|
| Estado | "Todos los estados" + los 10 estados en orden `borrador, enviada, asignado, en_revision, requerida_subsanacion, pausada, aprobada, cerrada, rechazada, cancelada` (etiquetas §6.1) | `estado` |
| Tipo | Todos / Mantenimiento / Evento / Remodelación / Otro | `tipo` |
| Prioridad | Toda / A / B / C / D / F | `prioridad` |
| Ordenar por | "Fecha (más reciente primero)" = `fecha` (default) · "Prioridad (A→F)" = `prioridad` | `orden` |
| (oculto) | `asignadasAMi=true` si el segmento está en "Asignadas a mí" | `asignadasAMi` |

  El backend acepta además `categoriaId`, `subcategoriaId`, `localId` (no expuestos en UI).
- **Semántica backend** (`aprobaciones.service.ts` `bandeja`): `asignadasAMi` default `true` → filtra `admin_asignado_id = yo`, **excepto** si el `rol_staff` del actor es `es_sistema=true` (rol "admin"), que siempre ve toda la plaza. Orden `fecha`: `enviada_at DESC NULLS LAST, created_at DESC`; `prioridad`: `prioridad ASC, enviada_at DESC, created_at DESC`. `slaStatus` sale de la matview `solicitud_sla_view` (refresco diario 02:00 America/El_Salvador) o se calcula al vuelo si la fila no existe.
- **Columnas** (`SolicitudesTable` con `showSla`, `showAsignado`; `ResponsiveDataView`, tarjeta en móvil con "Código" como título): Código (link a detalle, mono) · Tipo (badge neutral) · Título · Local (mono) · Estado (badge) · Prioridad (chip) · SLA (semáforo) · Asignada a (avatar + nombre, o "—") · Enviada (`dd/MM/yyyy` TZ plaza) · Decisión (`dd/MM/yyyy`).
- **Paginador**: "Página X de Y" + números; oculto si `totalPages ≤ 1`.
- **Vacío**: tarjeta con icono Inbox, "Sin solicitudes" / "No hay solicitudes que coincidan con esos criterios."

##### 4.3.1.2 `/admin/solicitudes/[id]` — Detalle del admin (panel de decisión)
- **Rol**: `admin_plaza`, `superadmin` (con plaza). Sin gating de página; si `GET` falla → 404 de Next.
- **Carga** (paralelo):
  - `GET /solicitudes/{id}` → `SolicitudDetailOutput` (permiso `solicitudes.detalle.ver`).
  - `GET /usuarios?rol=admin_plaza&page=1&pageSize=100` (permiso `usuarios_plaza.listar` OR `inquilinos.listar`) → candidatos a reasignar: se filtran `rolStaffActivo === true` (campo extra que devuelve el backend además de `UsuarioOutput`). Si el admin no tiene esos permisos, la lista queda vacía.
  - Identidad propia: `session.user.id` (en móvil: `user.id` del login o `GET /auth/me`).
- **Cabecera**: `codigo` (mono) + badge estado + chip prioridad + semáforo SLA; subtítulo `"{titulo} · Local {localCodigo} · {inquilinoRazonSocial}[ · Asignada a {adminAsignado.nombre}]"`. Botón **"Descargar permiso (PDF)"** siempre visible (abre en pestaña nueva, §4.3.3.4).
- **Banner SC-4** (tono danger) si `usuarioCreadorId === yo` y no terminal: "**SC-4:** creaste esta solicitud, por lo que no puedes aprobarla ni rechazarla." (en la práctica nunca aparece: solo el inquilino crea solicitudes).
- **Tabs**:
  1. **Detalle**: descripción (pre-wrap) · Solicitante = `usuarioCreador.nombre (inquilinoRazonSocial)` · Categoría / Subcategoría · Enviada · Decisión (`dd/MM/yyyy`) · Fecha Inicio / Fecha Fin (`DD-MM-YYYY`, sin conversión TZ) · Hora Inicio / Hora Fin (12 h "3:27 pm"). Bloque **Empresa ejecutante** (Empresa, Responsable, Tel. empresa, Email empresa). Bloque **Contacto de emergencia** (Contacto, Tel. emerg., Modo emerg. → badge rojo "Sí · máx. 3/mes" o "No"). Bloque **Datos específicos**: cada clave de `camposExtra` excepto `asistentes_estimados`, con etiquetas: `area_afectada`→"Área afectada", `requiere_ingreso_a_local`→"Requiere ingreso al local", `asistentes`→"Asistentes" (lista "**nombre** · documento"), `requiere_aprobacion_especial`→"Requiere aprobación especial", `fecha_inicio_estimada`→"Fecha de inicio estimada", `duracion_dias`→"Duración (días)", `empresa_constructora`→"Empresa constructora", `monto_presupuesto`→"Monto presupuesto"; booleanos "Sí/No"; claves desconocidas se muestran con su nombre crudo.
  2. **Comentarios ({n})**: tarjetas con avatar + nombre (o "Sistema") + badge ámbar con el `tipo` si ≠ `general` + fecha `dd/MM/yyyy`. Vacío: "Sin comentarios.". Caja de texto (máx 4000, placeholder "Comentario para el inquilino…") + botón **Comentar** (`<Can solicitudes.comentar>`, deshabilitado si vacío) → `POST /solicitudes/{id}/comentarios` `{ cuerpo }` (tipo por defecto `general`). Toast "Comentario agregado".
  3. **Historial ({n})**: timeline con etiqueta del evento (§4.3.3.2), "→ {estado nuevo}" si aplica, fecha `dd/MM/yyyy` · usuario o "Sistema", y el `comentario` debajo.
  4. **Adjuntos ({n})**: `AdjuntoUploader` con allowlist `MIME_PERMITIDOS_DEFAULT` y tope `ADJUNTO_TAMANIO_MAX_BYTES_DEFAULT` (constantes, no la config de la plaza), `canDelete=true` siempre. Subir `POST /solicitudes/{id}/adjuntos` (multipart campo `file`, permiso `solicitudes.adjuntos.subir`); descargar `GET /adjuntos/{adjId}/download` → `{url}` pre-firmada 15 min que se abre en pestaña nueva; eliminar `DELETE /adjuntos/{adjId}` (204) tras SweetAlert "¿Eliminar "{nombre}"?" / "El archivo se moverá a cuarentena." / "Sí, eliminar". Los Server Actions verifican `solicitudes.adjuntos.subir|descargar|eliminar` antes de llamar.
- **Panel lateral "Panel de decisión"** ("Acciones del flujo según el estado actual."): botones por estado (§4.3.2), y bloque kv: **Prioridad** (chip + `<select>` A–F si no terminal y `<Can solicitudes.cambiar_prioridad>`; cambiar dispara inmediatamente `PATCH /solicitudes/{id}/prioridad {prioridad}`, toast "Prioridad X"), **Asignada a** (nombre o "Sin asignar"), **SLA** (semáforo). Debajo, bloque secundario con Reasignar / Liberar / Cancelar solicitud.
- Todas las acciones: botón deshabilitado mientras `pending`; éxito → toast + cierra modal + `router.refresh()`; error → toast con `detail` del backend (si `detail` es array de issues se une con `; `).

##### 4.3.1.3 `/inquilino/solicitudes` — Mis solicitudes
- **Rol**: `inquilino`. Sin permiso granular (backend: `@Roles` incluye inquilino → `PermissionsGuard` pasa; el service filtra `inquilino_id` del JWT).
- **Carga**: `GET /solicitudes?page={n}&pageSize=20[&estado][&tipo][&fechaDesde][&fechaHasta]` (`ListSolicitudesQuerySchema`). Orden fijo `created_at DESC`. Sin auto-refresh.
- **Cabecera**: "Mis solicitudes", subtítulo "{total} solicitudes.", botón primario **Nueva solicitud** → `/inquilino/solicitudes/nueva` (§4.2).
- **Filtros**: Estado (Todos + 10 estados), Tipo (Todos + 4 tipos), Desde (`date` → `fechaDesde`), Hasta (`date` → `fechaHasta`). Filtran `created_at` (`fechaDesde` como medianoche UTC, `fechaHasta` hasta 23:59:59.999Z). El backend acepta también `localId`, `categoriaId`, `subcategoriaId`, `prioridad` (no expuestos).
- **Columnas**: Código · Tipo · Título · Local · Estado · Prioridad · Enviada · Decisión (sin SLA ni asignado). Vacío y paginador iguales a 1.1.

##### 4.3.1.4 `/inquilino/solicitudes/[id]` — Detalle del inquilino
- **Rol**: `inquilino`. **Carga**: `GET /solicitudes/{id}` (404 si no es suya → `notFound()`).
- **Cabecera**: código + badge estado + chip prioridad (sin SLA); subtítulo `"{titulo} · Local {localCodigo}[ · Asignada a {nombre}]"`; botón **"Descargar permiso (PDF)"** siempre.
- **Banner** (info) si `pausada`: "Esta solicitud está pausada por la administración. No puedes editarla ni reenviarla hasta que sea reanudada."
- **Tabs**: Detalle (Categoría, Subcategoría, Creada, Enviada, Decisión, Fecha/Hora Inicio, Fecha/Hora Fin + mismos bloques Empresa ejecutante / Contacto de emergencia / Datos específicos que el admin), Comentarios (placeholder "Escribe un comentario…", botón **Comentar** sin `<Can>`, siempre disponible en cualquier estado), Historial (idéntico), Adjuntos (`canDelete` solo en `borrador` o `requerida_subsanacion`; la zona de subida se muestra SIEMPRE, pero el backend solo acepta subir en esos dos estados → `403 UPLOAD_FORBIDDEN`).
- **Panel lateral "Estado de la solicitud"** (subtítulo = etiqueta del estado): acciones en §4.3.2. Toasts: "Enviada: quedó en cola de asignación", "Reenviada: volvió a la cola de asignación", "Duplicada como {codigo}" (y navega al nuevo detalle), "Cancelada", "Comentario agregado".
- Textos fijos: en `aprobada` → "Solicitud aprobada: pendiente de cierre por la administración. Te avisaremos cuando se registre el resultado."; en `cerrada` → "Solicitud cerrada el {dd/MM/yyyy}." + badge de resultado + `cierreComentario`.

##### 4.3.1.5 `/superadmin/solicitudes` — Solicitudes globales (cross-plaza, solo lectura)
- **Rol**: `superadmin` (layout `(admin-plataform)`), sin permiso granular.
- **Carga** (paralelo): `GET /admin/solicitudes?page&pageSize=20[&estado][&tipo][&prioridad][&plazaId][&categoriaId][&subcategoriaId][&fechaDesde][&fechaHasta][&search]` (`ListSolicitudesPlataformaQuerySchema`) + `GET /plazas?page=1&pageSize=100` para el combo de plazas. Orden `created_at DESC`. Ignora `x-plaza-id` (siempre cross-plaza).
- **Auto-refresh**: cada **2 min** (badge "⟳ 2 min").
- **Cabecera**: "Solicitudes globales", "{total} resultados en todas las plazas · solo lectura · sin acciones de workflow.", botón **Exportar CSV**.
- **Filtros**: Buscar (`search`, 1–100 chars, placeholder "Código, título o local"; backend busca `ILIKE` en `codigo`, `titulo`, `local.codigo`), Estado, Tipo, Prioridad, Plaza (`plazaId`, "Todas las plazas" + plazas por `nombreComercial`), Desde/Hasta (`fechaDesde`/`fechaHasta` sobre `created_at`). `categoriaId`/`subcategoriaId` solo por URL.
- **Columnas**: Código · Tipo · Título · Local · **Plaza** (`plaza.nombreComercial`) · Estado · Prioridad · SLA · Asignada a · Enviada · Decisión. Link a `/superadmin/solicitudes/{id}`.
- **Exportar CSV**: `GET /admin/solicitudes/export.csv` con los mismos filtros (sin `page/pageSize`), respuesta `text/csv; charset=utf-8` con BOM, `Content-Disposition: attachment; filename="solicitudes-plataforma-YYYYMMDD.csv"`, columnas `codigo, plaza, local, tipo, estado, prioridad, titulo, created_at` (fecha 12 h). Tope 10 000 filas (se trunca en silencio). El web descarga vía Server Action → Blob; toasts "Generando CSV…" / "Descargado {filename}" / "No se pudo exportar: …".

##### 4.3.1.6 `/superadmin/solicitudes/[id]` — Detalle cross-plaza (solo lectura)
- **Carga**: `GET /admin/solicitudes/{id}` → `SolicitudDetailOutput & { plaza: {id, slug, nombreComercial} }`. 404 → notFound; otro error → banner "No se pudo cargar la solicitud (HTTP {status})."; valida con `SolicitudDetailOutputSchema` (si falla: "La respuesta del backend no tiene el formato esperado.").
- **Muestra**: cabecera (código, estado, prioridad, SLA), subtítulo `"{titulo} · Local {localCodigo} · {inquilinoRazonSocial}"`, breadcrumb "Solicitudes globales". Banner info: "**Vista de plataforma (superadmin):** solo lectura. Para operar esta solicitud, impersone la plaza `{nombre}` desde el selector del topbar." Tarjetas: **Identificación** (Estado, Plaza `slug · nombre`, Categoría / Subcategoría, Admin asignado, Enviada, Decisión, Fecha/Hora Inicio, Fecha/Hora Fin), **Descripción**, **Empresa ejecutante**. NO muestra comentarios, historial, adjuntos, contacto de emergencia, campos extra ni PDF (aunque el endpoint los devuelve).
- Sin acciones.

##### 4.3.1.7 Route handler `GET /api/solicitudes/[id]/permiso-pdf` (Next)
- Permite `inquilino`, `admin_plaza`, `superadmin`; proxy a **`GET /reportes/solicitudes/{id}/permiso.pdf`** (`reportes.controller.ts:77`). Ver §4.3.3.4.

#### 4.3.2 Transiciones en la UI vs backend

##### 4.3.2.1 Matriz de botones por estado

| Estado | Admin (`/admin/solicitudes/[id]`) | Inquilino (`/inquilino/solicitudes/[id]`) | Superadmin |
|---|---|---|---|
| `borrador` | Cancelar solicitud · select Prioridad (⚠️ el backend lo rechaza) | **Editar** (→ `/editar`, §4.2) · **Enviar** · Duplicar · Cancelar | Global: nada. Impersonando: igual que admin |
| `enviada` | **Tomar** (cualquier admin) · Cancelar · Prioridad | Duplicar · Cancelar | idem |
| `asignado` | **Tomar (revisar)** solo si soy el asignado · **Pausar** · **Reasignar** · **Liberar** (solo asignado) · Cancelar · Prioridad | Duplicar · Cancelar | idem (ve Pausar/Reasignar; Tomar/Liberar solo si es el asignado) |
| `en_revision` | Si soy asignado y no creador: **Aprobar**, **Rechazar**, **Pedir subsanación** · Pausar · Reasignar · Liberar (asignado) · Cancelar · Prioridad | Duplicar · Cancelar | idem |
| `pausada` | **Reanudar** (cualquier admin con permiso) + texto "Solicitud pausada por {asignado}. Cualquier admin de la plaza puede reanudarla." · Cancelar · Prioridad | Solo Duplicar (+ banner pausada; comentar/adjuntos siguen visibles) | idem |
| `requerida_subsanacion` | Cancelar · Prioridad | **Editar** · **Reenviar subsanada** · Duplicar · Cancelar | idem |
| `aprobada` | **Cerrar solicitud** solo si soy asignado; si no, "Aprobada, pendiente de cierre por {nombre}. Solo el administrador asignado puede cerrarla." · Prioridad (⚠️ backend rechaza) | Duplicar + texto "pendiente de cierre" | idem |
| `cerrada` | Texto "Solicitud cerrada el {fecha}." + badge resultado + comentario de cierre | Duplicar + mismo bloque | idem |
| `rechazada` / `cancelada` | "Solicitud {rechazada\|cancelada}. No hay acciones pendientes." | Duplicar | idem |

Gating por permiso (`<Can>` en UI y `assertAnyCan` en Server Action; superadmin `*` siempre pasa; inquilino no tiene permisos granulares):

| Botón | Permiso | Endpoint | Body (schema) | Comentario obligatorio | Diálogo / confirmación |
|---|---|---|---|---|---|
| Tomar / Tomar (revisar) | `solicitudes.tomar` | `POST /solicitudes/{id}/tomar` | `{}` | – | Ninguno. Toast "Tomada: en revisión" / "En revisión" |
| Aprobar | `solicitudes.aprobar` | `POST /solicitudes/{id}/aprobar` | `AprobarSolicitudSchema` `{comentario?: 1–4000}` | No | Modal "Aprobar solicitud", "Comentario opcional para el inquilino.", textarea 4000. Toast "Aprobada" |
| Rechazar | `solicitudes.rechazar` | `POST /solicitudes/{id}/rechazar` | `RechazarSolicitudSchema` `{comentario: 1–4000}` | Sí | Modal "Rechazar solicitud", "El comentario es obligatorio y se notifica al inquilino." (botón deshabilitado si vacío). Toast "Rechazada" |
| Pedir subsanación | `solicitudes.pedir_subsanacion` | `POST /solicitudes/{id}/pedir-subsanacion` | `SubsanarSolicitudAdminSchema` `{comentario: 1–4000}` | Sí | Modal "Pedir subsanación" (mismo texto). Toast "Subsanación solicitada" |
| Pausar | `solicitudes.pausar` | `POST /solicitudes/{id}/pausar` | `PausarSolicitudSchema` `{motivo?: ≤1000}` | No | Modal "Pausar solicitud" — "La solicitud volverá a tu revisión al reanudarla. El SLA queda congelado mientras esté pausada." placeholder "Motivo (opcional, visible para el equipo)…". Toast "Solicitud pausada" |
| Reanudar | `solicitudes.reanudar` | `POST /solicitudes/{id}/reanudar` | (sin body) | – | Ninguno. Toast "Reanudada" |
| Cerrar solicitud | `solicitudes.cerrar` | `POST /solicitudes/{id}/cerrar` | `CerrarSolicitudSchema` `{resultado, comentario?: 1–4000}`; refine: comentario obligatorio si `resultado ≠ exitoso` | Si ≠ exitoso | Modal "Cerrar solicitud" — "Registra el resultado de la actividad. Esta acción es terminal: no se puede reabrir." Select Resultado: "Cerrada con éxito" (`exitoso`), "Cerrada parcialmente" (`parcial`), "Cerrada sin éxito" (`fallido`), "No realizada" (`no_realizado`); Comentario "(obligatorio)/(opcional)", error "El comentario es obligatorio cuando el cierre no es exitoso." Toast "Solicitud cerrada" |
| Reasignar | `solicitudes.reasignar` | `POST /solicitudes/{id}/reasignar` | `ReasignarSolicitudSchema` `{nuevoResponsableId: uuid, comentario?: ≤1000}` | No | Modal "Reasignar solicitud" — "El nuevo responsable debe ser un admin de plaza con rol de staff activo (SC-6)." Select "Selecciona administrador…" con `nombre (email)` (excluye al asignado actual) + input "Motivo (opcional)". Toast "Reasignada" |
| Liberar | `solicitudes.liberar` | `POST /solicitudes/{id}/liberar` | `LiberarSolicitudSchema` `{motivo?: ≤1000}` | No | Diálogo `promptAction` (SweetAlert con textarea): "Liberar solicitud" / "La solicitud vuelve a la cola de asignación.", placeholder "Motivo (opcional)", botones "Sí, liberar" / "Volver"; cerrar o "Volver" aborta. Toast "Liberada: volvió a la cola" |
| Cancelar solicitud (admin) | `solicitudes.cancelar` | `POST /solicitudes/{id}/cancelar` | `CancelarSolicitudSchema` `{motivo?: 1–1000}` | UI lo exige (si vacío no hace nada); backend opcional | `promptAction`: "Cancelar solicitud" / "La solicitud quedará cancelada y no podrá reabrirse.", placeholder "Motivo de cancelación", obligatorio ("Indica el motivo de la cancelación."), botones "Sí, cancelar" / "Volver". Toast "Cancelada" |
| Prioridad (select) | `solicitudes.cambiar_prioridad` | `PATCH /solicitudes/{id}/prioridad` | `UpdatePrioridadSchema` `{prioridad: A\|B\|C\|D\|F}` | – | Sin confirmación; dispara al cambiar |
| Enviar (inq.) | – | `POST /solicitudes/{id}/enviar` | sin body | – | Ninguna. Rate limit 10 req/min |
| Reenviar subsanada (inq.) | – | `POST /solicitudes/{id}/subsanar` | sin body | – | Ninguna |
| Duplicar (inq.) | – | `POST /solicitudes/{id}/duplicar` | sin body → `SolicitudOutput` nuevo borrador | – | Ninguna; navega al nuevo `id` |
| Cancelar (inq.) | – | `POST /solicitudes/{id}/cancelar` | `{motivo?}` | No | `promptAction` igual al del admin pero con motivo opcional (placeholder "Motivo de cancelación (opcional)"); "Volver" aborta |
| Comentar | admin `solicitudes.comentar`; inq. libre | `POST /solicitudes/{id}/comentarios` | `CreateComentarioSchema` `{cuerpo: 1–4000, tipo?: general (default)}` | – | – |

##### 4.3.2.2 Máquina de estados del backend (`solicitud-state.service.ts`, único escritor de `estado`)

| Evento | Desde | Hacia | Quién / reglas | Efectos |
|---|---|---|---|---|
| `enviar` | borrador | enviada | inquilino dueño; local ≠ `fuera_de_servicio` (`LOCAL_NO_DISPONIBLE`), subcategoría activa (`SUBCATEGORIA_INACTIVA`) con responsable válido (`RESPONSABLE_INVALIDO` 422) | `enviada_at=now`; sin email |
| `autoAsignar` (cron cada 1 min) | enviada con `enviada_at` > 15 min | asignado | sistema (historial usuario null) → responsable actual de la subcategoría; si no hay responsable válido queda en `enviada` | – |
| `tomar` | asignado, enviada | en_revision | en `asignado` solo el asignado o superadmin (`NOT_ASSIGNED_ADMIN` 403); en `enviada` cualquier admin. El que toma pasa a ser `admin_asignado_id` | email "solicitud-recibida" + in-app al creador |
| `aprobar` | en_revision | aprobada | asignado o superadmin (`NOT_ASSIGNED_ADMIN`); no creador (`CANNOT_APPROVE_OWN_REQUEST`) | `decision_at`; tipo `evento` → crea/actualiza `evento_calendario`; `remodelacion` → local `en_mantenimiento` (`fecha_inicio_estimada` + `duracion_dias`); email + in-app |
| `cerrar` | aprobada | cerrada | asignado o superadmin; comentario obligatorio si ≠ exitoso (`VALIDATION_ERROR` por Zod o `CIERRE_COMENTARIO_REQUERIDO`) | `resultado_cierre`, `cierre_comentario`, `cerrada_at`; email + in-app |
| `rechazar` | en_revision | rechazada | no creador (`CANNOT_REJECT_OWN_REQUEST`); **no** exige ser el asignado; comentario (`COMENTARIO_REQUERIDO`) | `decision_at`; email + in-app |
| `pedirSubsanacion` | en_revision | requerida_subsanacion | asignado o superadmin; comentario obligatorio | `admin_asignado_id=null`; crea comentario tipo `subsanacion`; email + in-app |
| `reenviar` (`/subsanar`) | requerida_subsanacion | enviada | inquilino dueño | `enviada_at=now`, sin asignado → vuelve a la cola de 15 min; in-app al admin que pidió la subsanación |
| `reasignar` | asignado, en_revision | (mismo estado) | cualquier admin con permiso; nuevo responsable válido (SC-6, 422 `RESPONSABLE_INVALIDO`); distinto del actual (`SAME_ASSIGNEE`) | email "solicitud-reasignada" + in-app al nuevo; in-app "desasignada" al anterior |
| `liberar` | asignado, en_revision | enviada | asignado o superadmin (`NOT_ASSIGNED_ADMIN`) | `admin_asignado_id=null`; `enviada_at` NO se reinicia; historial con evento `comentario` ("Liberada: …"); in-app al creador |
| `pausar` | asignado, en_revision | pausada | cualquier admin con permiso | conserva asignado; SLA congelado; in-app al creador |
| `reanudar` | pausada | en_revision | cualquier admin con permiso | in-app al creador |
| `cancelar` | borrador, enviada, asignado, en_revision, requerida_subsanacion, pausada | cancelada | inquilino dueño, admin o superadmin | `admin_asignado_id=null`; in-app a creador y asignado; sin email |
| cambio de prioridad (no es transición) | cualquiera excepto borrador, aprobada y terminales | – | admin/superadmin | historial `prioridad_cambiada` "B → A" |

Transición inválida → `400 INVALID_STATE_TRANSITION` ("No se puede "{evento}" una solicitud en estado "{estado}"."). Cada transición inserta una fila en `solicitud_historial`.

##### 4.3.2.3 Diferencias UI ↔ backend
- **Rechazar**: la UI lo muestra solo al asignado; el backend lo permite a cualquier admin con permiso (no llama `assertEsAsignado`).
- **Superadmin impersonando**: el backend le permite tomar/aprobar/cerrar/pedir subsanación/liberar sin ser el asignado, pero la UI esconde esos botones si `adminAsignadoId ≠ session.user.id`. Solo puede "Tomar" una `enviada` (y así se vuelve el asignado).
- **Prioridad**: la UI muestra el select en `borrador` y `aprobada`; el backend responde `400 INVALID_STATE_TRANSITION`.
- **Cancelar admin**: la UI exige motivo, el backend no.
- **Inquilino en `pausada`**: la UI oculta Cancelar; el backend sí permite cancelar desde `pausada`.
- **Inquilino adjuntos**: la zona de subida aparece en todos los estados; el backend solo deja subir en `borrador`/`requerida_subsanacion` (`UPLOAD_FORBIDDEN`). Eliminar: UI solo en esos estados; backend permite al que subió el archivo (o a un admin) en cualquier estado.
- **Cerrar con `exitoso`**: el diálogo dice "Comentario (opcional)", pero la UI descarta el texto y manda solo `{resultado:'exitoso'}`.

#### 4.3.3 Comentarios, historial, adjuntos, PDF, SLA, prioridad

##### 4.3.3.1 Comentarios
- Crear: `POST /solicitudes/{id}/comentarios` `{cuerpo (trim, 1–4000), tipo: 'general'|'decision'|'subsanacion' (default general)}` → `ComentarioOutput`. `decision`/`subsanacion` solo admin/superadmin (`403 COMENTARIO_TIPO_FORBIDDEN`). El backend sanitiza el HTML de `cuerpo`. Sin restricción de estado (también en terminales). La UI siempre manda `general`.
- Listar: viene embebido en el detalle; también existe `GET /solicitudes/{id}/comentarios` (ASC). **No hay comentarios internos**: el inquilino ve todos los comentarios, incluidos los del staff.
- El rechazo y la aprobación NO crean comentario (su texto va al historial); pedir subsanación sí crea un comentario `subsanacion`.
- Notificación in-app solo para tipo `general`: autor admin → creador; autor inquilino → admin asignado (o quien pidió la subsanación).

##### 4.3.3.2 Historial
- Embebido en el detalle; también `GET /solicitudes/{id}/historial` (ASC). Es append-only.
- Etiquetas en UI (`EVENTO_LABEL`): creada "Creada", enviada "Enviada", asignada "Auto-asignada", tomada "Tomada en revisión", aprobada "Aprobada", cerrada "Cerrada", rechazada "Rechazada", subsanada "Subsanación solicitada", reasignada "Reasignada", cancelada "Cancelada", comentario "Comentario", adjunto_agregado "Adjunto agregado", prioridad_cambiada "Prioridad cambiada", pausada "Pausada", reanudada "Reanudada".
- Rareza: el reenvío tras subsanación se registra como `enviada` con comentario "Reenviada tras subsanación"; liberar se registra como `comentario` con `estadoNuevo=enviada`; el cierre guarda "{Etiqueta resultado}: {nota}" en `comentario`; el duplicado arranca con `creada` + "Duplicada de SOL-…".

##### 4.3.3.3 Adjuntos en el detalle (solo lectura/descarga/eliminación; la subida está en §4.2.4)

| Acción | Endpoint | Permiso | Reglas |
|---|---|---|---|
| Listar | embebido en `GET /solicitudes/{id}`; también `GET /solicitudes/{id}/adjuntos` | `solicitudes.adjuntos.descargar` OR `solicitudes.detalle.ver` | solo vivos, `created_at DESC` |
| Descargar | `GET /adjuntos/{adjId}/download` → `{ url }` | `solicitudes.adjuntos.descargar` (OR locales/contratos) | URL pre-firmada de MinIO, 15 min; abrir externamente |
| Eliminar | `DELETE /adjuntos/{adjId}` → 204 | `solicitudes.adjuntos.eliminar` (OR …) | admin/superadmin o el que subió el archivo; si no, `403 ADJUNTO_DELETE_FORBIDDEN`; mueve el archivo a cuarentena + soft delete |
| Subir (ref.) | `POST /solicitudes/{id}/adjuntos` multipart `file` | `solicitudes.adjuntos.subir` | inquilino: solo `borrador`/`requerida_subsanacion`; nadie en terminal (`UPLOAD_FORBIDDEN`); máx 10 por solicitud (`MAX_ADJUNTOS_EXCEDIDO`); tope duro 100 MB, tope real por plaza |

##### 4.3.3.4 PDF "Permiso de Trabajos"
- Botón "Descargar permiso (PDF)" en el detalle del admin y del inquilino, **en cualquier estado** (no en el detalle del superadmin global).
- Backend: `GET /reportes/solicitudes/{id}/permiso.pdf` — `@Roles(admin_plaza, superadmin, inquilino)`, `@RequirePermission(['reportes.ficha_local_pdf','solicitudes.detalle.ver'])` (OR). Necesita plaza (superadmin: `x-plaza-id`); el inquilino solo la suya (si no, 404). Respuesta `application/pdf`, `Content-Disposition: attachment; filename="permiso-{codigo}.pdf"`. Lo genera jsreport (plantilla `solicitud-permiso-pdf`); error del servicio → `502 JSREPORT_ERROR`.
- Contenido: marca de agua según estado (APROBADO verde / BORRADOR gris / PENDIENTE ámbar / RECHAZADO-CANCELADA rojo), validez = `decision_at + 30 días` solo si `aprobada` (si no, "n/a"), datos del solicitante, cliente, local, categoría, asistentes, adjuntos, historial, comentarios y campos extra.
- Errores en el proxy web: JSON `{error}` con el status del backend.

##### 4.3.3.5 SLA / semáforo
- Fórmula (`sla.util.ts` y matview): `sla_dias = configuracion.sla_dias_por_tipo[tipo] × sla_multiplicador_por_prioridad[prioridad]`; `% = días desde enviada_at / sla_dias`; `<0.5` verde, `<1.0` amarillo, `≥1.0` rojo. `null` si no se ha enviado, si `sla_dias` es 0 o falta, o si el estado es `aprobada`, `cerrada`, `rechazada`, `cancelada` o `pausada`.
- **Solo lo calcula `GET /solicitudes/bandeja`**. `GET /solicitudes`, `GET /solicitudes/{id}`, `GET /admin/solicitudes` y `GET /admin/solicitudes/{id}` devuelven `slaStatus: null` siempre (por eso en el detalle se ve "—").
- UI (`SlaSemaforo`): punto 8 px con halo (opacidad .35) + texto en minúscula capitalizado ("Verde"/"Amarillo"/"Rojo"); `null` → "—" en color `--text-muted`. Colores claro/oscuro: verde `#16a34a`/`#34c77b`, ámbar `#e0a106`/`#edb43c`, rojo `#e0463a`/`#ef6258`.

#### 4.3.4 Tabla de endpoints de §4.3

| Método y ruta | @Roles | @RequirePermission | Query / Body | Respuesta | Errores de dominio |
|---|---|---|---|---|---|
| `GET /solicitudes/bandeja` | admin_plaza, superadmin | `solicitudes.bandeja.ver` OR `solicitudes.bandeja.asignadas_a_mi` | `BandejaQuerySchema`: page, pageSize, estado, tipo, categoriaId, subcategoriaId, localId, prioridad, `orden` (fecha\|prioridad, def. fecha), `asignadasAMi` (def. true) | Paginado de `SolicitudListItem` con `slaStatus` | `PLAZA_SCOPE_VIOLATION`, `VALIDATION_ERROR` |
| `GET /solicitudes` | admin_plaza, superadmin, inquilino | `solicitudes.bandeja.ver` (el inquilino pasa) | `ListSolicitudesQuerySchema`: page, pageSize, estado, tipo, localId, categoriaId, subcategoriaId, prioridad, fechaDesde, fechaHasta (YYYY-MM-DD) | Paginado de `SolicitudListItem` (`slaStatus` null); inquilino: solo las suyas | `PLAZA_SCOPE_VIOLATION`, `INQUILINO_SCOPE_VIOLATION` |
| `GET /solicitudes/duplicados` (lo usa el wizard, §4.2) | los 3 | `bandeja.ver` OR `detalle.ver` | `localId`, `tipo` | `SolicitudListItem[]` (máx 5, últimos 30 días, no decididas) | – |
| `GET /solicitudes/:id` | los 3 | `solicitudes.detalle.ver` | – | `SolicitudDetailOutput` | `SOLICITUD_NOT_FOUND` (también si es de otro inquilino) |
| `POST /solicitudes` / `PATCH /solicitudes/:id` (§4.2) | inquilino | – | `CreateSolicitudSchema` / `UpdateSolicitudSchema` | `SolicitudOutput` | `INVALID_STATE_FOR_EDIT` (PATCH fuera de borrador/requerida_subsanacion), `LOCAL_NO_DEL_INQUILINO`, `PERMISO_EMERGENCIA_LIMITE`, … |
| `POST /solicitudes/:id/enviar` | inquilino | – (throttle 10/min) | – | `SolicitudOutput` | `INVALID_STATE_TRANSITION`, `LOCAL_NO_DISPONIBLE`, `SUBCATEGORIA_INACTIVA`, `RESPONSABLE_INVALIDO` (422), `SOLICITUD_NOT_FOUND` |
| `POST /solicitudes/:id/cancelar` | los 3 | `solicitudes.cancelar` (inq. pasa) | `CancelarSolicitudSchema` `{motivo?}` | `SolicitudOutput` | `INVALID_STATE_TRANSITION`, `SOLICITUD_NOT_FOUND` |
| `POST /solicitudes/:id/subsanar` | inquilino | – | – | `SolicitudOutput` | `INVALID_STATE_TRANSITION` |
| `POST /solicitudes/:id/duplicar` | inquilino | – | – | `SolicitudOutput` (borrador; "Copia de …", sin fechas ni adjuntos, `esEmergencia=false`, prioridad de la subcategoría actual) | `SOLICITUD_NOT_FOUND`, `INQUILINO_SCOPE_VIOLATION` |
| `PATCH /solicitudes/:id/prioridad` | admin_plaza, superadmin | `solicitudes.cambiar_prioridad` | `UpdatePrioridadSchema` `{prioridad}` | `SolicitudOutput` | `INVALID_STATE_TRANSITION` (borrador/aprobada/terminal) |
| `POST /solicitudes/:id/comentarios` | los 3 | `solicitudes.comentar` (inq. pasa) | `CreateComentarioSchema` | `ComentarioOutput` | `COMENTARIO_TIPO_FORBIDDEN`, `SOLICITUD_NOT_FOUND` |
| `GET /solicitudes/:id/comentarios` | los 3 | `solicitudes.detalle.ver` | – | `ComentarioOutput[]` | `SOLICITUD_NOT_FOUND` |
| `GET /solicitudes/:id/historial` | los 3 | `solicitudes.detalle.ver` | – | `SolicitudHistorialOutput[]` | `SOLICITUD_NOT_FOUND` |
| `POST /solicitudes/:id/adjuntos` | los 3 | `solicitudes.adjuntos.subir` | multipart `file` | ver §4.2.4 | `ADJUNTO_REQUERIDO`, `UPLOAD_FORBIDDEN`, `MAX_ADJUNTOS_EXCEDIDO`, MIME/tamaño (§4.2.4) |
| `GET /solicitudes/:id/adjuntos` | los 3 | `adjuntos.descargar` OR `detalle.ver` | – | `AdjuntoOutput[]` | `SOLICITUD_NOT_FOUND` |
| `POST /solicitudes/:id/tomar` | admin_plaza, superadmin | `solicitudes.tomar` | – | `SolicitudOutput` | `INVALID_STATE_TRANSITION`, `NOT_ASSIGNED_ADMIN` |
| `POST /solicitudes/:id/liberar` | admin_plaza, superadmin | `solicitudes.liberar` | `LiberarSolicitudSchema` `{motivo?}` | `SolicitudOutput` | `INVALID_STATE_TRANSITION`, `NOT_ASSIGNED_ADMIN` |
| `POST /solicitudes/:id/aprobar` | admin_plaza, superadmin | `solicitudes.aprobar` | `AprobarSolicitudSchema` | `SolicitudOutput` | `INVALID_STATE_TRANSITION`, `CANNOT_APPROVE_OWN_REQUEST`, `NOT_ASSIGNED_ADMIN` |
| `POST /solicitudes/:id/cerrar` | admin_plaza, superadmin | `solicitudes.cerrar` | `CerrarSolicitudSchema` | `SolicitudOutput` | `INVALID_STATE_TRANSITION`, `NOT_ASSIGNED_ADMIN`, `CIERRE_COMENTARIO_REQUERIDO`, `VALIDATION_ERROR` |
| `POST /solicitudes/:id/rechazar` | admin_plaza, superadmin | `solicitudes.rechazar` | `RechazarSolicitudSchema` | `SolicitudOutput` | `INVALID_STATE_TRANSITION`, `CANNOT_REJECT_OWN_REQUEST`, `COMENTARIO_REQUERIDO` |
| `POST /solicitudes/:id/pedir-subsanacion` | admin_plaza, superadmin | `solicitudes.pedir_subsanacion` | `SubsanarSolicitudAdminSchema` | `SolicitudOutput` | `INVALID_STATE_TRANSITION`, `NOT_ASSIGNED_ADMIN`, `COMENTARIO_REQUERIDO` |
| `POST /solicitudes/:id/reasignar` | admin_plaza, superadmin | `solicitudes.reasignar` | `ReasignarSolicitudSchema` | `SolicitudOutput` | `INVALID_STATE_TRANSITION`, `SAME_ASSIGNEE`, `RESPONSABLE_INVALIDO` (422) |
| `POST /solicitudes/:id/pausar` | admin_plaza, superadmin | `solicitudes.pausar` | `PausarSolicitudSchema` `{motivo?}` | `SolicitudOutput` | `INVALID_STATE_TRANSITION` |
| `POST /solicitudes/:id/reanudar` | admin_plaza, superadmin | `solicitudes.reanudar` | – | `SolicitudOutput` | `INVALID_STATE_TRANSITION` |
| `POST /solicitudes/cron/test-auto-asignacion` · `/cron/test-sla-refresh` · `/cron/test-mantenimiento-fin` | admin_plaza, superadmin | tomar / bandeja.ver / aprobar | – | solo dev (404 en producción) | no usar en móvil |
| `GET /adjuntos/:id/download` | los 3 | `solicitudes\|locales\|contratos.adjuntos.descargar` | – | `{ url }` (15 min) | `PLAZA_SCOPE_VIOLATION`, not-found del adjunto |
| `DELETE /adjuntos/:id` | los 3 | `…adjuntos.eliminar` | – | 204 | `ADJUNTO_DELETE_FORBIDDEN` |
| `GET /reportes/solicitudes/:id/permiso.pdf` | los 3 | `reportes.ficha_local_pdf` OR `solicitudes.detalle.ver` | – | `application/pdf` (attachment `permiso-{codigo}.pdf`) | `SOLICITUD_NOT_FOUND`, `PLAZA_SCOPE_VIOLATION`, `JSREPORT_ERROR` (502) |
| `GET /admin/solicitudes` | superadmin | – | `ListSolicitudesPlataformaQuerySchema`: page, pageSize, plazaId, search (1–100), estado, tipo, categoriaId, subcategoriaId, prioridad, fechaDesde, fechaHasta | Paginado de `SolicitudListItem + plaza {id,slug,nombreComercial}\|null` | `ADMIN_PLATFORM_ONLY`, `ROLE_FORBIDDEN` |
| `GET /admin/solicitudes/export.csv` | superadmin | – | mismos filtros | `text/csv` con BOM (máx 10 000 filas) | `ADMIN_PLATFORM_ONLY` |
| `GET /admin/solicitudes/:id` | superadmin | – | – | `SolicitudDetailOutput + plaza` | `SOLICITUD_NOT_FOUND` |

Auxiliar: `GET /usuarios?rol=admin_plaza&page=1&pageSize=100` (permiso `usuarios_plaza.listar` OR `inquilinos.listar`) para el combo de reasignar; solo usuarios activos, orden por nombre, con campos extra `rolStaffActivo` y `rolStaffNombre`.

## 5. Módulos

Todas las pantallas de esta sección (salvo el portal del inquilino y las de superadmin) viven bajo `/admin/*`. El superadmin solo puede usarlas "actuando como" una plaza (`x-plaza-id`); sin ella los services responden `403 PLAZA_SCOPE_VIOLATION` y el web muestra el gate "Selecciona una plaza para operar".

### 5.1 Locales, inquilinos (y sus usuarios), contratos y carga inicial Excel

> Alcance: `/admin/locales/**`, `/admin/inquilinos/**`, `/admin/contratos/**` (incl. `importar`), `/inquilino/contratos/**`.
> Todas las rutas backend llevan el prefijo `/api/v1` y `Authorization: Bearer <accessToken>`.
> Superadmin: estas pantallas solo funcionan "actuando como" una plaza (header `x-plaza-id`); sin él los services responden `403 PLAZA_SCOPE_VIOLATION` (`requirePlaza`).

#### 5.1.0 Notas transversales del alcance

- **Paginación** (`PaginationSchema`): `page` ≥ 1 (default 1), `pageSize` 1..100 (default 20), `sort` (ignorado en estos módulos). Respuesta `{ items, total, page, pageSize, totalPages }`. **El tope es 100**: el web carga los combos de locales/inquilinos con `pageSize=100`; si hay más de 100, los combos se truncan sin avisar (ver §7.6).
- **Gating en el web**: ninguna página de este alcance llama a `assertCan()` a nivel de página. Si el backend responde 403 en un listado, la página muestra la lista vacía; en un detalle, un 404 (`notFound()`). Todos los Server Actions sí llaman a `assertAnyCan([...])` antes de llamar al backend.
- **Strings vacíos**: los Zod schemas rechazan `''` en campos opcionales de email, fecha (`z.iso.date()`), enum (`tipoCliente`) y en números con `min(1)` (`z.coerce.number()` convierte `''` en `0`). Verificado con zod 4.4.3: `{plazoMeses:'', fecha:'', email:''}` da *Too small / Invalid ISO date / Invalid email*. **En la app móvil, un campo vacío se omite o se manda `null`, nunca `''`.** Excepción: `UpdateLocalSchema` acepta `''` y lo convierte en `null`, que significa "borrar el valor".
- **Errores**: envelope RFC 7807 `{type,title,status,detail,instance,code,requestId,meta?}`. El web muestra `message ?? detail` en un toast.

---

#### 5.1.1 Estados y etiquetas

##### Local (`LocalEstadoSchema`)

| valor | etiqueta (badge) | tono | quién lo setea |
|---|---|---|---|
| `disponible` | Disponible | `b-ok` (verde) | Al crear el local; al cerrar el último contrato vigente; manualmente (PATCH) solo si no hay contrato vigente |
| `alquilado` | Alquilado | `b-info` (azul) | **Solo** el flujo de contratos (crear/renovar). PATCH manual → 400 `INVALID_STATE_TRANSITION` |
| `en_mantenimiento` | En mantenimiento | `b-warn` (ámbar) | PATCH manual; también una solicitud de remodelación aprobada (ver §4.3.2.2) |
| `fuera_de_servicio` | Fuera de servicio | `b-neutral` (gris) | PATCH manual (web) o `POST /locales/:id/fuera-de-servicio` (no usado por el web) |

Los selects de filtro y de edición muestran el valor crudo con `_` → espacio, en minúsculas ("en mantenimiento").

##### Contrato (`ContratoEstadoSchema`)

| valor | etiqueta | tono |
|---|---|---|
| `vigente` | Vigente | `b-ok` |
| `finalizado` | Finalizado | `b-neutral` |
| `cancelado` | Cancelado | `b-danger` |

El filtro de contratos muestra el enum crudo (`vigente`/`finalizado`/`cancelado`).

##### Usuario de inquilino (calculado en el front)
`deletedAt != null` → **Inactivo** (`b-neutral`); si no, `emailInvalido` → **Email inválido** (`b-warn`); si no → **Activo** (`b-ok`).

---

#### 5.1.2 Pantallas

##### 5.1.2.1 `/admin/locales` — Listado de locales
- **Rol**: admin_plaza (y superadmin con plaza seleccionada). Ítem de menú con permiso `locales.listar`. Backend `GET /locales` exige `locales.listar`.
- **Datos**: `GET /locales?page={n}&pageSize=20[&estado][&modulo][&nivel]` → `Paginated<LocalOutput>`. Orden: `codigo` ascendente. El backend también acepta `search` (contains en código o módulo), pero el web no lo usa.
- **Filtros** (en la URL): `estado` (select con Todos + 4 estados); `modulo` (texto, coincidencia **exacta**, se aplica con Enter/blur); `nivel` (texto, exacta); botón "Limpiar filtros".
- **Columnas**: Módulo · Nivel · **Local** (código; enlace al detalle; es la columna primaria de la tarjeta) · Área (m²) · Med. energía · Med. agua · Estado (badge) · Acciones.
- **Acciones**:
  - **Nuevo local** (header): enlace a `/admin/locales/nuevo`. ⚠️ No está protegido con `<Can>`.
  - **Desactivar** (por fila, `<Can permiso="locales.deshabilitar">`): SweetAlert `¿Desactivar el local "{codigo}"?`, icono warning, "Sí, desactivar". Llama `DELETE /locales/:id` → 204. Si el local tiene contrato vigente: 409 `LOCAL_HAS_ACTIVE_CONTRACT`. Toast "Local desactivado".
- **Vacío**: EmptyState (icono Store) "Sin locales — No hay locales que coincidan con esos criterios." Paginador abajo.

##### 5.1.2.2 `/admin/locales/nuevo` — Crear local
- Subtítulo: "Se crea en estado «disponible»".
- **Campos** (`CreateLocalSchema`):
  - **Módulo** (`modulo`): trim, se pasa a mayúsculas, 1–20. La UI le pone "*", pero es opcional en el schema.
  - **Nivel** (`nivel`): 1–10. La UI le pone "*", pero es opcional.
  - **Local** (`codigo`, obligatorio): trim, mayúsculas, 1–16, regex `^[A-Z0-9-]+$`.
  - **Área m²** (`areaM2`): number > 0, ≤ 1e6, opcional.
  - **Medidor energía / Medidor agua**: regex `^[0-9]+(-[0-9]+)*$` (dígitos y guiones), ≤ 20; `''` → undefined.
- **Acción**: `POST /locales` con el body del schema (permiso `locales.crear`) → `LocalOutput`. Errores: 409 `LOCAL_CODIGO_DUPLICADO`, 400 `VALIDATION_ERROR`. Si sale bien, toast "Local creado" y vuelve al listado.

##### 5.1.2.3 `/admin/locales/[id]` — Detalle de local (pestañas)
- **Datos**:
  - `GET /locales/:id` (`locales.listar`) → `LocalDetailOutput` = `LocalOutput` + `contratoVigente: ContratoOutput|null` + `historicoContratos: ContratoOutput[]` (orden vigente → finalizado → cancelado).
  - `GET /locales/:id/adjuntos` (`locales.adjuntos.descargar`) → `AdjuntoOutput[]`.
  - 404 `LOCAL_NOT_FOUND` → página 404.
- **Header**: código en monoespaciada + " · Módulo X" + badge de estado. Pie: Creado / Actualizado (`formatDateInPlazaTz`).
- **Pestaña Datos** (`EditarLocalForm`, `UpdateLocalSchema`):
  - Campos: módulo, nivel, código (deshabilitado, "El local es inmutable"), estado (select), área, medidores.
  - **Con contrato vigente**: el select de estado se deshabilita y muestra solo "alquilado"; el web **no envía** `estado`.
  - **Sin contrato vigente**: opciones `disponible`, `en_mantenimiento`, `fuera_de_servicio`.
  - `PATCH /locales/:id` (`locales.editar`). Body: `{modulo?, nivel?, areaM2?, medidorEnergia?, medidorAgua?, estado?}`, donde `''` → `null` (borra el valor).
  - Reglas del backend: `alquilado` sin vigente → 400 `INVALID_STATE_TRANSITION`; `disponible` con vigente → 400 `INVALID_STATE_TRANSITION`.
  - Toast "Local actualizado". ⚠️ El botón Guardar no está protegido con `<Can>`.
  - **Nota**: pasar a `fuera_de_servicio` por PATCH **no** rechaza ni cancela solicitudes. Eso solo lo hace `POST /locales/:id/fuera-de-servicio` (body `FueraDeServicioSchema {motivo 1–1000, rechazarSolicitudesPendientes:boolean=false}`, permiso `locales.fuera_de_servicio`), que el web no usa.
- **Pestaña Contratos** (contador = histórico): mini-tarjetas `fechaInicio → fechaFin|"indefinido"`, `{moneda} {montoMensual} / mes` y badge de estado; enlazan a `/admin/contratos/:id`. Vacío: "Sin contratos todavía."
- **Pestaña Adjuntos ({n})** (`AdjuntoUploader`):
  - Allowlist fija en el front: `image/jpeg`, `image/png`, `image/webp`; máximo 50 MB (fijo en el front; el backend usa el `tamanio_max_archivo_mb` de la plaza).
  - **Subir**: `POST /locales/:id/adjuntos`, multipart, campo **`file`**, un request por archivo (permiso `locales.adjuntos.subir`). Respuesta `{adjunto: AdjuntoOutput, url?}`.
  - **Descargar**: `GET /adjuntos/:adjId/download` → `{url}` pre-firmada de MinIO (TTL 900 s); el web abre la URL en una pestaña nueva.
  - **Eliminar**: SweetAlert `¿Eliminar "{nombre}"?` / "El archivo se moverá a cuarentena." / "Sí, eliminar". Llama `DELETE /adjuntos/:adjId` → 204.
  - Cada fila muestra icono por MIME, nombre, `formatBytes`, MIME y fecha.
- **Pestaña Solicitudes**: placeholder estático ("Las solicitudes relacionadas llegan con el módulo 06."). No carga datos.

##### 5.1.2.4 `/admin/inquilinos` — Listado
- **Rol/permiso**: menú `inquilinos.listar`; backend `GET /inquilinos` (`inquilinos.listar`).
- **Datos**: `GET /inquilinos?page&pageSize=20[&razonSocial][&identificacion]` → `Paginated<InquilinoOutput>`. Los dos filtros son *contains* sin distinguir mayúsculas. Orden: `razon_social` ascendente. Solo devuelve no eliminados.
- **Filtros**: Razón social (texto) e Identificación (texto); se aplican con Enter/blur. Botón "Limpiar filtros".
- **Columnas**: **Razón social** (enlace, primaria) · NIT (`identificacion`) · Nombre comercial · Contacto (`contacto1Nombre`) · Tipo (`tipoCliente` con la primera letra en mayúscula) · Acciones.
- **Acciones**:
  - **Nuevo inquilino**: enlace sin `<Can>`.
  - **Desactivar** (`<Can permiso="inquilinos.deshabilitar">`): SweetAlert `¿Desactivar a "{razonSocial}"?` / "Sí, desactivar". Llama `DELETE /inquilinos/:id` → 204. Si tiene contrato vigente: 409 `INQUILINO_HAS_ACTIVE_CONTRACT`.
- **Vacío**: "Sin inquilinos — No hay inquilinos que coincidan con esos criterios."

##### 5.1.2.5 `/admin/inquilinos/nuevo` — Crear inquilino
- Subtítulo: "Razón social e identificación son inmutables tras crear."
- **Secciones y campos** (`CreateInquilinoSchema`):
  - **Identidad**: `razonSocial`* (1–160), `nombreComercial` (≤160), `identificacion` (NIT, ≤40), `numeroNrc` (≤40), `representanteLegal` (≤160).
  - **Canales**: `numeroTelefono` (≤40), `correoRecepcionDte` (email, lowercase, ≤160).
  - **Contacto 1**: `contacto1Nombre` (≤120), `contacto1Cargo` (≤80), `contacto1Email` (email), `contacto1Telefono` (≤40).
  - **Contacto 2 (opcional)**: los mismos campos, `contacto2*` (email ≤160).
  - **Clasificación**: `tipoCliente` (select: "— Sin clasificar —", grande, mediano, otro), `giroAutorizado` (≤160), `categoria` (≤120), `subcategoria` (≤120). Son textos libres, **no** son el catálogo de categorías de solicitudes.
  - **Otros**: `direccion` (textarea ≤300), `comentarios` (textarea ≤2000).
- **Acción**: `POST /inquilinos` (`inquilinos.crear`) → `InquilinoOutput`. Error 409 `INQUILINO_IDENTIFICACION_DUPLICADA` (UNIQUE parcial plaza+identificación). Toast "Inquilino creado" y vuelve al listado.

##### 5.1.2.6 `/admin/inquilinos/[id]` — Detalle de inquilino (pestañas)
- **Datos**:
  - `GET /inquilinos/:id` (`inquilinos.listar`) → `InquilinoDetailOutput` = `InquilinoOutput` + `contratosVigentes[]` + `historicoContratos[]`.
  - `GET /inquilinos/:id/usuarios?rol=inquilino&pageSize=100` (permiso OR `usuarios_plaza.listar | inquilinos.listar`) → `{items: (UsuarioOutput & {rolStaffActivo, rolStaffNombre})[], total, page, pageSize, totalPages}`. Sin `activo`, devuelve activos e inactivos, ordenados con los activos primero y luego por nombre.
- **Header**: razón social; subtítulo "ID: {identificacion}"; acción **Alta rápida de usuario** (dialog, ver §5.1.4). ⚠️ No está protegido con `<Can>`.
- **Pestaña Datos** (`EditarInquilinoForm`, `UpdateInquilinoSchema`):
  - Razón social y NIT se muestran deshabilitados ("Identidad (inmutable)"). El resto de campos son los de §5.1.2.5 y todos aceptan `null`.
  - `PATCH /inquilinos/:id` (`inquilinos.editar`).
  - Botón **Desactivar**: se deshabilita si hay contratos vigentes (tooltip "No se puede desactivar con contrato vigente" y nota bajo el form). SweetAlert `¿Desactivar a "{razón}"?` con texto "El inquilino no podrá ser usado en nuevos contratos, pero sus datos y contratos históricos se conservan.". Llama `DELETE /inquilinos/:id` y vuelve al listado.
- **Pestaña Contratos**: igual que en el local (mini-tarjetas que enlazan a `/admin/contratos/:id`).
- **Pestaña Usuarios** (`UsuariosInquilinoTable`): columnas Nombre (primaria) · Email · Teléfono · Rol staff (`rolStaffNombre`, siempre "—" en inquilinos) · Último acceso (`lastLoginAt`, o "Nunca") · Estado · Acciones. Acciones en §5.1.4.
  - Vacío: "Sin usuarios — Este inquilino aún no tiene accesos al portal. Usa «Alta rápida de usuario»…".
- **Pestaña Solicitudes**: placeholder estático.

##### 5.1.2.7 `/admin/contratos` — Listado de contratos
- **Permisos**: menú `contratos.listar`; backend `GET /contratos` (`contratos.listar`).
- **Datos** (en paralelo):
  - `GET /contratos?page&pageSize=20[&localId][&inquilinoId][&estado]` → `Paginated<ContratoListItem>` (= `ContratoOutput` + `localCodigo` + `inquilinoRazonSocial`), orden `fecha_inicio` descendente.
  - `GET /locales?page=1&pageSize=100` para el combo de locales.
  - `GET /inquilinos?page=1&pageSize=100` para el combo de inquilinos.
- **Filtros**: Local (select por código), Inquilino (select por razón social), Estado (select con el enum crudo). Botón "Limpiar filtros".
- **Columnas**:
  - **Local**: `localCodigo` o los primeros 8 caracteres del id; enlace al detalle; columna primaria.
  - **Inquilino**.
  - **Inicio** (`YYYY-MM-DD` tal cual) · **Fin** (o "Indefinido").
  - **Canon**: `{moneda} {cuotaArrendamiento.toFixed(2)}`; si es null, `{moneda} {montoMensual}`; si no, "—".
  - **Estado** (badge).
- **Acciones de header**:
  - **Importar Excel**: `<Can permiso="contratos.importar">`, enlace a `/admin/contratos/importar`.
  - **Nuevo contrato**: sin `<Can>`.
- **Vacío**: "Sin contratos — No hay contratos que coincidan con esos criterios."

##### 5.1.2.8 `/admin/contratos/nuevo` — Crear contrato
- Subtítulo: "El local pasa a «alquilado» automáticamente. Sin fecha de fin = indefinido."
- **Datos**: `GET /locales?estado=disponible&page=1&pageSize=100` (solo disponibles) y `GET /inquilinos?page=1&pageSize=100`.
- **Formulario** (`CreateContratoSchema`), por secciones:
  - **Local e inquilino**: `localId`* (select "{codigo} · Módulo X"; si no hay ninguno: "No hay locales disponibles."), `inquilinoId`* (UUID).
  - **Vigencia**:
    - `fechaInicio`* (`YYYY-MM-DD`); `fechaFin` (vacío = indefinido; debe ser ≥ inicio).
    - `plazoMeses` (int 1–1200); `periodoGraciaDias` (int 0–3650).
    - `fechaEntregaLocal` y `inicioOperaciones` (fechas). `fechaEntregaLocal` y `fechaPagoDeposito` **pueden ser anteriores** al inicio.
    - `avisoTerminacion` (fecha ≤ `fechaFin` si ambas existen).
  - **Pagos**:
    - `montoMensual`*: **solo lectura**, se autocalcula como `area × canon + area × cam` (redondeado a 2 decimales); rango 0..1e9.
    - `moneda`: regex `^[A-Z]{3}$`, default `USD`.
    - `areaMt2MedicionReal` (0..1e6), `cuotaArrendamiento`, `cuotaCam`, `depositoGarantia` (0..1e9), `fechaPagoDeposito`.
  - **Totales derivados** (solo UI, no se persisten): Total canon = área × canon; Total CAM = área × CAM; Total = suma.
  - **Notas**: `condiciones` (≤4000), `condicionesIncrementoCanon` (≤4000).
- **Acción**: `POST /contratos` (`contratos.crear`). Body: los campos del schema, con `fechaFin: null` si va vacío. Respuesta: `ContratoOutput`.
  - En la misma transacción, el local pasa a `alquilado`.
  - Errores: 404 `LOCAL_NOT_FOUND` / `INQUILINO_NOT_FOUND`; 409 `CONTRATO_OVERLAP`.
  - Si sale bien: toast "Contrato creado; el local pasó a «alquilado»".
  - ⚠️ El backend **no** valida que el local esté `disponible`: solo valida que no haya un contrato vigente solapado.

##### 5.1.2.9 `/admin/contratos/[id]` — Detalle de contrato
- **Datos**:
  - `GET /contratos/:id` (`contratos.listar`) → `ContratoDetailOutput` = list item + `enVentanaT30` + `enVentanaT7`.
  - `GET /contratos/:id/adjuntos` (`contratos.adjuntos.descargar`) → `AdjuntoOutput[]`.
  - 404 `CONTRATO_NOT_FOUND` → página 404.
- **Banner** de vencimiento:
  - `enVentanaT7` (0..7 días para `fechaFin`) → tono danger: "Este contrato vence en 7 días o menos ({fechaFin}). Renueva o cierra."
  - `enVentanaT30` (8..30 días) → tono warn: "Este contrato vence en 30 días o menos ({fechaFin})."
  - Las ventanas solo se calculan si el contrato es `vigente` y tiene `fechaFin`; el cálculo usa la fecha UTC del servidor.
- **Header**: `{localCodigo} · {inquilinoRazonSocial}` + badge. Si es `vigente`, botones **Renovar contrato** y **Cerrar contrato** (dialogs, §5.1.3). ⚠️ Ninguno de los dos está protegido con `<Can>`.
- **Tarjetas**:
  - **Términos contractuales**: plazo (meses), período de gracia (días), área real (m²), fecha entrega del local, inicio de operaciones, aviso de terminación.
  - **Pagos**: monto mensual, canon, CAM y depósito (con prefijo de moneda), fecha de pago del depósito, más los totales derivados Y/Z/AA calculados en el cliente.
  - **Vigencia y estado**: inicio, fin (o "Indefinido"), estado, creado. Si no es vigente, también "Fin efectivo" y "Motivo de cierre".
  - **Notas**: condiciones e incremento de canon, o "Sin notas registradas."
- **Contrato firmado (PDF)**: `AdjuntosContrato` (§5.1.3.4), con `canDelete`.

##### 5.1.2.10 `/admin/contratos/importar` — Carga inicial desde Excel
- Envuelto en `<Can permiso="contratos.importar">`. El fallback es un EmptyState "Sin permiso — Tu rol no tiene el permiso para importar la carga inicial."
- El flujo completo está en §5.1.5.

##### 5.1.2.11 `/inquilino/contratos` — Mis contratos (rol inquilino)
- ⚠️ **No hay ítem de menú** para esta ruta (el menú del inquilino solo tiene "Mis solicitudes" y "Calendario"); solo se llega por URL directa.
- **Datos**: `GET /contratos?page=1&pageSize=50`. El backend fuerza `inquilino_id` del JWT e ignora `inquilinoId` del query.
  - Al inquilino no le aplica `@RequirePermission`: `PermissionsGuard` deja pasar a `inquilino` si el endpoint tiene `@Roles('inquilino')`.
- **Vista**: misma tabla que el admin pero sin la columna Inquilino; los enlaces van a `/inquilino/contratos/:id`. Subtítulo "{total} contratos asociados a tu cuenta." **Sin paginador** (solo los primeros 50).

##### 5.1.2.12 `/inquilino/contratos/[id]` — Mi contrato
- **Datos**: `GET /contratos/:id` y `GET /contratos/:id/adjuntos`. Si el contrato no es suyo: 404 `CONTRATO_NOT_FOUND`.
- **Vista**: título "Local {codigo}" + badge. Muestra inicio, fin (o "Indefinido"), monto mensual, moneda y condiciones. **No** muestra los términos Excel ni los totales.
- **Contrato firmado (PDF)**: mismo `AdjuntosContrato` con `canDelete`. El backend permite al inquilino subir y descargar en sus contratos, y borrar solo lo que él subió (403 `ADJUNTO_DELETE_FORBIDDEN`).
  - ⚠️ En el web los Server Actions llaman a `assertAnyCan(['contratos.adjuntos.*'])` y el inquilino tiene `permisos = []`, así que **la subida, descarga y borrado fallan en el web con "Permiso denegado"** (ver §7.6). En la app móvil, llamando directo al backend, sí funcionan.

---

#### 5.1.3 Reglas de negocio de contratos y adjuntos

##### 5.1.3.1 Solape (`CONTRATO_OVERLAP`, 409)
- Trigger `fn_contrato_no_overlap` (migración `20260606220340_contrato_no_overlap_trigger`): solo actúa cuando el contrato nuevo o actualizado queda `vigente`.
- Rechaza si existe **otro contrato `vigente` del mismo local** con `daterange(inicio, fin, '[)')` intersectando. `fechaFin` null = +∞.
- Se aplica en crear y renovar.

##### 5.1.3.2 Cerrar — `POST /contratos/:id/cerrar` (`contratos.cerrar`)
- **Body** (`CerrarContratoSchema`): `{ motivoFin: string 1–500 (obligatorio), fechaFinEfectiva?: 'YYYY-MM-DD', estado: 'finalizado'|'cancelado' (default 'finalizado') }`.
- **UI**: dialog "Cerrar contrato" con:
  - Descripción: "{inicio} → {fin|indefinido}. Esta acción no se puede deshacer."
  - Select "Tipo de cierre": Finalizado (fin normal) / Cancelado (terminación anticipada).
  - Motivo*.
  - "Fecha de fin efectiva (default: hoy)". El web la omite si va vacía.
  - No usa SweetAlert: el propio dialog es la confirmación.
- **Backend**:
  - Si no está `vigente`: 400 `INVALID_STATE_TRANSITION`.
  - Si `fechaFinEfectiva < fechaInicio`: 400 `INVALID_DATE`.
  - Guarda `estado`, `motivo_fin` y `fecha_fin_efectiva` (hoy si no se manda).
  - Si no queda otro vigente en el local, el local pasa a `disponible`.
  - Respuesta: `ContratoOutput`.
- Toast: "Contrato cerrado; el local quedó disponible si no hay otros vigentes".

##### 5.1.3.3 Renovar — `POST /contratos/:id/renovar` (`contratos.renovar`)
- **Body** (`RenovarContratoSchema`): `{ nuevaFechaInicio: 'YYYY-MM-DD' (obligatorio), nuevaFechaFin?: date|null (≥ inicio), nuevoMontoMensual?: number 0..1e9 }`.
- **Backend**, en una sola transacción:
  1. Cierra el actual con `motivoFin:'renovado'` y `estado:'finalizado'`, con fecha de fin efectiva = hoy.
  2. Crea uno **nuevo** `vigente`:
     - mismo local e inquilino;
     - fechas nuevas;
     - `montoMensual = nuevoMontoMensual ?? anterior`;
     - **hereda** moneda, condiciones y todos los campos Excel (plazo, área, cuotas, depósito, fechas, gracia, aviso, incremento).
  3. Deja el local `alquilado`.
  - Respuesta: `{ cerrado: ContratoOutput, nuevo: ContratoOutput }`.
  - Errores: 400 `INVALID_STATE_TRANSITION` si no está vigente; 409 `CONTRATO_OVERLAP`.
- **UI**: dialog con nueva fecha inicio*, nueva fecha fin y nuevo monto (default = monto actual), más un preview "{inicio} → {fin|indefinido} · {moneda} {monto} / mes". Toast "Contrato renovado".
  - ⚠️ El web se queda en el detalle del contrato **cerrado** (`router.refresh()`), no navega al nuevo.

##### 5.1.3.4 Adjuntos de contrato (PDF firmado)
- **Subir**: `POST /contratos/:id/adjuntos`.
  - Roles: admin_plaza, superadmin, inquilino. Permiso `contratos.adjuntos.subir` (no aplica al inquilino).
  - Multipart, campo **`file`**. Límite duro de multer: 100 MB. Límite real: `configuracion.tamanio_max_archivo_mb` (default 50).
  - Solo `application/pdf`; se validan extensión, MIME y **magic bytes**.
  - Errores: 400 `ADJUNTO_REQUERIDO` / `ADJUNTO_MIME_INVALIDO` / `EJECUTABLE_NO_PERMITIDO`; 413 `ADJUNTO_TAMANO_EXCEDIDO`; 404 `CONTRATO_NOT_FOUND` (también cuando el inquilino no es el dueño).
  - Respuesta: `{ adjunto: AdjuntoOutput, url?: presignedUrl }`.
- **Listar**: `GET /contratos/:id/adjuntos` → `AdjuntoOutput[]`, orden `created_at` descendente.
- **Descargar**: `GET /adjuntos/:adjId/download` (permiso OR de los tres `*.adjuntos.descargar`) → `{ url }` pre-firmada (TTL 900 s; el host lo reescribe `MINIO_PUBLIC_ENDPOINT`). 404 `ADJUNTO_NOT_FOUND`.
- **Eliminar**: `DELETE /adjuntos/:adjId` (permiso OR de los tres `*.adjuntos.eliminar`) → 204. Mueve el archivo a cuarentena y hace soft delete. Solo admin, o el usuario que lo subió (403 `ADJUNTO_DELETE_FORBIDDEN`).
- **`AdjuntoOutput`**: `{id, plazaId, entidadTipo:'solicitud'|'local'|'contrato', entidadId, nombreOriginal, mimeType, tamanoBytes, usuarioSubioId, createdAt}`.
- **Adjuntos de local**: igual, pero solo admin y superadmin, MIME `image/jpeg|png|webp`. El inquilino nunca los ve: el download devuelve 404.

---

#### 5.1.4 Usuarios de inquilino (pestaña "Usuarios" del detalle)

| Acción UI | Endpoint | Permiso backend (OR) | Permiso que exige el Server Action | Payload / respuesta |
|---|---|---|---|---|
| **Alta rápida de usuario** (dialog: Email, Nombre; precargados con `contacto1Email` y `contacto1Nombre`) | `POST /usuarios` | `usuarios_plaza.crear` \| `inquilinos.alta_usuario` | `inquilinos.alta_usuario` | Body `CreateUsuarioSchema`: `{email, nombre (1–120), password, rol:'inquilino', inquilinoId}` → `UsuarioOutput` (sin contraseña). **La contraseña temporal la genera el CLIENTE** (`Tmp` + base64url(9 bytes aleatorios) + `1a`, 17 caracteres, cumple `PasswordSchema`). El web la muestra una sola vez ("Comparte esta contraseña temporal de forma segura — no se volverá a mostrar"). El backend encola un email de bienvenida **sin** la contraseña. Errores: 409 `USUARIO_EMAIL_DUPLICADO`; 400 `INQUILINO_REQUERIDO` / `INQUILINO_NOT_FOUND`. No hay flag de "cambio obligatorio" de contraseña. |
| **Editar** (icono lápiz; dialog Nombre, Teléfono opcional) | `PATCH /usuarios/:id` | `usuarios_plaza.editar` \| `inquilinos.editar` | `inquilinos.editar` | `{nombre (1–120), telefono: string≤40 \| null}` (`UpdateUsuarioSchema`; vacío → null). 404 `USUARIO_NO_ENCONTRADO` si está inactivo. ⚠️ El web no refresca la tabla después de editar. |
| **Resetear clave** | `POST /usuarios/:id/reset-password` (sin body) | `usuarios_plaza.resetear_clave` \| `inquilinos.resetear_clave` | `inquilinos.resetear_clave` | SweetAlert "¿Enviar email de reseteo de contraseña?" con texto "Se enviará a {email} un enlace válido por 30 minutos…" y botón "Sí, enviar". Respuesta 200 `{id, email, message}`. 409 `USUARIO_EMAIL_INVALIDO` (hard bounce). El enlace apunta a `{FRONTEND_URL}/reset-password/{token}` (web). |
| **Deshabilitar** | `DELETE /usuarios/:id` (body opcional `{motivo?: 3–500}`; el web no lo envía) | `usuarios_plaza.deshabilitar` \| `inquilinos.deshabilitar_usuario` | `inquilinos.deshabilitar_usuario` | SweetAlert `¿Deshabilitar a "{nombre}"?` con el email y "El usuario no podrá iniciar sesión…", botón "Sí, deshabilitar". Respuesta 204. Ya inactivo → 404 `USUARIO_NO_ENCONTRADO`. Un usuario deshabilitado no puede hacer login (login filtra `deleted_at: null`). |
| **Reactivar** (solo filas inactivas) | `POST /usuarios/:id/reactivate` | `usuarios_plaza.reactivar` \| `inquilinos.reactivar_usuario` | `inquilinos.reactivar_usuario` | SweetAlert `¿Reactivar a "{nombre}"?` (icono question, "Sí, reactivar") → `UsuarioOutput`. Si no estaba inactivo: 409 `USUARIO_NO_INACTIVO`. |

- **`UsuarioOutput`**: `{id, email, nombre, telefono|null, rol, rolStaffId|null, inquilinoId|null, plazaId|null, emailInvalido, lastLoginAt|null, createdAt, deletedAt|null}`.
- **No usado por el web en este alcance**: `POST /usuarios/:id/reset-email-invalido` (permiso `usuarios_plaza.editar | inquilinos.editar`), que limpia el flag `emailInvalido`.
- ⚠️ En la tabla de usuarios, los botones Editar, Resetear, Deshabilitar y Reactivar **no** están protegidos con `<Can>`; el permiso solo se verifica en el Server Action.

---

#### 5.1.5 Carga inicial Excel (`/admin/contratos/importar`)

**Flujo en dos pasos, sin estado en el servidor**: se envía el **mismo archivo** dos veces.

##### Paso 1 · Prepara el archivo
- Texto de ayuda:
  - Columnas obligatorias: MODULO, LOCAL, RAZON SOCIAL (o NOMBRE COMERCIAL) y FECHA INICIO DE CONTRATO.
  - Sin fecha de fin el contrato queda indefinido.
  - No crea cuentas de usuario ni envía correos.
  - Volver a importar el mismo archivo no duplica nada.
- Botón **"Descargar plantilla con ejemplos"**: archivo estático del frontend `/plantillas/plantilla-carga-inicial.xlsx` (`frontend/public/plantillas/`). **No hay endpoint backend**: la app debe empaquetar o alojar el archivo por su cuenta.

##### Paso 2 · Sube el Excel
- Dropzone: solo `.xlsx` (MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), un archivo, `CARGA_INICIAL_MAX_BYTES` = 5 MB.
- Al soltarlo, `POST /importacion/carga-inicial/analizar`:
  - multipart, campo **`file`**;
  - roles admin_plaza y superadmin; permiso `contratos.importar`;
  - HTTP 200 → `CargaInicialResultado` (`modo:'analisis'`); **no escribe nada en la BD**.

##### Vista previa
- **Barra superior**: "Vista previa de {archivo} (hoja «{hoja}», {n} filas): todavía no se ha guardado nada", con botones **Cancelar** e **Importar**. Importar se deshabilita si no hay nada que crear.
- **KPIs**: Locales a crear, Inquilinos a crear, Contratos a crear, Filas con advertencia, Filas con error.
- **Notas**:
  - existentes reutilizados;
  - filas de ejemplo ignoradas (COMENTARIOS empieza con «EJEMPLO»);
  - columnas faltantes ("se toman como vacías").
- **Pestañas**: Todas / Con advertencia / Con error. Columnas:
  - **Fila**: "Fila N".
  - **Local**: código + badge de acción.
  - **Inquilino**: razón social + badge.
  - **Contrato**: badge, "Desde {fechaInicio} · USD {monto}".
  - **Estado**: badge OK / Advertencia / Error + lista de `mensajes` (los de nivel `info` en gris).
  - Badges de acción: `crear` → "Nuevo" (análisis) o "Creado" (ejecución); `existente` → "Ya existe"; `repetido` → "Igual a fila N"; `omitido` → "No se crea".

##### Importar
- SweetAlert (html, icono question, "Sí, importar"): "¿Importar la carga inicial? Se crearán X locales, Y inquilinos y Z contratos. No se importan: N fila(s) con error y M contrato(s) omitido(s). La importación no se puede deshacer en bloque."
- `POST /importacion/carga-inicial/ejecutar` con el mismo multipart (`file`). Respuesta 201 (sin `@HttpCode`) → `CargaInicialResultado` (`modo:'ejecucion'`).
  - Una sola transacción (timeout 60 s): crea todo lo válido; si algo inesperado falla, no escribe nada.
- Tras el éxito: toast "Importación completada: …" y botones Ver contratos / Ver locales / Ver inquilinos / Importar otro archivo.

##### Forma de `CargaInicialResultado`
```
{ modo:'analisis'|'ejecucion', archivo, hoja, columnasFaltantes:string[], filasEjemplo:number[],
  totales:{ filas, filasOk, filasConAdvertencia, filasConError,
            locales:{crear,existentes}, inquilinos:{crear,existentes},
            contratos:{crear,existentes,omitidos} },
  filas:[{ fila (1-based como Excel),
           local:{accion,filaOrigen,codigo}|null,
           inquilino:{accion,filaOrigen,razonSocial}|null,
           contrato:{accion,fechaInicio|null,montoMensual|null}|null,
           estado:'ok'|'advertencia'|'error',
           mensajes:[{nivel:'advertencia'|'info', texto}] }] }
```

##### Reglas del parser (backend)
- **Hoja**: «INFORMACION A LLENAR»; si no existe, la primera.
- **Encabezados**: se buscan por nombre normalizado (sin acentos, en mayúsculas, sin signos), no por posición. Máximo 2000 filas.
- **Código de local** = `MODULO-LOCAL`, normalizado ("K" + "29 Isla 1" → `K-29-ISLA-1`). No se duplica el prefijo si LOCAL ya lo trae.
- **Inquilino**: se reutiliza si coincide por NIT o por razón social normalizada. Un inquilino deshabilitado no se reactiva.
- **Contrato**:
  - Sin fecha de inicio (o inválida), no se crea el contrato (advertencia).
  - `montoMensual` = TOTAL; si falta, TOTAL CANON + TOTAL CAM; si falta, área × (cuota + CAM). Si no hay ninguno, queda en 0 (mensaje info).
  - `plazoMeses` = PLAZO (AÑOS) × 12.
  - `fechaFin` = FECHA FIN; si falta, VENCIMIENTO DEL CONTRATO.
  - `moneda` = USD.
  - Un contrato ya vencido se crea `vigente`, con un mensaje info.
  - Los contratos vigentes iguales ya existentes se reutilizan.
- **Campos opcionales inválidos** se descartan con una advertencia; si el inválido es obligatorio, la fila o entidad no se crea.
- **Columnas de la plantilla** (`CARGA_INICIAL_COLUMNAS`, en orden; * = la columna debe existir):
  - **Local**: MODULO*, NIVEL, LOCAL*, ÁREA, MEDIDOR ENERGIA, MEDIDOR AGUA.
  - **Inquilino**: NOMBRE COMERCIAL*, RAZON SOCIAL*, REPRESENTANTE LEGAL, NIT DE LA EMPRESA, CORREO DE RECEPCION DTE, NUMERO DE TELEFONO, NUMERO DE NRC, CONTACTO, CARGO (contacto 1), CORREO CONTACTO, TELEFONO CONTACTO, CONTACTO #2, CARGO (contacto 2; segunda aparición), CORREO CONTACTO #2, TELEFONO CONTACTO #2, TIPO DE CLIENTE, GIRO AUTORIZADO, CATEGORIA, SUBCATEGORIA.
  - **Contrato**: PLAZO (AÑOS), ÁREA mt2 MEDICION REAL, CUOTA ARRENDAMIENTO, CUOTA CAM, TOTAL CANON ARRENDAMIENTO, TOTAL CAM, TOTAL, DEPOSITO DE GARANTÍA, FECHA PAGO DEPOSITO, FECHA INICIO DE CONTRATO*, FECHA FIN DE CONTRATO, FECHA ENTREGA DE LOCAL, PERIODO DE GRACIA, INICIO DE OPERACIONES, VENCIMIENTO DEL CONTRATO, AVISO DE TERMINACIÓN, CONDICIONES DE INCREMENTO CANON, COMENTARIOS.
- **Errores de archivo**:
  - 400 `IMPORTACION_ARCHIVO_REQUERIDO`, `IMPORTACION_ARCHIVO_INVALIDO`, `IMPORTACION_PLANTILLA_INVALIDA`, `IMPORTACION_SIN_FILAS`, `IMPORTACION_DEMASIADAS_FILAS` (todos `BadRequestException`);
  - 409 `CONTRATO_OVERLAP` o `IMPORTACION_CONFLICTO` si la transacción de `ejecutar` choca con datos concurrentes;
  - 413 de multer si el archivo supera 5 MB.

---

#### 5.1.6 Endpoints backend del alcance

Cada endpoint pasa por `JwtAuthGuard → PlazaScopeGuard → RolesGuard → PermissionsGuard`. "Inq" = el rol inquilino está admitido; para él no aplica `@RequirePermission`. Todas las rutas van bajo `/api/v1`.

| Método | Ruta | @Roles | @RequirePermission | Body / Query | Respuesta | Errores de dominio | ¿Lo usa el web? |
|---|---|---|---|---|---|---|---|
| POST | `/locales` | admin, sa | `locales.crear` | `CreateLocalSchema` | `LocalOutput` | 409 `LOCAL_CODIGO_DUPLICADO` | Sí |
| GET | `/locales` | admin, sa, Inq | `locales.listar` | `ListLocalesQuerySchema` (`estado, modulo, nivel, search`, paginación) | `Paginated<LocalOutput>`; el inquilino solo ve locales con contrato vigente suyo | 403 `INQUILINO_SCOPE_VIOLATION` | Sí |
| GET | `/locales/:id` | admin, sa, Inq | `locales.listar` | — | `LocalDetailOutput` | 404 `LOCAL_NOT_FOUND` | Sí |
| GET | `/locales/:id/contratos` | admin, sa | `contratos.listar` | `ListContratoHistorialQuerySchema` (`estado`, paginación) | `Paginated<ContratoOutput>` | 404 | **No** |
| PATCH | `/locales/:id` | admin, sa | `locales.editar` | `UpdateLocalSchema` | `LocalOutput` | 400 `INVALID_STATE_TRANSITION`, 404 | Sí |
| POST | `/locales/:id/fuera-de-servicio` | admin, sa | `locales.fuera_de_servicio` | `FueraDeServicioSchema` | `{local: LocalOutput, solicitudesRechazadas: string[] (códigos)}` | 404 | **No** |
| DELETE | `/locales/:id` | admin, sa | `locales.deshabilitar` | — | 204 | 409 `LOCAL_HAS_ACTIVE_CONTRACT` | Sí |
| POST | `/locales/:id/adjuntos` | admin, sa | `locales.adjuntos.subir` | multipart `file` (jpeg/png/webp) | `{adjunto, url?}` | 400 `ADJUNTO_REQUERIDO` / `ADJUNTO_MIME_INVALIDO` / `EJECUTABLE_NO_PERMITIDO`; 413 `ADJUNTO_TAMANO_EXCEDIDO`; 404 `LOCAL_NOT_FOUND` | Sí |
| GET | `/locales/:id/adjuntos` | admin, sa | `locales.adjuntos.descargar` | — | `AdjuntoOutput[]` | 404 | Sí |
| POST | `/inquilinos` | admin, sa | `inquilinos.crear` | `CreateInquilinoSchema` | `InquilinoOutput` | 409 `INQUILINO_IDENTIFICACION_DUPLICADA` | Sí |
| GET | `/inquilinos` | admin, sa, Inq | `inquilinos.listar` | `ListInquilinosQuerySchema` (`razonSocial, identificacion`, paginación) | `Paginated<InquilinoOutput>`; el inquilino solo ve su propio registro | — | Sí |
| GET | `/inquilinos/:id` | admin, sa, Inq | `inquilinos.listar` | — | `InquilinoDetailOutput` | 404 `INQUILINO_NOT_FOUND` | Sí |
| GET | `/inquilinos/:id/contratos` | admin, sa, Inq | `contratos.listar` | `ListContratoHistorialQuerySchema` | `Paginated<ContratoOutput>` | 404 | **No** |
| GET | `/inquilinos/:id/usuarios` | admin, sa, Inq | `usuarios_plaza.listar` \| `inquilinos.listar` | `ListUsuariosQuerySchema` (`rol, activo, search`, paginación) | `Paginated<UsuarioOutput+{rolStaffActivo,rolStaffNombre}>` | 403 `INQUILINO_SCOPE_VIOLATION`, 404 | Sí |
| PATCH | `/inquilinos/:id` | admin, sa | `inquilinos.editar` | `UpdateInquilinoSchema` | `InquilinoOutput` | 404 | Sí |
| DELETE | `/inquilinos/:id` | admin, sa | `inquilinos.deshabilitar` | — | 204 | 409 `INQUILINO_HAS_ACTIVE_CONTRACT` | Sí |
| POST | `/contratos` | admin, sa | `contratos.crear` | `CreateContratoSchema` | `ContratoOutput` | 404 `LOCAL_NOT_FOUND` / `INQUILINO_NOT_FOUND`; 409 `CONTRATO_OVERLAP` | Sí |
| GET | `/contratos` | admin, sa, Inq | `contratos.listar` | `ListContratosQuerySchema` (`localId, inquilinoId, estado`, paginación) | `Paginated<ContratoListItem>` | — | Sí |
| GET | `/contratos/:id` | admin, sa, Inq | `contratos.listar` | — | `ContratoDetailOutput` | 404 `CONTRATO_NOT_FOUND` | Sí |
| PATCH | `/contratos/:id` | admin, sa | `contratos.editar` | `UpdateContratoSchema` `{montoMensual?, condiciones?: string\|null}` | `ContratoOutput` | 404 | **No** (no hay UI de edición) |
| POST | `/contratos/:id/cerrar` | admin, sa | `contratos.cerrar` | `CerrarContratoSchema` | `ContratoOutput` | 400 `INVALID_STATE_TRANSITION` / `INVALID_DATE` | Sí |
| POST | `/contratos/:id/renovar` | admin, sa | `contratos.renovar` | `RenovarContratoSchema` | `{cerrado, nuevo}` | 400 `INVALID_STATE_TRANSITION`; 409 `CONTRATO_OVERLAP` | Sí |
| POST | `/contratos/:id/adjuntos` | admin, sa, Inq | `contratos.adjuntos.subir` | multipart `file` (solo PDF) | `{adjunto, url?}` | 400 / 413 / 404 `CONTRATO_NOT_FOUND` | Sí |
| GET | `/contratos/:id/adjuntos` | admin, sa, Inq | `contratos.adjuntos.descargar` | — | `AdjuntoOutput[]` | 404 | Sí |
| POST | `/contratos/cron/test-alertas` | admin, sa | `contratos.listar` | — | resultado del cron T-30/T-7 | 404 en producción | No (solo dev) |
| GET | `/adjuntos/:id/download` | admin, sa, Inq | OR de los tres `*.adjuntos.descargar` | — | `{url}` (presigned, 900 s) | 404 `ADJUNTO_NOT_FOUND` / `CONTRATO_NOT_FOUND` | Sí |
| DELETE | `/adjuntos/:id` | admin, sa, Inq | OR de los tres `*.adjuntos.eliminar` | — | 204 | 403 `ADJUNTO_DELETE_FORBIDDEN`; 404 | Sí |
| GET | `/usuarios` | admin, sa | `usuarios_plaza.listar` \| `inquilinos.listar` | `ListUsuariosQuerySchema` | paginado | — | No en §5.1 |
| POST | `/usuarios` | admin, sa | `usuarios_plaza.crear` \| `inquilinos.alta_usuario` | `CreateUsuarioSchema` | `UsuarioOutput` | 400 `ROL_NO_PERMITIDO` / `INQUILINO_REQUERIDO` / `ROL_STAFF_REQUERIDO` / `INQUILINO_NOT_FOUND` / `ROL_STAFF_NO_EXISTE`; 409 `USUARIO_EMAIL_DUPLICADO` | Sí |
| PATCH | `/usuarios/:id` | admin, sa | `usuarios_plaza.editar` \| `inquilinos.editar` | `UpdateUsuarioSchema` (el service solo aplica `nombre` y `telefono`) | `UsuarioOutput` | 404 `USUARIO_NO_ENCONTRADO` | Sí |
| GET | `/usuarios/:id` | admin, sa | `usuarios_plaza.listar` \| `inquilinos.listar` | — | `UsuarioOutput+rolStaff*` | 404 | No en §5.1 |
| DELETE | `/usuarios/:id` | admin, sa | `usuarios_plaza.deshabilitar` \| `inquilinos.deshabilitar_usuario` | `{motivo?}` (`DisableUsuarioSchema`, parseo laxo) | 204 | 404; 403 `USUARIO_ROL_NO_PERMITIDO`; 409 `ULTIMO_ADMIN_ACTIVO` | Sí |
| POST | `/usuarios/:id/reset-password` | admin, sa | `usuarios_plaza.resetear_clave` \| `inquilinos.resetear_clave` | — | 200 `{id,email,message}` | 404; 409 `USUARIO_EMAIL_INVALIDO` | Sí |
| POST | `/usuarios/:id/reactivate` | admin, sa | `usuarios_plaza.reactivar` \| `inquilinos.reactivar_usuario` | — | `UsuarioOutput` | 409 `USUARIO_NO_INACTIVO`; 403 `USUARIO_ROL_NO_PERMITIDO` | Sí |
| POST | `/usuarios/:id/reset-email-invalido` | admin, sa | `usuarios_plaza.editar` \| `inquilinos.editar` | — | `UsuarioOutput` | 404 | No en §5.1 |
| POST | `/importacion/carga-inicial/analizar` | admin, sa | `contratos.importar` | multipart `file` (.xlsx ≤ 5 MB) | 200 `CargaInicialResultado` | 400 `IMPORTACION_*` | Sí |
| POST | `/importacion/carga-inicial/ejecutar` | admin, sa | `contratos.importar` | multipart `file` | 201 `CargaInicialResultado` | 400 `IMPORTACION_*` | Sí |
| GET | `/reportes/locales/:id/export.pdf` | admin, sa | `reportes.ficha_local_pdf` | — | binario `application/pdf` (ficha: local + contratos + solicitudes) | 502 `JSREPORT_ERROR` | **No** (no hay botón en el web) |
| GET | `/reportes/inquilinos/:id/export.pdf` | admin, sa | `reportes.ficha_inquilino_pdf` | — | binario `application/pdf` | 502 `JSREPORT_ERROR` | **No** |

##### Formas de salida clave

**`LocalOutput`**
`{id, plazaId, codigo, modulo|null, nivel|null, areaM2|null, medidorEnergia|null, medidorAgua|null, estado, createdAt, updatedAt, deletedAt|null}`

**`InquilinoOutput`**
`{id, plazaId, razonSocial, identificacion, nombreComercial, representanteLegal, numeroNrc, correoRecepcionDte, numeroTelefono, direccion, contacto1Nombre/Cargo/Email/Telefono, contacto2Nombre/Cargo/Email/Telefono, tipoCliente ('grande'|'mediano'|'otro'|null), giroAutorizado, categoria, subcategoria, comentarios, createdAt, updatedAt, deletedAt}`. Todos los campos opcionales son nullable.

**`ContratoOutput`**
`{id, plazaId, localId, inquilinoId, fechaInicio 'YYYY-MM-DD', fechaFin|null, montoMensual|null, moneda, condiciones|null, estado, fechaFinEfectiva|null, motivoFin|null, plazoMeses, areaMt2MedicionReal, cuotaArrendamiento, cuotaCam, depositoGarantia, fechaPagoDeposito, fechaEntregaLocal, periodoGraciaDias, inicioOperaciones, avisoTerminacion, condicionesIncrementoCanon, createdAt, updatedAt}`. Los campos Excel son nullable.

---

### 5.2 Usuarios staff, roles staff y matriz de permisos · Catálogos · Configuración de plaza

> Fuente: código real (frontend `app/(admin-plaza)/admin/{usuarios-plaza,categorias,catalogos/tipos-solicitud,configuracion}`, componentes `components/client/*`, backend `modules/{usuarios,roles-staff,permisos,categorias,tipos-solicitud,configuracion,plazas}`, contracts). Todas las rutas son `/api/v1/...` con `Authorization: Bearer <access>`.

#### 5.2.0 Convenciones de esta sección

- **Tenant obligatorio:** todos los services de este alcance llaman `requirePlaza(actor)`. Un `superadmin` **debe** mandar `x-plaza-id: <uuid>` (impersonación) o recibe `403 PLAZA_SCOPE_VIOLATION` (en `/configuracion`: `400 PLAZA_REQUERIDA`, pero antes cae en `403 ROLE_FORBIDDEN`, ver §7.7). Excepción: `GET /permisos` (catálogo global, no requiere plaza).
- **Listados paginados:** `?page=1&pageSize=20` (`pageSize` máx **100**; `sort` se acepta pero se ignora en estos módulos). Respuesta `{ items, total, page, pageSize, totalPages }`. Booleanos de query como string `"true"|"false"` (`QueryBooleanSchema`). **No enviar `search=""`**: `search` es `min(1)` → `400 VALIDATION_ERROR`.
- **Gating:** el permiso de la **página** es el del ítem de menú (`nav-config.ts`); las páginas no hacen `assertCan` propio salvo la matriz de permisos. Si falta el permiso, el backend responde `403 PERMISSION_DENIED` y la página muestra lista vacía. Los botones se ocultan con `<Can permiso>`; las server actions repiten `assertAnyCan` (solo UX). `admin_plaza` **sin `rolStaffId`** (legacy) pasa todos los `@RequirePermission`; `superadmin` siempre pasa (`['*']`).
- **Confirmaciones:** `confirmAction` (SweetAlert2), botón cancelar = "Cancelar"; con `icon:'warning'` el foco va a Cancelar. Toasts con `sonner`.
- **Formato fechas:** `formatInPlazaTz()` (TZ `America/El_Salvador`).

---

#### 5.2.1 Pantallas

##### 5.2.1.1 `/admin/usuarios-plaza` — "Usuarios de plaza" (3 pestañas)

- **Rol:** `admin_plaza` (y `superadmin` con plaza seleccionada). **Permiso de página/menú:** `usuarios_plaza.listar` (ítem "Usuarios | Roles", icono `UserCog`).
- **Pestañas** sincronizadas con `?tab=usuarios|roles|permisos` (default `usuarios`); cambiar de pestaña borra `page`. Cada pestaña muestra un chip con contador (`usuarios.total`, `rolesStaff.total`, `catalogo.total`).
- **Carga de datos (en paralelo, server-side):**

| Uso | Endpoint | Params | Respuesta |
|---|---|---|---|
| Tabla usuarios | `GET /usuarios` | `rol=admin_plaza&page={sp.page\|1}&pageSize=20[&search=]` | Paginado de `UsuarioOutput & {rolStaffActivo, rolStaffNombre}` |
| Selects de rol (alta/edición) | `GET /roles-staff` | `activo=true&pageSize=100` | Paginado `RolStaffOutput` |
| Conteo "usuarios asignados" por rol | `GET /roles-staff/con-asignaciones` | — | **array plano** `RolStaffOutput & {usuariosAsignados}` |
| Chip pestaña Permisos | `GET /permisos` | — | `ListarPermisosOutput` (solo usa `total`; si 403 → 0) |
| Tabla roles | `GET /roles-staff` | `page={sp.page\|1}&pageSize=50[&activo=true\|false]` | Paginado `RolStaffOutput` |

> ⚠️ El mismo query param `page` se reutiliza para ambas pestañas.

###### Pestaña "Usuarios"
- **Filtro:** caja "Buscar por nombre o email" → `search` (contiene, case-insensitive, sobre `nombre` y `email`). Botones "Buscar" / "Limpiar". No hay filtro de estado (ver riesgo: el backend siempre excluye deshabilitados).
- **Columnas** (`ResponsiveDataView`, primaria = Nombre): Nombre · Email (mono) · Teléfono (`—`) · Rol de staff (badge verde `b-ok` con nombre; `b-warn` "X (inactivo)" si `rolStaffActivo===false`; `—` si sin rol) · Último acceso (`formatInPlazaTz(lastLoginAt)` o "Nunca") · Estado (`Inactivo` b-neutral si `deletedAt`; `Email inválido` b-warn si `emailInvalido`; si no `Activo` b-ok) · Acciones.
- **Vacío:** icono `UserX`, "Sin usuarios admin_plaza" / "Crea el primero con «Nuevo usuario». Necesitarás al menos un rol de staff activo (pestaña «Roles de staff»)."
- **Acciones:**

| Botón | Visible si | Endpoint | Payload / validación | Confirmación / resultado |
|---|---|---|---|---|
| **Nuevo usuario** (`UserPlus`, deshabilitado si no hay roles activos) | siempre (sin `<Can>`; la action exige `usuarios_plaza.crear`) | `POST /usuarios` | `{email, nombre, telefono?, password, rol:'admin_plaza', rolStaffId}`. Form: email válido (lowercase/trim), nombre 1..120, teléfono ≤40 opcional, rolStaff requerido. Backend: `CreateUsuarioSchema` (ver §5.2.4). **La contraseña temporal la genera el cliente:** `'Tmp' + base64url(randomBytes(9)) + '1a'` (cumple `PasswordSchema`) | Toast "Usuario creado; se envió el email de bienvenida"; el diálogo muestra la contraseña temporal **una sola vez** ("no se volverá a mostrar") + botón "Entendido". El backend NO devuelve la contraseña. |
| Editar (lápiz) | `deletedAt===null` y `usuarios_plaza.editar` | `PATCH /usuarios/:id` | `{nombre, telefono|null, rolStaffId}` (form: nombre 1..120, tel ≤40 o vacío→null, rol requerido). `UpdateUsuarioSchema` | Toast "Usuario actualizado". ⚠️ El backend **solo aplica `nombre`/`telefono`**: `rolStaffId` se ignora (ver §7.7). |
| Resetear clave (`KeyRound`) | activo y `usuarios_plaza.resetear_clave` | `POST /usuarios/:id/reset-password` | sin body | Confirm `icon:'question'`: "¿Enviar email de reseteo de contraseña?" / "Se enviará a {email} un enlace válido por 30 minutos para que fije una nueva contraseña." / "Sí, enviar". Toast "Email de reseteo enviado al usuario". Error 409 `USUARIO_EMAIL_INVALIDO`. |
| Deshabilitar (`PowerOff`, danger) | activo y `usuarios_plaza.deshabilitar` | `DELETE /usuarios/:id` con body JSON `{motivo}` | Diálogo propio (no SweetAlert): título "¿Deshabilitar a {nombre}?", texto "{email}. El usuario no podrá iniciar sesión ni tomar decisiones sobre solicitudes. Puedes reactivarlo después. Indica el motivo (queda registrado en auditoría).", textarea "Motivo (obligatorio)" 3..500 chars (`DisableUsuarioSchema`, en UI obligatorio), botón "Sí, deshabilitar" | 204. Toast "Usuario deshabilitado". Errores: `409 ULTIMO_ADMIN_ACTIVO` (si se deshabilita a sí mismo siendo el único admin activo), `404 USUARIO_NO_ENCONTRADO`. El backend revoca todos sus refresh tokens. |
| Reactivar (`Power`, success) | `deletedAt!==null` y `usuarios_plaza.reactivar` | `POST /usuarios/:id/reactivate` | sin body | Confirm `question`: "¿Reactivar a "{nombre}"?" / "{email}\n\nVolverá a poder iniciar sesión y tomar/decidir solicitudes." / "Sí, reactivar". Toast "Usuario reactivado". ⚠️ inalcanzable desde la lista (ver §7.7). |

###### Pestaña "Roles de staff"
- Texto: "Catálogo de roles operativos que se asignan a cada admin_plaza (técnico, ingeniero, supervisor, etc.). Cada plaza crea los que necesite."
- **Filtro:** solo por URL `?activo=true|false` (no hay control visible).
- **Columnas** (primaria = Código, mono): Código · Nombre · Descripción (`—`) · Usuarios asignados (badge `b-info` con n si >0, si no "0") · Estado (Activo `b-ok` / Inactivo `b-neutral`) · Acciones. Orden backend: activos primero, luego nombre.
- **Vacío:** icono `ShieldX`, "Sin roles de staff" / "Crea el primer rol (técnico, supervisor, etc.) con «Nuevo rol»."
- **Acciones:**

| Botón | Visible si | Endpoint | Payload / validación | Confirmación / resultado |
|---|---|---|---|---|
| **Nuevo rol** (`Plus`) | siempre (action exige `roles_staff.crear`) | `POST /roles-staff` | `CreateRolStaffSchema`: `codigo` 2..40 `^[a-z0-9-]+$` (se pasa a minúsculas; inmutable tras crear; placeholder `tecnico`), `nombre` 1..80, `descripcion` ≤500 opcional | Toast "Rol creado". `409 ROL_STAFF_CODIGO_DUPLICADO`. |
| Editar (lápiz) | `roles_staff.editar` | `PATCH /roles-staff/:id` | `{nombre, descripcion|null, activo}` (`UpdateRolStaffSchema`); código se muestra deshabilitado ("Inmutable tras la creación."); checkbox "Activo" (permite reactivar) | Toast "Rol actualizado". |
| Desactivar (`PowerOff`, danger) | `activo` y `roles_staff.deshabilitar` | `DELETE /roles-staff/:id` | — | Confirm `warning`: "¿Desactivar el rol "{nombre}"?" / "{codigo}" + si hay asignados "⚠️ Hay {n} usuario(s) con este rol asignado. Quedarán con el rol inactivo visible en la UI." / "Sí, desactivar". Respuesta `{rol, usuariosAsignados}`; nunca bloquea (RN-RS-3). Toast "Rol desactivado". |

###### Pestaña "Permisos"
- Solo una tarjeta "Matriz de permisos granulares" con texto explicativo ("El rol `admin` es del sistema y siempre tiene todos los permisos; no se puede modificar.") y botón **"Abrir matriz de permisos →"** → `/admin/usuarios-plaza/permisos`.

##### 5.2.1.2 `/admin/usuarios-plaza/[id]` — Detalle de usuario de plaza

- **Rol/permiso:** igual que 1.1 (backend `usuarios_plaza.listar` OR `inquilinos.listar`). ⚠️ **Ninguna pantalla enlaza aquí** (solo accesible por URL).
- **Datos:** `GET /usuarios/:id` (incluye deshabilitados; 404 → `notFound()`), `GET /roles-staff?pageSize=100` (todos, incluidos inactivos, para el select).
- **Campos:** breadcrumb "Usuarios de plaza › {nombre}", título nombre, subtítulo email. Tarjeta **Identidad**: Email (mono), Nombre, Teléfono, Rol global = "admin_plaza" (hardcodeado). Tarjeta **Operación**: Rol de staff (`{nombre}` / `{nombre} (inactivo)` / `—`), Último acceso ("Nunca"), Estado ("Inactivo desde {fecha}" / "Email inválido (hard bounce)" / "Activo"). Tarjeta **Solicitudes asignadas**: placeholder "Vista pendiente de integración…" con link a `/admin/solicitudes`.
- **Acción:** botón Editar (mismo diálogo que 1.1) si `deletedAt===null`. **Sin `<Can>`** aquí (la action valida `usuarios_plaza.editar`).

##### 5.2.1.3 `/admin/usuarios-plaza/permisos` — Matriz de permisos

- **Gate de página (server):** `assertCan(['permisos.ver_matriz','roles_staff.gestionar_permisos'])` (OR). Si falla: tarjeta "Sin acceso" con el mensaje y "Para gestionar permisos necesitas el permiso `permisos.ver_matriz` (o `roles_staff.gestionar_permisos`)…".
- **Datos:**
  1. `GET /permisos` → `{ total, modulos: [{ modulo, permisos: PermisoOutput[] }] }` (módulos ordenados alfabéticamente; permisos por `accion` asc). Si falla: "No se pudo cargar el catálogo de permisos" + "HTTP {status}".
  2. `GET /roles-staff?pageSize=100` (todos los roles, **activos e inactivos**). Si falla: "No se pudo cargar la lista de roles de la plaza".
  3. Por cada rol, `GET /permisos/roles/:rolStaffId` → `{ rolStaffId, esSistema, permisos[] }` (si falla, el rol queda con 0 permisos).
  4. **Rol de sistema:** el web lo detecta por `codigo === 'admin'` (no usa `esSistema`). La app móvil puede usar `esSistema` del paso 3.
- **Contenido:** tarjeta "Convenciones del sistema RBAC" (texto informativo); buscador "Buscar permiso (código o descripción)…" (filtra en cliente por `codigo`, `descripcion`, `accion`); resumen "{total} permisos · {n} rol(es) · {m} de sistema".
- **Modo ancho (contenedor ≥ 760 px):** una tarjeta por **módulo** (`modulo` del catálogo: `auditoria`, `calendario`, `categorias`, `configuracion`, `contratos`, `inquilinos`, `locales`, `notificaciones`, `permisos`, `reportes`, `solicitudes`, `tipos-solicitud`, `usuarios-plaza`); tabla filas = permisos (código mono + descripción), columnas = roles. Cabecera de columna: nombre del rol (+ candado si sistema), badge "Sistema" o checkbox "todos" (tri-estado, marca/desmarca todos los permisos del módulo para ese rol), punto `b-warn` si hay cambios sin guardar. Celda = checkbox (deshabilitado para el rol de sistema).
- **Modo compacto (< 760 px):** select "Rol a editar" (por defecto el primer rol no-sistema; sufijo " (sistema)"); por módulo una tarjeta con lista de permisos + checkbox; checkbox "todos" por módulo; badge "Cambios sin guardar".
- **Barra inferior:** "{n} rol(es) con cambios pendientes"; por cada rol modificado: "{nombre}:" + **Descartar** (`RotateCcw`, revierte al snapshot) + **Guardar** (`Save`).
- **Guardar** → confirm `warning`: "¿Guardar permisos del rol "{nombre}"?" / texto "Se asignarán {n} permiso(s). Los cambios afectan a TODOS los usuarios con este rol." (si 0: "El rol quedará sin permisos asignados (los usuarios con este rol no podrán hacer nada).") / "Sí, guardar" → `PUT /permisos/roles/:rolStaffId` body `{ permisoIds: uuid[] }` (**reemplazo total**, `AsignarPermisosInputSchema`, máx 500). Action exige `roles_staff.gestionar_permisos` OR `permisos.asignar_a_roles`. Toast "Permisos del rol "{nombre}" actualizados". Errores traducidos: `ROL_SISTEMA_NO_MODIFICABLE` → "El rol del sistema es inamovible. No se pueden modificar sus permisos."; `PERMISO_NO_ENCONTRADO`/`ROL_STAFF_NO_ENCONTRADO` → "Algunos permisos o el rol seleccionado ya no existen. Recarga la página."; `PERMISSION_DENIED` → "No tienes permiso para modificar permisos de roles."; otro → "Error al guardar permisos ({status})."
- **Vacío:** sin roles → icono `ShieldCheck`, "Sin roles de staff" / "Crea primero un rol en la pestaña «Roles de staff». Luego podrás asignarle permisos aquí."
- Existen además actions (no usadas por la UI) para `POST`/`DELETE /permisos/roles/:rolStaffId/permisos/:permisoId`.

##### 5.2.1.4 `/admin/categorias` — Categorías

- **Rol/permiso de página:** `categorias.listar` (ítem "Categorías", icono `Tags`, grupo "Catálogo").
- **Datos:** `GET /categorias?page={sp.page|1}&pageSize=20[&activo=true|false][&search=]` → Paginado `CategoriaOutput`. Orden `nombre` asc.
- **Filtros** (form GET, botón "Filtrar"): "Buscar" (`search`, contiene sobre `nombre`) · "Estado": Todas (`''`) / Activas (`true`) / Inactivas (`false`).
- **Header:** título "Categorías", subtítulo "{total} categorías · clasifican las solicitudes de los inquilinos.", botón **"Nueva categoría"** → `/admin/categorias/nueva` (sin `<Can>`).
- **Columnas:** Nombre (link a `/admin/categorias/{id}`, primaria) · Descripción (`—`) · Estado (Activa `b-ok` / Inactiva `b-neutral`) · Acciones.
- **Acciones:** "Subcategorías" (link `/admin/categorias/{id}/subcategorias`) · **Desactivar** (si `activo` y `categorias.deshabilitar`) → confirm `warning` "¿Desactivar la categoría "{nombre}"?" / "Sí, desactivar" → `DELETE /categorias/:id`. Toast "Categoría desactivada". Error `400 CATEGORIA_HAS_ACTIVE_SUBCATEGORIAS` ("La categoría tiene N subcategoría(s) activa(s). Desactívalas primero.").
- **Vacío:** icono `Tags`, "Sin categorías" / "No hay categorías con esos criterios."
- No hay acción "Reactivar" en la UI (el backend sí lo permite con `PATCH {activo:true}`).

##### 5.2.1.5 `/admin/categorias/nueva` — Nueva categoría

- Form `CategoriaForm` (validado con `CreateCategoriaSchema`): **Nombre*** (1..80) · **Descripción** (textarea ≤500, opcional). Botones "Cancelar" (back) / "Crear categoría".
- `POST /categorias` body `{nombre, descripcion?}`. Action exige `categorias.crear`. Éxito: toast "Categoría creada" y navega a `/admin/categorias`. Error `409 CATEGORIA_NOMBRE_DUPLICADO` ("Ya existe un registro con ese nombre.").

##### 5.2.1.6 `/admin/categorias/[id]` — Detalle/edición de categoría

- **Datos:** `GET /categorias/:id` → `CategoriaDetailOutput` (categoría + **solo subcategorías activas**, cada una con `responsable {id,nombre,email}|null` y `supervisores[]`). 404 → `notFound()`.
- **Header:** breadcrumb "Categorías › {nombre}", subtítulo "{Activa|Inactiva} · {n} subcategoría(s) activa(s)", botón "Gestionar subcategorías".
- **Columna izq. "Editar":** `CategoriaForm` precargado → `PATCH /categorias/:id` body `{nombre, descripcion}` (action exige `categorias.editar`; valida con `UpdateCategoriaSchema`). Toast "Categoría actualizada" y vuelve al listado. No expone `activo`.
- **Columna der. "Subcategorías activas":** lista con nombre, "Responsable: {nombre|—} · Supervisores: {n}/5" y chip de prioridad (`prio prio-{A..F}`). Vacío: "Sin subcategorías activas."

##### 5.2.1.7 `/admin/categorias/[id]/subcategorias` — Gestión de subcategorías

- **Datos (paralelo):** `GET /categorias/:id` (404 → notFound), `GET /categorias/:id/subcategorias?page=1&pageSize=100` (todas, activas e inactivas), `GET /usuarios?rol=admin_plaza&page=1&pageSize=100` → opciones de staff **filtradas a `rolStaffActivo===true`** (`{id,nombre,email}`).
- **Header:** breadcrumb, título "Subcategorías de {categoría}", "{total} subcategoría(s) · cada una con 1 responsable y hasta 5 supervisores."
- **Columnas:** Nombre (primaria) · Prioridad (chip A–F) · Responsable (`—`) · Supervisores (`n/5`, rojo si ≥5) · Estado (Activa/Inactiva) · Acciones.
- **Vacío:** "No hay subcategorías. Crea la primera."
- **Acciones:**

| Botón | Permiso | Endpoint | Payload / reglas | Resultado |
|---|---|---|---|---|
| **Nueva subcategoría** | `subcategorias.crear` | `POST /categorias/:id/subcategorias` | `{nombre (1..80), descripcion? (≤500), prioridad (A\|B\|C\|D\|F, default B), responsableId (uuid, requerido), supervisorIds: []}` (la UI siempre manda `[]`; supervisores se gestionan aparte). Diálogo: "La prioridad se hereda a las solicitudes nuevas (S-FS-Prioridad)." | Toast "Subcategoría creada". Errores: `404 CATEGORIA_NOT_FOUND` (categoría inactiva), `422 RESPONSABLE_INVALIDO`, `409 SUBCATEGORIA_NOMBRE_DUPLICADO`. |
| Editar | `subcategorias.editar` | `PATCH /categorias/:id/subcategorias/:subId` | `{nombre, descripcion, prioridad}` (responsable no editable aquí; `activo` no expuesto) | Toast "Subcategoría actualizada". |
| Responsable | `subcategorias.asignar_responsable` | `PATCH /categorias/:id/subcategorias/:subId/responsable` | `{responsableId}`; diálogo "Debe ser un admin de plaza con rol de staff activo (SC-6)."; botón "Cambiar responsable" deshabilitado si no cambió | Toast "Responsable actualizado". **Efecto backend:** reasigna en la misma transacción todas las solicitudes `asignado`/`en_revision` de la subcategoría al nuevo responsable (historial `reasignada`, email `solicitud-reasignada`, notificaciones in-app `solicitud_reasignada`/`solicitud_desasignada`). |
| Supervisores | `subcategorias.gestionar_supervisores` | `POST .../:subId/supervisores` `{usuarioId}` · `DELETE .../:subId/supervisores/:usuarioId` | Diálogo "Supervisores de {nombre} {n}/5" — "Reciben notificación de cada solicitud nueva de la subcategoría."; lista con "Quitar"; select "Agregar supervisor…" (excluye los ya asignados; deshabilitado con "Límite de 5 alcanzado") + "Agregar" | Toasts "Supervisor agregado"/"Supervisor quitado". Errores `409 SUBCATEGORIA_MAX_5_SUPERVISORES`, `422 SUPERVISOR_INVALIDO`, `404 SUPERVISOR_NOT_FOUND`. ⚠️ La lista del diálogo no se refresca hasta reabrirlo. |
| Desactivar (rojo) | `subcategorias.deshabilitar` (solo si activa) | `DELETE /categorias/:id/subcategorias/:subId` | — | Confirm `warning` "¿Desactivar la subcategoría "{nombre}"?" / "Sí, desactivar". Toast "Subcategoría desactivada". |

##### 5.2.1.8 `/admin/catalogos/tipos-solicitud` — Tipos de solicitud

- **Rol/permiso:** `tipos_solicitud.listar` (ítem "Tipos de solicitud", icono `Shapes`).
- **Datos:** `GET /admin/tipos-solicitud?page={sp.page|1}&pageSize=20[&activo=true|false]` → Paginado `SolicitudTipoConfigOutput`. Orden `orden` asc, `codigo` asc.
- **Filtro:** "Estado": Todos / Activos / Inactivos. Subtítulo "{total} tipos · controla la etiqueta visible y si se ofrecen a los inquilinos."
- **Columnas:** Etiqueta (link al detalle, primaria) · Código (`code`) · Descripción · Orden · Estado (Activo/Inactivo) · Acciones ("Editar" → detalle).
- **Vacío:** icono `Shapes`, "Sin tipos" / "No hay tipos con esos criterios. Si es la primera vez, ejecuta el seed."
- **No se crean ni eliminan tipos:** son exactamente 4 por plaza (`mantenimiento`, `evento`, `remodelacion`, `otro`), sembrados al crear la plaza.

##### 5.2.1.9 `/admin/catalogos/tipos-solicitud/[id]` — Editar tipo

- **Datos:** `GET /admin/tipos-solicitud/:id` (404 → notFound). Header: título = etiqueta, subtítulo "Código: {codigo} · {Activo|Inactivo} · orden {orden}".
- Si `codigo==='otro'`: banner informativo "Tipo «otro» — Es el fallback del flujo de solicitudes (no requiere categoría/subcategoría). Por diseño, **nunca se puede desactivar**…".
- **Form** (`UpdateSolicitudTipoConfigSchema`): **Etiqueta visible*** (1..80; "Es lo que ven los inquilinos en el wizard y los admins en los reportes.") · Descripción (≤500; vacío→`null`) · Orden (entero 0..99; "Menor = primero"). Botón "Guardar cambios" (deshabilitado si no hay cambios) → `PATCH /admin/tipos-solicitud/:id` con `{etiqueta, descripcion, orden, activo}`. Toast "Tipo de solicitud actualizado".
- **Toggle Estado** (botón separado, guarda inmediato): "Desactivar"/"Activar" → confirm (`warning` para desactivar: "¿Desactivar el tipo «{etiqueta}»?" / "Ya no aparecerá en el wizard ni en los filtros. Las solicitudes existentes NO se modifican." / "Sí, desactivar"; `question` para activar: "¿Activar el tipo «{etiqueta}»?" / "Volverá a aparecer en el wizard y en los filtros de reportes." / "Sí, activar") → `PATCH /admin/tipos-solicitud/:id` `{activo}`. Deshabilitado para `otro` activo. Errores: `409 TIPO_INMUTABLE` (desactivar `otro`), `409 TIPO_CON_SOLICITUDES_ACTIVAS` ("El tipo «X» tiene N solicitud(es) activa(s)…"; cuenta estados `borrador, enviada, asignado, en_revision, requerida_subsanacion`).
- Permiso de acción: `tipos_solicitud.editar` (sin `<Can>` en la UI; lo valida la action/backend).
- **Consumo en otras pantallas:** wizard de solicitud y filtros de reportes usan `GET /solicitudes/tipos` (solo activos, orden `orden`,`codigo`; accesible a `inquilino`).

##### 5.2.1.10 `/admin/configuracion` — Configuración de plaza

- **Rol:** solo `admin_plaza` en la práctica (ver §7.7: superadmin ve el ítem pero la página muestra "Esta pantalla requiere una plaza asignada."). **Permiso de página:** `configuracion.ver`.
- **Datos (paralelo):** `GET /plazas/{session.plazaId}` → `PlazaOutput`; `GET /configuracion` → `Configuracion`. Si cualquiera falla: banner "No se pudo cargar la configuración."
- Header: "Configuración" / "Datos generales, branding, SLA, adjuntos y calendario de {nombreComercial}." Feedback con banner `banner-ok`/`banner-danger` (no toasts).
- **Pestañas** (estado local, no URL):

| Pestaña | Campos | Guardar → endpoint / payload | Permiso botón |
|---|---|---|---|
| **General** | Nombre comercial · Email de contacto · Teléfono · Zona horaria (`America/El_Salvador`, deshabilitado, "Fija para todas las plazas en v1 (decisión T-V08).") | "Guardar" → `PATCH /plazas/:plazaId` `{nombreComercial, emailContacto: string\|null, telefonoContacto: string\|null}` (`UpdatePlazaSchema`) → "Datos generales guardados." | `configuracion.editar_general` |
| **Branding** | Color primario (color picker + input HEX) · Logo (preview `<img src=logoUrl>`; input file `accept="image/png,image/svg+xml"`, "PNG/SVG, máx 2 MB") | "Guardar color" → `PATCH /plazas/:plazaId` `{colorPrimario:'#RRGGBB'}` → "Branding guardado." · **Logo se sube al seleccionar el archivo** (sin botón) → `POST /plazas/:plazaId/logo` multipart campo **`file`** → "Logo actualizado." | color: `configuracion.editar_branding`; input de logo **sin `<Can>`** (la action exige `configuracion.editar_branding`) |
| **SLA** | "Días por tipo": 4 inputs numéricos ≥0 (`mantenimiento`, `evento`, `remodelacion`, `otro`) · "Multiplicador por prioridad": 5 inputs ≥0 step 0.1 (`A`..`F`) · **Preview del semáforo** (tabla tipo × prioridad con `round(dias×mult,1)` + "d"; color `red` ≤3, `amber` ≤7, `green` >7 — solo visual) | "Guardar SLA" → `PATCH /configuracion` `{slaDiasPorTipo:{mantenimiento,evento,remodelacion,otro}, slaMultiplicadorPorPrioridad:{A,B,C,D,F}}` → "SLA guardado." | `configuracion.editar_sla` |
| **Adjuntos** | Checkboxes de tipos permitidos (de `MIME_PERMITIDOS_DEFAULT` con etiqueta `MIME_INFO[m].label`: PDF, JPG, PNG, WebP, XLS, XLSX, DOCX, DWG, MP4, MOV, WebM) · Tamaño máximo por archivo (MB, entero ≥1) | "Guardar adjuntos" → validación cliente (entero ≥1; al menos 1 MIME) → `PATCH /configuracion` `{mimeTypesPermitidos: string[], tamanioMaxArchivoMb: int}` → "Adjuntos guardados." | `configuracion.editar_adjuntos` |
| **Calendario** | Checkbox "Mostrar hitos contractuales en el calendario" | "Guardar calendario" → `PATCH /configuracion` `{calendarMostrarHitosContrato: bool}` → "Calendario guardado." | `configuracion.editar_calendario` |

- `aprobacionEspecialAsistentesMin` existe en `Configuracion` (default 200) pero **no se edita en la UI**.
- Branding aplicado: el layout inyecta `:root{--color-primary:<colorPrimario>}`; el logo se muestra con la URL pre-firmada (expira en 15 min).

---

#### 5.2.2 Reglas de negocio por dominio

##### 5.2.2.1 Usuarios staff (`admin_plaza`)
- **Alta:** `POST /usuarios` con `rol:'admin_plaza'` exige `rolStaffId` de un `rol_staff` **activo** de la plaza (`400 ROL_STAFF_REQUERIDO` / `400 ROL_STAFF_NO_EXISTE`). `rol:'superadmin'` → `400 ROL_NO_PERMITIDO`. Email duplicado → `409 USUARIO_EMAIL_DUPLICADO`. El backend encola email de **bienvenida** (sin contraseña). **No devuelve contraseña**: el cliente la genera y la muestra una vez. Respuesta: `UsuarioOutput` (201).
- **Editar:** el backend solo persiste `nombre` y `telefono` (ignora `rolStaffId` y `activo` aunque el schema los acepte). 404 si está deshabilitado.
- **Deshabilitar (soft delete):** `DELETE /usuarios/:id` (body opcional `{motivo}` 3..500; si es inválido se ignora en silencio). Solo usuarios `inquilino`/`admin_plaza` (`403 USUARIO_ROL_NO_PERMITIDO`). RN-AU-5: autodeshabilitarse siendo el único `admin_plaza` activo → `409 ULTIMO_ADMIN_ACTIVO`. Revoca refresh tokens. Ya deshabilitado → `404 USUARIO_NO_ENCONTRADO`. Respuesta 204.
- **Reactivar:** `POST /usuarios/:id/reactivate` → `UsuarioOutput`; si no está deshabilitado `409 USUARIO_NO_INACTIVO`. Se permite aunque su `rol_staff` esté inactivo.
- **Reset clave por admin:** `POST /usuarios/:id/reset-password` → genera token (TTL `PASSWORD_RESET_TTL`=30 min) y envía email con `{FRONTEND_URL}/reset-password/{token}`; respuesta `{id, email, message:'Si el email es válido, el usuario recibirá un enlace de reseteo.'}`; `409 USUARIO_EMAIL_INVALIDO` si hubo hard bounce.
- **Reset de `email_invalido`:** `POST /usuarios/:id/reset-email-invalido` (permiso `usuarios_plaza.editar` OR `inquilinos.editar`) — **no usado por el web**.
- El mismo controller sirve al flujo de usuarios de **inquilino** (permisos OR `inquilinos.*`; ver §5.1.4).

##### 5.2.2.2 Roles de staff
- Catálogo por plaza; `codigo` único por plaza e **inmutable** (no está en `UpdateRolStaffSchema`).
- Desactivar = `activo=false` (no hay borrado físico); devuelve `usuariosAsignados` para advertir; nunca bloquea. Reactivar = `PATCH {activo:true}` (checkbox en editar).
- **Rol de sistema** (`es_sistema=true`, código `admin`, creado al crear la plaza con TODOS los permisos): trigger BD impide cambiar `codigo`/`nombre`/`plaza_id` y borrar; **sí** permite cambiar `descripcion` y `activo`. Sus permisos no se pueden modificar vía API (`ROL_SISTEMA_NO_MODIFICABLE`). `RolStaffOutput` **no** expone `esSistema`; solo `GET /permisos/roles/:id` lo devuelve.
- `GET /roles-staff/con-asignaciones` devuelve **todos** los roles (activos e inactivos) con conteo de usuarios activos.

##### 5.2.2.3 Matriz de permisos
- Catálogo **global** (90 permisos, 13 módulos; la lista completa de códigos está en §1.11). Se agrupa por `modulo` del catálogo (p. ej. los `roles_staff.*` aparecen bajo `usuarios-plaza`; `subcategorias.*` bajo `categorias`).
- Lectura: `GET /permisos` (requiere `permisos.ver_matriz`) + `GET /permisos/roles/:id` por rol.
- Escritura: `PUT /permisos/roles/:id` `{permisoIds}` = **reemplazo total** del set (borrar + recrear en transacción). Requiere `roles_staff.gestionar_permisos` OR `permisos.asignar_a_roles`. También existen `POST`/`DELETE /permisos/roles/:id/permisos/:permisoId` (individual, devuelven el set actualizado).
- Efecto: los permisos se resuelven frescos desde BD en cada request (`/auth/me/permisos` y `PermissionsGuard`), por lo que el cambio aplica de inmediato a todos los usuarios del rol (el cliente debe recargar `/auth/me/permisos`).
- Un `admin_plaza` sin `rolStaffId` (legacy) recibe todos los permisos; el rol de sistema `admin` también (vía pivote sembrado).

##### 5.2.2.4 Categorías / subcategorías
- **Categoría:** `nombre` (1..80, único por plaza → `409 CATEGORIA_NOMBRE_DUPLICADO`), `descripcion` (≤500), `activo`. Desactivar (DELETE o PATCH `activo:false`) bloqueado si tiene subcategorías activas → `400 CATEGORIA_HAS_ACTIVE_SUBCATEGORIAS`.
- **Subcategoría:** `nombre` (único por categoría), `descripcion`, `prioridad` A|B|C|D|F (default B; se hereda a las solicitudes nuevas), `responsableId` (obligatorio, exactamente 1), `supervisores` (0..5; límite enforced por trigger → `409 SUBCATEGORIA_MAX_5_SUPERVISORES`), `activo`. Crear exige categoría activa.
- **Elegibilidad de responsable/supervisor (SC-6):** usuario no deshabilitado, de la misma plaza, rol `admin_plaza`, con `rol_staff_id` y `rol_staff.activo=true` → si no, `422 RESPONSABLE_INVALIDO` / `422 SUPERVISOR_INVALIDO`.
- **Cambio de responsable:** reasigna masivamente las solicitudes activas asignadas (ver §5.2.1.7). Las `enviada`/`requerida_subsanacion` las tomará el cron de auto-asignación con el nuevo responsable.
- **Relación con solicitudes:** el inquilino elige categoría → subcategoría en el wizard (tipos distintos de `otro`; `otro` no requiere categoría). `GET /categorias`, `GET /categorias/:id`, `GET /categorias/:id/subcategorias[/:subId]` están abiertos al rol `inquilino` (solo ve activas; el filtro `activo` se ignora).
- No hay campo "orden" en categorías/subcategorías: el orden es alfabético por `nombre`.

##### 5.2.2.5 Tipos de solicitud (configuración por plaza, T-V20)
- 4 filas fijas por plaza (`codigo` ∈ `mantenimiento|evento|remodelacion|otro`, inmutable). Editables: `etiqueta` (1..80), `descripcion` (≤500|null), `orden` (0..99), `activo`. No hay POST/DELETE.
- `otro` nunca se desactiva (`409 TIPO_INMUTABLE`); un tipo con solicitudes no terminales no se desactiva (`409 TIPO_CON_SOLICITUDES_ACTIVAS`). Activar siempre se permite.
- Etiquetas default (fallback): Mantenimiento, Evento, Remodelación, Otro (`SOLICITUD_TIPO_ETIQUETA_DEFAULT`).

##### 5.2.2.6 Configuración de plaza
- 1:1 con la plaza. Forma (`ConfiguracionSchema`; `PATCH` acepta parcial `UpdateConfiguracionSchema`):

```jsonc
{
  "tamanioMaxArchivoMb": 50,               // int 1..2048 (tope duro real de subida: 100 MB por multer)
  "mimeTypesPermitidos": ["application/pdf", "..."], // min 1; cada valor ∈ MIME_PERMITIDOS_DEFAULT o 400 MIME_NO_PERMITIDO
  "slaDiasPorTipo": { "mantenimiento": 5, "evento": 3, "remodelacion": 15, "otro": 7 },   // number ≥0 (admite decimales)
  "slaMultiplicadorPorPrioridad": { "A": 0.5, "B": 1.0, "C": 1.5, "D": 2.0, "F": 3.0 },   // number ≥0
  "calendarMostrarHitosContrato": true,
  "aprobacionEspecialAsistentesMin": 200   // int ≥1 (no editable en UI)
}
```
  (valores = defaults de BD). SLA de una solicitud = `slaDiasPorTipo[tipo] × slaMultiplicadorPorPrioridad[prioridad]` días.
- MIME por defecto (11): `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/dwg`, `video/mp4`, `video/quicktime`, `video/webm` (el alias legacy `application/acad` existe en `MIME_INFO` pero no es seleccionable).
- **Datos generales y branding viven en la plaza** (`PATCH /plazas/:id`): `nombreComercial` (1..120), `emailContacto` (email|null), `telefonoContacto` (≤40|null), `colorPrimario` (`^#[0-9a-fA-F]{6}$`). `slug` y `timezone` (`America/El_Salvador`) no son editables.
- **Logo:** `POST /plazas/:id/logo`, multipart campo `file`, MIME `image/png` o `image/svg+xml`, máx **2 MB**. Guarda en MinIO `logo/{uuid}.{png|svg}` (el anterior va a cuarentena) y devuelve `PlazaOutput` con `logoUrl` **pre-firmada (15 min)** → recargar `GET /plazas/:id` para renovarla.
- Permisos: el backend aplica un **OR global** (`configuracion.editar_general|branding|sla|adjuntos|calendario`) sobre `PATCH /configuracion`; el web separa por botón con `<Can>`. `PATCH /plazas/:id` y `POST /plazas/:id/logo` **no tienen `@RequirePermission`** (solo `@Roles('superadmin','admin_plaza')` + "su propia plaza").

---

#### 5.2.3 Tabla resumen de endpoints de §5.2

Leyenda roles: SA = superadmin, AP = admin_plaza, IN = inquilino. Permisos en OR salvo indicación.

| Método | Ruta | @Roles | @RequirePermission | Query / Body | Respuesta | Errores de dominio |
|---|---|---|---|---|---|---|
| GET | `/usuarios` | AP, SA | `usuarios_plaza.listar` \| `inquilinos.listar` | `ListUsuariosQuerySchema`: `page, pageSize≤100, rol?, activo? (⚠️ ignorado), search?` | Paginado `UsuarioOutput & {rolStaffActivo, rolStaffNombre}` (solo no deshabilitados, orden nombre) | `PLAZA_SCOPE_VIOLATION` |
| POST | `/usuarios` | AP, SA | `usuarios_plaza.crear` \| `inquilinos.alta_usuario` | `CreateUsuarioSchema` | 201 `UsuarioOutput` | `ROL_NO_PERMITIDO`, `INQUILINO_REQUERIDO`, `ROL_STAFF_REQUERIDO`, `INQUILINO_NOT_FOUND`(400), `ROL_STAFF_NO_EXISTE`, `USUARIO_EMAIL_DUPLICADO`(409) |
| GET | `/usuarios/:id` | AP, SA | `usuarios_plaza.listar` \| `inquilinos.listar` | — | `UsuarioOutput & {rolStaffActivo, rolStaffNombre}` (incluye deshabilitados) | `USUARIO_NO_ENCONTRADO`(404) |
| PATCH | `/usuarios/:id` | AP, SA | `usuarios_plaza.editar` \| `inquilinos.editar` | `UpdateUsuarioSchema` (solo `nombre`, `telefono` se aplican) | `UsuarioOutput` | `USUARIO_NO_ENCONTRADO` |
| DELETE | `/usuarios/:id` | AP, SA | `usuarios_plaza.deshabilitar` \| `inquilinos.deshabilitar_usuario` | body opcional `{motivo}` (`DisableUsuarioSchema`) | 204 | `USUARIO_NO_ENCONTRADO`(404), `USUARIO_ROL_NO_PERMITIDO`(403), `ULTIMO_ADMIN_ACTIVO`(409) |
| POST | `/usuarios/:id/reset-password` | AP, SA | `usuarios_plaza.resetear_clave` \| `inquilinos.resetear_clave` | — | 200 `{id, email, message}` | `USUARIO_NO_ENCONTRADO`, `USUARIO_EMAIL_INVALIDO`(409) |
| POST | `/usuarios/:id/reactivate` | AP, SA | `usuarios_plaza.reactivar` \| `inquilinos.reactivar_usuario` | — | 201 `UsuarioOutput` | `USUARIO_NO_INACTIVO`(409), `USUARIO_ROL_NO_PERMITIDO`(403) |
| POST | `/usuarios/:id/reset-email-invalido` | AP, SA | `usuarios_plaza.editar` \| `inquilinos.editar` | — | 201 `UsuarioOutput` | `USUARIO_NO_ENCONTRADO` |
| GET | `/roles-staff` | (ninguno) | `roles_staff.listar` | `ListRolesStaffQuerySchema`: `page, pageSize, activo?, search?` (código/nombre) | Paginado `RolStaffOutput` | — |
| GET | `/roles-staff/con-asignaciones` | AP, SA | `roles_staff.listar` | — | `Array<RolStaffOutput & {usuariosAsignados}>` | — |
| POST | `/roles-staff` | AP, SA | `roles_staff.crear` | `CreateRolStaffSchema` | 201 `RolStaffOutput` | `ROL_STAFF_CODIGO_DUPLICADO`(409) |
| GET | `/roles-staff/:id` | (ninguno) | `roles_staff.listar` | — | `RolStaffOutput` | `ROL_STAFF_NO_ENCONTRADO`(404) |
| PATCH | `/roles-staff/:id` | AP, SA | `roles_staff.editar` | `UpdateRolStaffSchema` | `RolStaffOutput` | `ROL_STAFF_NO_ENCONTRADO`; renombrar rol sistema → error de trigger (⚠️ verificar status, probablemente 500) |
| DELETE | `/roles-staff/:id` | AP, SA | `roles_staff.deshabilitar` | — | 200 `{rol: RolStaffOutput, usuariosAsignados}` | `ROL_STAFF_NO_ENCONTRADO` |
| GET | `/permisos` | AP, SA | `permisos.ver_matriz` | — | `{total, modulos:[{modulo, permisos:[{id,codigo,modulo,accion,descripcion,createdAt}]}]}` | — |
| GET | `/permisos/roles/:rolStaffId` | AP, SA | `permisos.ver_matriz` | — | `{rolStaffId, esSistema, permisos: PermisoOutput[]}` | `ROL_STAFF_NO_ENCONTRADO`(404) |
| PUT | `/permisos/roles/:rolStaffId` | AP, SA | `roles_staff.gestionar_permisos` \| `permisos.asignar_a_roles` | `{permisoIds: uuid[] (≤500)}` | 200 `RolPermisosOutput` | `ROL_SISTEMA_NO_MODIFICABLE`(**403**), `PERMISO_NO_ENCONTRADO`(404), `ROL_STAFF_NO_ENCONTRADO` |
| POST | `/permisos/roles/:rolStaffId/permisos/:permisoId` | AP, SA | ídem PUT | — | 201 `RolPermisosOutput` | ídem |
| DELETE | `/permisos/roles/:rolStaffId/permisos/:permisoId` | AP, SA | ídem PUT | — | 200 `RolPermisosOutput` | `ROL_SISTEMA_NO_MODIFICABLE`, `ROL_STAFF_NO_ENCONTRADO` |
| POST | `/categorias` | AP, SA | `categorias.crear` | `CreateCategoriaSchema` | 201 `CategoriaOutput` | `CATEGORIA_NOMBRE_DUPLICADO`(409) |
| GET | `/categorias` | AP, SA, IN | `categorias.listar` | `ListCategoriasQuerySchema`: `page, pageSize, activo?, search?` (nombre) | Paginado `CategoriaOutput` (IN: solo activas) | — |
| GET | `/categorias/:id` | AP, SA, IN | `categorias.listar` | — | `CategoriaDetailOutput` (subcategorías activas) | `CATEGORIA_NOT_FOUND`(404) |
| PATCH | `/categorias/:id` | AP, SA | `categorias.editar` | `UpdateCategoriaSchema` | `CategoriaOutput` | `CATEGORIA_NOT_FOUND`, `CATEGORIA_HAS_ACTIVE_SUBCATEGORIAS`(400), `CATEGORIA_NOMBRE_DUPLICADO` |
| DELETE | `/categorias/:id` | AP, SA | `categorias.deshabilitar` | — | 200 `CategoriaOutput` (activo=false) | `CATEGORIA_NOT_FOUND`, `CATEGORIA_HAS_ACTIVE_SUBCATEGORIAS`(400) |
| POST | `/categorias/:id/subcategorias` | AP, SA | `subcategorias.crear` | `CreateSubcategoriaSchema` | 201 `SubcategoriaDetailOutput` | `CATEGORIA_NOT_FOUND`, `RESPONSABLE_INVALIDO`/`SUPERVISOR_INVALIDO`(422), `SUBCATEGORIA_MAX_5_SUPERVISORES`(409), `SUBCATEGORIA_NOMBRE_DUPLICADO`(409) |
| GET | `/categorias/:id/subcategorias` | AP, SA, IN | `categorias.listar` | `ListSubcategoriasQuerySchema`: `page, pageSize, activo?, search?` | Paginado `SubcategoriaDetailOutput` (IN: solo activas) | `CATEGORIA_NOT_FOUND` |
| GET | `/categorias/:id/subcategorias/:subId` | AP, SA, IN | `categorias.listar` | — | `SubcategoriaDetailOutput` | `SUBCATEGORIA_NOT_FOUND` |
| PATCH | `/categorias/:id/subcategorias/:subId` | AP, SA | `subcategorias.editar` | `UpdateSubcategoriaSchema` | `SubcategoriaDetailOutput` | `SUBCATEGORIA_NOT_FOUND`, `SUBCATEGORIA_NOMBRE_DUPLICADO` |
| DELETE | `/categorias/:id/subcategorias/:subId` | AP, SA | `subcategorias.deshabilitar` | — | 200 `SubcategoriaDetailOutput` (activo=false) | `SUBCATEGORIA_NOT_FOUND` |
| PATCH | `/categorias/:id/subcategorias/:subId/responsable` | AP, SA | `subcategorias.asignar_responsable` | `{responsableId}` | `SubcategoriaDetailOutput` | `SUBCATEGORIA_NOT_FOUND`, `RESPONSABLE_INVALIDO`(422) |
| POST | `/categorias/:id/subcategorias/:subId/supervisores` | AP, SA | `subcategorias.gestionar_supervisores` | `{usuarioId}` | 201 `SubcategoriaDetailOutput` (idempotente) | `SUPERVISOR_INVALIDO`(422), `SUBCATEGORIA_MAX_5_SUPERVISORES`(409) |
| DELETE | `/categorias/:id/subcategorias/:subId/supervisores/:usuarioId` | AP, SA | `subcategorias.gestionar_supervisores` | — | 200 `SubcategoriaDetailOutput` | `SUPERVISOR_NOT_FOUND`(404) |
| GET | `/solicitudes/tipos` | AP, SA, IN | `tipos_solicitud.listar` | — | `SolicitudTipoConfigOutput[]` (solo activos) | — |
| GET | `/admin/tipos-solicitud` | AP, SA | `tipos_solicitud.listar` | `page, pageSize, activo?` | Paginado `SolicitudTipoConfigOutput` | — |
| GET | `/admin/tipos-solicitud/:id` | AP, SA | `tipos_solicitud.listar` | — | `SolicitudTipoConfigOutput` | `TIPO_NOT_FOUND`(404) |
| PATCH | `/admin/tipos-solicitud/:id` | AP, SA | `tipos_solicitud.editar` | `UpdateSolicitudTipoConfigSchema` | `SolicitudTipoConfigOutput` | `TIPO_INMUTABLE`(409), `TIPO_CON_SOLICITUDES_ACTIVAS`(409) |
| GET | `/configuracion` | **AP** | `configuracion.ver` | — | `Configuracion` | `CONFIGURACION_NOT_FOUND`(404), `PLAZA_REQUERIDA`(400) |
| PATCH | `/configuracion` | **AP** | `configuracion.editar_general` \| `editar_branding` \| `editar_sla` \| `editar_adjuntos` \| `editar_calendario` | `UpdateConfiguracionSchema` (parcial) | `Configuracion` | `MIME_NO_PERMITIDO`(400), `CONFIGURACION_NOT_FOUND` |
| GET | `/plazas/:id` | SA, AP | — | — | `PlazaOutput` (`logoUrl` pre-firmada 15 min) | `PLAZA_SCOPE_VIOLATION`(403, AP otra plaza), `PLAZA_NOT_FOUND` |
| PATCH | `/plazas/:id` | SA, AP | — (⚠️ sin permiso granular) | `UpdatePlazaSchema` | `PlazaOutput` | `PLAZA_SCOPE_VIOLATION`, `PLAZA_NOT_FOUND` |
| POST | `/plazas/:id/logo` | SA, AP | — (⚠️ sin permiso granular) | multipart `file` (PNG/SVG ≤2 MB) | 201 `PlazaOutput` | `LOGO_REQUERIDO`(400), `ADJUNTO_MIME_INVALIDO`(400), `ADJUNTO_DEMASIADO_GRANDE`(413), `PLAZA_SCOPE_VIOLATION` |

Errores transversales posibles en todos: `400 VALIDATION_ERROR` (Zod; `detail` es **array de strings** `"campo: mensaje"`, `meta.issues`), `400` de `ParseUUIDPipe` en `:id` no-UUID, `403 ROLE_FORBIDDEN`, `403 PERMISSION_DENIED` (`meta.permisosRequeridos`), `403 PLAZA_SCOPE_VIOLATION`.

---

#### 5.2.4 Schemas Zod (contracts) — resumen de reglas

| Schema | Reglas |
|---|---|
| `CreateUsuarioSchema` | `email` (trim, lowercase, email ≤254), `password` (`PasswordSchema`: 8..128, ≥1 minúscula, ≥1 mayúscula, ≥1 dígito), `nombre` 1..120, `telefono?` ≤40, `rol` ∈ superadmin\|admin_plaza\|inquilino, `rolStaffId?` uuid, `inquilinoId?` uuid |
| `UpdateUsuarioSchema` | `nombre?` 1..120, `telefono?` ≤40\|null, `rolStaffId?` uuid\|null, `activo?` bool (los dos últimos ignorados por el backend) |
| `ListUsuariosQuerySchema` | Pagination + `rol?`, `activo?` (string bool), `search?` 1..100 |
| `DisableUsuarioSchema` | `motivo?` 3..500 |
| `UsuarioOutputSchema` | `id, email, nombre, telefono|null, rol, rolStaffId|null, inquilinoId|null, plazaId|null, emailInvalido, lastLoginAt|null, createdAt, deletedAt|null` |
| `CreateRolStaffSchema` | `codigo` 2..40 `^[a-z0-9-]+$` (lowercase), `nombre` 1..80, `descripcion?` ≤500 |
| `UpdateRolStaffSchema` | `nombre?` 1..80, `descripcion?` ≤500\|null, `activo?` |
| `RolStaffOutputSchema` | `id, plazaId, codigo, nombre, descripcion|null, activo, createdAt, updatedAt` |
| `AsignarPermisosInputSchema` | `permisoIds: uuid[]` máx 500 |
| `PermisoOutputSchema` / `ListarPermisosOutputSchema` / `RolPermisosOutputSchema` | ver tabla §5.2.3 |
| `CreateCategoriaSchema` | `nombre` 1..80, `descripcion?` ≤500 |
| `UpdateCategoriaSchema` | `nombre?`, `descripcion?` ≤500\|null, `activo?` |
| `CreateSubcategoriaSchema` | `nombre` 1..80, `descripcion?` ≤500, `responsableId` uuid, `prioridad` A\|B\|C\|D\|F (default B), `supervisorIds` uuid[] ≤5 (default []) |
| `UpdateSubcategoriaSchema` | `nombre?`, `descripcion?`\|null, `prioridad?`, `activo?` |
| `SetResponsableSubcategoriaSchema` | `{responsableId: uuid}` |
| `AddSupervisorSubcategoriaSchema` | `{usuarioId: uuid}` |
| `CategoriaOutput` / `SubcategoriaOutput` / `SubcategoriaDetailOutput` / `CategoriaDetailOutput` | Categoría: `id, plazaId, nombre, descripcion, activo, createdAt, updatedAt`. Subcategoría: `id, plazaId, categoriaId, responsableId, nombre, descripcion, prioridad, activo, supervisorIds[], createdAt, updatedAt` + detalle `responsable {id,nombre,email}|null`, `supervisores[{id,nombre,email}]`. Detalle de categoría añade `subcategorias: SubcategoriaDetailOutput[]` |
| `UpdateSolicitudTipoConfigSchema` | `etiqueta?` 1..80, `descripcion?` ≤500\|null, `activo?`, `orden?` int 0..99 |
| `SolicitudTipoConfigOutputSchema` | `id, plazaId, codigo, etiqueta, descripcion|null, activo, orden, createdAt, updatedAt` |
| `ConfiguracionSchema` / `UpdateConfiguracionSchema` | ver §5.2.2.6 (`Update` = `.partial()`) |
| `UpdatePlazaSchema` | `nombreComercial?` 1..120, `emailContacto?` email\|null, `telefonoContacto?` ≤40\|null, `colorPrimario?` `#RRGGBB` |
| `PlazaOutputSchema` | `id, slug, nombreComercial, emailContacto|null, telefonoContacto|null, logoUrl|null, colorPrimario, timezone ('America/El_Salvador'), createdAt, updatedAt, deletedAt|null` |

---

> Todas las rutas backend llevan el prefijo `/api/v1`, la cabecera `Authorization: Bearer <access>` y, si el usuario es superadmin con una plaza elegida, `x-plaza-id: <uuid>`. Los errores siguen RFC 7807: `{type,title,status,detail,instance,code,requestId,meta?}`. **El texto legible va en `detail`, no en `message`** (ver C-R1 en §7.8).
> Archivo:línea citados = `backend/src/modules/...`.

---

### 5.3 Campana de notificaciones in-app (topbar)

**Quién la ve:** `admin_plaza` e `inquilino`. **No** se muestra para superadmin, ni siquiera al impersonar (`topbar.tsx`: `role !== 'superadmin'`). No requiere permiso granular: es la bandeja propia del usuario.

**Fuentes:** `components/shell/notifications-bell.tsx`, `lib/server/notificaciones-inbox-actions.ts`, contrato `notificaciones/inapp.ts`, service `notificaciones-inapp.service.ts`.

| Acción UI | Endpoint backend (controller) | Detalle |
|---|---|---|
| Contador (badge) | `GET /notificaciones/inbox/conteo` (notificaciones.controller.ts:96) | Respuesta `{ noLeidas: number }`. **Polling cada 45 s** (`POLL_MS = 45_000`), solo con la pestaña visible (`visibilitychange`); hay un primer conteo inmediato al montar y otro al volver a la pestaña. Badge: `"9+"` si es mayor que 9; oculto si es 0. |
| Abrir el popover | `GET /notificaciones/inbox?limit=20` (:85) | Query `NotificacionesInboxQuerySchema`: `limit` int 1..50, por defecto 20. Respuesta `{ items: NotificacionOutput[], noLeidas }`, ordenada por `created_at desc`. Se recarga cada vez que se abre. |
| Clic en un ítem | `POST /notificaciones/inbox/:id/leer` (:113), HTTP 200 | Optimista: marca leída en local y resta 1 al contador; luego navega. Devuelve la `NotificacionOutput` actualizada. Es idempotente: si ya estaba leída, devuelve 200 igual. 404 `NOTIFICACION_NO_ENCONTRADA`. `:id` debe ser un UUID (`ParseUUIDPipe`). |
| "Marcar todas como leídas" (visible solo si `noLeidas > 0`) | `POST /notificaciones/inbox/leer-todas` (:104), HTTP 200 | Respuesta `{ actualizadas: number }`. Optimista; si falla, vuelve a pedir el conteo. |

Guards: `@Roles('admin_plaza','inquilino')`, sin `@RequirePermission`. Sin plaza en el JWT → 400 `PLAZA_SCOPE_VIOLATION`; superadmin → 403 `ROLE_FORBIDDEN`.

**`NotificacionOutput`:** `{ id, tipo, titulo, mensaje, solicitudId|null, contratoId|null, leida: boolean, createdAt: ISO }`.

**Tipos (`NOTIFICACION_TIPOS`), ícono lucide y tono (para replicar):**

| tipo | ícono | tono | título (generado por el backend) |
|---|---|---|---|
| solicitud_asignada | UserCheck | info | "Se te asignó una solicitud" |
| solicitud_nueva_supervisor | Users | info | "Nueva solicitud en tu subcategoría" |
| solicitud_reasignada | ArrowLeftRight | info | "Te reasignaron una solicitud" |
| solicitud_desasignada | ArrowLeftRight | neutral | "Solicitud reasignada a otro administrador" |
| solicitud_en_revision | Eye | info | "Tu solicitud está en revisión" |
| solicitud_aprobada | CheckCircle2 | ok | "Solicitud aprobada" |
| solicitud_rechazada | XCircle | danger | "Solicitud rechazada" |
| solicitud_subsanacion | Wrench | warn | "Tu solicitud requiere correcciones" |
| solicitud_cerrada | Flag | violet | "Solicitud cerrada" |
| solicitud_pausada | PauseCircle | warn | "Solicitud en pausa" |
| solicitud_reanudada | PlayCircle | info | "Solicitud reanudada" |
| solicitud_liberada | RotateCcw | neutral | "Solicitud de vuelta en la cola" |
| solicitud_cancelada | Ban | neutral | "Solicitud cancelada" |
| solicitud_reenviada | Send | info | "Solicitud corregida y reenviada" |
| comentario_nuevo | MessageSquare | violet | "Nuevo comentario" |
| contrato_por_vencer | FileWarning | warn | "Contrato por vencer en {30\|7} días" |

- **Formato de `mensaje`:** `"<codigo> · <titulo> — <frase>"`, por ejemplo `SOL-acme-42 · Fuga — fue aprobada.`. Puede llevar un detalle añadido (motivo o comentario, sin HTML, recortado a 140 caracteres). Para `contrato_por_vencer` el formato es `"Local <cod> · <razón social> — vence el dd-mm-yyyy."`, lo genera el cron diario de las 9:00 hora de El Salvador para las ventanas de 30 y 7 días, y va dirigido a todos los admins de la plaza.
- El backend nunca notifica al usuario que causó el evento (`actorId`) y solo notifica a usuarios activos de esa plaza.
- Retención: un cron borra las notificaciones con más de 90 días (a las 03:00 hora de El Salvador).

**Navegación al tocar (`hrefFor`):**
- Si tiene `solicitudId`: el inquilino va a `/inquilino/solicitudes/{id}` y el admin a `/admin/solicitudes/{id}`.
- Si no, y tiene `contratoId`: va a `/admin/contratos/{id}`.
- Si no tiene ninguno de los dos: no navega.

**Hora mostrada:**
- Hasta 7 días: tiempo relativo en español (`Intl.RelativeTimeFormat('es')`), por ejemplo "hace un momento" (menos de 45 s), "hace 5 minutos", "ayer".
- Más de 7 días: `dd/MM/yyyy h:mm am|pm` en America/El_Salvador.
- El tooltip siempre muestra la fecha absoluta.

**Estados de la lista:**
- Cargando: "Cargando…".
- Vacío: ícono Inbox y "No tienes notificaciones".
- Error: ícono BellOff y el mensaje de error.
- Cabecera: "N sin leer" o "Estás al día".

---

### 5.4 `/admin/notificaciones` — Log de emails y desuscripciones

- **Rol:** `admin_plaza`, o superadmin con plaza seleccionada (el layout de `/admin/*` muestra la pantalla "Selecciona una plaza" si el superadmin no tiene una elegida).
- **Permiso:** la página solo se protege en la sidebar (`notificaciones.ver_log`); la página en sí no verifica permisos. Los botones no usan `<Can>`; las Server Actions sí llaman a `assertAnyCan` con el permiso de cada acción.
- **Propósito:** consultar los emails transaccionales encolados, enviados o fallidos, reintentar los fallidos, ver el HTML renderizado y resetear desuscripciones.

**Datos que carga (en paralelo):**

| Bloque | Endpoint | Query |
|---|---|---|
| Log | `GET /notificaciones` (:154). Requiere `@Roles(admin_plaza, superadmin)` y `notificaciones.ver_log`. | `ListEmailLogQuerySchema` (paginación más filtros); la web envía `page`, `pageSize=20`, `estado`, `plantilla`, `destinatario`, `fechaDesde`, `fechaHasta`. Respuesta paginada: `{items: EmailLogOutput[], total, page, pageSize, totalPages}`, ordenada por `created_at desc`. |
| Desuscripciones | `GET /notificaciones/unsubscribes?page=1&pageSize=50` (:124). Requiere `notificaciones.gestionar_desuscripciones`. | `ListUnsubscribesQuerySchema`: paginación más `email?` (contains, 1..254 caracteres). La UI no usa el filtro `email` y solo muestra los primeros 50, sin paginar. |

**Filtros** (se guardan en la URL y se aplican al cambiar):

| Campo | Valores | Param backend | Regla backend |
|---|---|---|---|
| Estado | Todos / `pendiente` / `enviado` / `fallido` | `estado` | igualdad |
| Plantilla | Todas o una de `EMAIL_PLANTILLAS`: `solicitud-asignada-responsable`, `solicitud-nueva-supervisor`, `solicitud-recibida`, `solicitud-aprobada`, `solicitud-rechazada`, `solicitud-subsanacion`, `solicitud-reasignada`, `reset-password`, `bienvenida`, `contrato-por-vencer` | `plantilla` | `contains`, sin distinguir mayúsculas (1..80) |
| Destinatario | texto libre (se aplica con submit o blur) | `destinatario` | `contains`, sin distinguir mayúsculas |
| Desde / Hasta | date `YYYY-MM-DD` | `fechaDesde` / `fechaHasta` | `created_at >= D 00:00Z` y `< H+1d 00:00Z` (días UTC, ver C-R8) |
| Botón "Limpiar" | borra todos los filtros | — | — |

**`EmailLogOutput`:** `{id, plazaId, solicitudId, solicitudCodigo, destinatario, plantilla, estado, reintentos, lastError, nextRetryAt, sentAt, createdAt}`.

**Columnas** (se presentan con `ResponsiveDataView`):
- Destinatario (columna principal).
- Solicitud (`solicitudCodigo`, o "—").
- Plantilla (monoespaciada con ícono Mail).
- Estado: badge `pendiente` → `b-warn`, `enviado` → `b-ok`, `fallido` → `b-danger`; el tooltip muestra `lastError`.
- Reintentos.
- Creado y Enviado (`dd/MM/yyyy h:mm am|pm` en la TZ de la plaza, o "—").
- Acciones.

**Acciones:**

| Botón | Visible | Endpoint | Payload / resultado | Errores |
|---|---|---|---|---|
| "Ver" (ícono Eye) | siempre | `GET /notificaciones/:id/preview` (:166). Requiere `notificaciones.ver_preview`. | Respuesta `EmailLogPreview {subject, html}`. Se abre un modal con título = `subject`, "Para: destinatario" e iframe sandbox con el HTML. | 404 `EMAIL_LOG_NO_ENCONTRADO` |
| "Reintentar" (RefreshCw) | `estado === 'fallido'` y `plantilla !== 'reset-password'` | `POST /notificaciones/:id/reintentar` (:175). Requiere `notificaciones.reintentar`. Sin body. | Devuelve el `EmailLogOutput` ya con `estado: pendiente`, `reintentos: 0`, `nextRetryAt: now`; lo procesa el worker. Sin confirmación. | 400 `EMAIL_NO_REINTENTABLE` si el estado no es fallido o la plantilla es reset-password; 404 |
| "Resetear" (por desuscripción) | siempre | `DELETE /notificaciones/unsubscribes/:id` (:136). Requiere `notificaciones.gestionar_desuscripciones`. HTTP 204. | Vuelve a habilitar esa plantilla para ese email. **Sin confirmación** en la web. | 404 `UNSUBSCRIBE_NO_ENCONTRADO` |

- Cada fila de desuscripción muestra `email · plantilla (YYYY-MM-DD)`.
- Vacíos: "Sin emails / No hay emails con esos criterios." y "No hay desuscripciones registradas.".
- Los errores aparecen en un banner rojo sobre la tabla.
- Endpoint público relacionado, que no es una pantalla de la app: `GET /notificaciones/unsubscribe?token=…` (:54) devuelve HTML. Es el enlace del pie de los emails y la app no lo necesita.

---

### 5.5 Calendario — `/admin/calendario` y `/inquilino/calendario`

**Rol y permiso:** se ve en la sidebar con `calendario.ver` (admin) y siempre para el inquilino. Backend: `@Roles('admin_plaza','inquilino')` + `calendario.ver` (calendario.controller.ts:39). **El superadmin queda excluido por `@Roles`** (ver C-R2).

**Datos iniciales de la página:**

| Rol | Endpoints | Uso |
|---|---|---|
| admin | `GET /locales?page=1&pageSize=100`, `GET /inquilinos?page=1&pageSize=100`, `GET /configuracion` | Opciones de los filtros Local (`codigo`) e Inquilino (`razonSocial`), y el flag `calendarMostrarHitosContrato`, que oculta el checkbox de hitos. Si `/configuracion` falla, se asume `true`. |
| inquilino | `GET /contratos?estado=vigente&page=1&pageSize=100` | Locales de sus contratos vigentes (sin duplicados, label = `localCodigo`). El checkbox de hitos siempre se muestra, pero el backend sigue aplicando el flag. |

**Feed:** `GET /calendario` (:39), query `CalendarioQuerySchema`:

| Param | Formato | Notas |
|---|---|---|
| `from`, `to` | ISO con offset (`2026-09-28T00:00:00-06:00`) o fecha `YYYY-MM-DD` | Obligatorios. Si `to <= from` → 400 `RANGO_INVALIDO`. FullCalendar envía el rango visible. |
| `localId` | UUIDs separados por coma | Filtro opcional. |
| `inquilinoId` | UUIDs separados por coma | Filtro opcional; en la web solo lo ofrece el admin, y para el inquilino el backend lo fuerza a su `inquilinoId`. |
| `tipo` | CSV de `evento,mantenimiento,hito_contrato,solicitud` | Si se omite, se devuelven los 4 tipos. La web lo omite cuando están todos marcados. |

Respuesta: un array `CalendarioEventoOutput` (sin paginar):
```
{ id: "evt-<uuid>"|"mnt-<localId>"|"cto-<contratoId>"|"sol-<solicitudId>",
  title, start: ISO, end: ISO|null, color: "#hex", allDay?: boolean,
  extendedProps: { tipo, solicitudId?, solicitudCodigo?, localId?, localCodigo?, inquilinoId?,
                   contratoId?, choque?: boolean, estado?: SolicitudEstado, prioridad?: 'A'..'F' } }
```

| tipo | Origen | title | Color | allDay |
|---|---|---|---|---|
| `evento` | `evento_calendario` activo, creado al aprobar una solicitud de evento; incluye los de solicitudes `cerrada` | `"<codigo> · <titulo>"` (máx. 80 caracteres) | el de la fila (por defecto `#10b981`) | no |
| `mantenimiento` | Local en estado `en_mantenimiento` con ventana `fecha_inicio/fin_mantenimiento`; se enlaza a la última remodelación `aprobada`/`cerrada` del local | `"<codigo> · Mantenimiento · <local>"` o `"Mantenimiento · <local>"` | `#f59e0b` | sí (fechas `YYYY-MM-DD`) |
| `hito_contrato` | Contratos `vigente` cuya `fecha_fin` cae **en los próximos 30 días desde hoy** (intersectado con el rango pedido). Solo aparece si `configuracion.calendar_mostrar_hitos_contrato`. | `"Vence contrato · <local> (<razón social>)"` | `#8b5cf6` | sí, `end: null` |
| `solicitud` | Todas las solicitudes con `fecha_evento_inicio` que caen en el rango, de cualquier tipo y estado. Admin: toda la plaza; inquilino: solo las suyas. Se excluyen las que ya aparecen como `evento`. | `"<codigo> · <titulo>"` | depende del estado: borrador `#9ca3af`, enviada `#3b82f6`, asignado `#6366f1`, en_revision `#f59e0b`, requerida_subsanacion `#f97316`, pausada `#06b6d4`, aprobada `#10b981`, cerrada `#8b5cf6`, rechazada `#ef4444`, cancelada `#6b7280` | no. `start`/`end` = fecha más `hora_inicio`/`hora_fin` en la hora de la plaza (UTC-6), convertida a UTC. |

- **Choques:** el backend marca `choque: true` en los items `evento` del mismo local cuyos rangos `[start, end)` se solapan. La web los pinta con borde `#dc2626` y en el modal muestra "⚠️ Este evento se solapa con otro en el mismo local.".
- **Colores de leyenda en la UI:**

  | Tipo | Color | Etiqueta |
  |---|---|---|
  | `evento` | #10b981 | "Eventos aprobados" |
  | `mantenimiento` | #f59e0b | "Mantenimientos" |
  | `hito_contrato` | #8b5cf6 | "Hitos contractuales" |
  | `solicitud` | #a78bfa | "Solicitudes" para el admin; "Mis solicitudes" para el inquilino |

- **Formato de la UI:**
  - Horas siempre en 12 h (`"2:00 pm"`, también en el rango `"2:00 pm – 4:00 pm"` y en las etiquetas de los slots).
  - En cada evento el número de solicitud va en negrita antes del título.
  - Locale `es`.
  - Vistas: mes, semana, día y lista semanal. En pantallas de menos de 768 px arranca en `listWeek`.
  - Vista semana con `eventMaxStack 1`, vista día con 4, `dayMaxEventRows 4`.
  - Selector "Zona horaria": "Mi zona horaria" (la del dispositivo) o "Zona de la plaza (GMT-6)" = `America/El_Salvador` (param de URL `tz=plaza`).
  - Recarga automática cada 5 min y al cambiar filtros.
- **Modal de detalle al tocar un evento:**
  - aviso de choque, si aplica;
  - "N.º solicitud: CODIGO";
  - rango `dd/MM/yyyy h:mm am – …`; los eventos de día completo muestran "(todo el día)" y su `end` es exclusivo;
  - "Local: X" y "Tipo: …";
  - "Estado:" con badge, si hay `estado`;
  - botón "Ver solicitud CODIGO", que lleva a `/admin/solicitudes/{id}` o `/inquilino/solicitudes/{id}`.
- **Solo admin — arrastrar y redimensionar:** solo se pueden mover items `tipo === 'evento'` con `estado !== 'cerrada'`.
  - Endpoint: `PATCH /calendario/eventos/:id/fechas` (:78). Requiere `@Roles('admin_plaza')` y `calendario.mover_evento`.
  - `:id` es el UUID sin el prefijo `evt-`.
  - Body `MoverEventoFechasSchema`: `{ inicio, fin }`, ISO datetime con offset, con `fin > inicio`.
  - Respuesta: el `CalendarioEventoOutput` actualizado. Además actualiza `fecha_evento_*` y `hora_*` de la solicitud, añade una entrada "comentario" al historial y registra auditoría. No cambia el estado.
  - Errores: 404 `EVENTO_NO_ENCONTRADO`, 409 `EVENTO_CERRADO`, 403 `FORBIDDEN_ROLE` (inquilino).
  - Si falla, la web revierte el arrastre y muestra el error en un banner.
- **Solo inquilino — crear desde un slot:**
  - Al tocar un hueco vacío, el cliente comprueba si se solapa con un item `evento` ya cargado (1 h, o el día entero si es de día completo).
  - Si se solapa: aviso "Ya hay un evento aprobado en este horario. Elige otro slot del calendario.".
  - Si no: el botón "Crear solicitud de evento" abre `/inquilino/solicitudes/nueva?tipo=evento&fecha=YYYY-MM-DD[&hora=HH:mm]`.
  - Hay además un botón fijo "Nueva solicitud de evento".
- **Exportar iCal** (los dos roles), botón "Exportar iCal":
  - En la web es un route handler BFF, `GET /api/calendario/export.ics?localId=…`, que hace de proxy de **`GET /calendario/export.ics`** (:50). Requiere `@Roles(admin_plaza, inquilino)` y `calendario.exportar_ics`.
  - Query `IcsQuerySchema`: `localId?` (CSV de UUIDs) y `tipo?` (CSV). **El backend ignora `tipo`**: siempre exporta solo `evento_calendario`. La web solo envía `localId`.
  - **No hay filtro de fechas**: exporta todos los eventos.
  - Respuesta: `text/calendar; charset=utf-8`, `Content-Disposition: attachment; filename="plazapp-<slug>.ics"`. Cumple RFC 5545 (CRLF, folding a 75 octetos, fechas en UTC `YYYYMMDDTHHMMSSZ`, `UID evt-<id>@plazapp`, `DESCRIPTION` con la URL web del detalle).
- **Choques en endpoint propio:** `GET /calendario/choques?from&to&localId` (:67) con `calendario.choques.ver` devuelve `ChoqueOutput[] {localId, localCodigo, eventoAId, eventoBId}`. **La web no lo usa** porque los choques ya vienen marcados en el feed.

---

### 5.6 `/admin/reportes` — Generador de reportes

- **Rol:** admin_plaza, o superadmin con plaza seleccionada.
- **Permiso:** la sidebar exige `reportes.dashboard.ver` (la página no lo verifica). Previsualizar llama a `assertAnyCan(['reportes.preview'])`. Generar no se verifica en el front; lo hace el backend.
- **Datos iniciales:** `GET /locales?page=1&pageSize=100`, `GET /inquilinos?page=1&pageSize=100`, `GET /solicitudes/tipos` (tipos activos de la plaza: `codigo` y `etiqueta`, requiere `tipos_solicitud.listar`).

**Selectores:** Entidad, filtros según la entidad y Formato.

- Entidad: `solicitudes` | `locales` | `inquilinos`. Al cambiarla se borran los filtros y la previsualización.
- Formato: `csv` | `xlsx` | `pdf`.

| Entidad | Filtros en la UI (param) | Schema backend |
|---|---|---|
| solicitudes | `estado` (los 10 estados, con etiqueta en español), `tipo` (tipos de la plaza), `localId`, `inquilinoId`, `fechaDesde`, `fechaHasta` | `ReporteSolicitudesFiltrosSchema`: los anteriores más **`prioridad` (A..F), que la UI no expone**; las fechas son `YYYY-MM-DD` |
| locales | `estado`: `disponible` / `alquilado` / `en_mantenimiento` / `fuera_de_servicio` | `ReporteLocalesFiltrosSchema` |
| inquilinos | `search` (razón social, 1..120 caracteres) | `ReporteInquilinosFiltrosSchema` |

**Reglas del backend:**
- El filtro de fecha de solicitudes se aplica sobre `created_at`. Sin fechas, toma los últimos 365 días. Si el rango supera unos 12 meses → **413 `RANGO_EXCEDIDO`**; esta regla también se aplica en la previsualización.
- XLSX y PDF tienen un tope de 10 000 filas → **413 `REPORTE_DEMASIADO_GRANDE`**. El CSV no tiene tope.
- Una entidad inválida devuelve 400 `ENTIDAD_INVALIDA`; filtros inválidos, 400 `FILTROS_INVALIDOS`.
- Los exports exigen plaza: el superadmin sin plaza recibe 403 `PLAZA_SCOPE_VIOLATION`.
- Si jsreport falla → 502 `JSREPORT_ERROR`.

| Acción | Endpoint | Respuesta |
|---|---|---|
| "Previsualizar" | `GET /reportes/{entidad}/preview?<filtros>` (reportes.controller.ts:92). Requiere `reportes.preview`. | `{ items: Array<Record<string,unknown>> (primeros 10), total }`. La web arma una tabla con las claves del primer item como cabeceras. Título "Previsualización — primeros N de TOTAL registros"; vacío: "No hay registros con esos filtros.". |
| "Generar" (descarga) | En la web: `GET /api/reportes/export?entidad=&formato=&<filtros>`, que hace de proxy de `GET /reportes/{entidad}/export.{csv\|xlsx\|pdf}?<filtros>` (:105 / :124 / :144). Permisos `reportes.exportar_csv` / `_xlsx` / `_pdf`. | CSV: `text/csv; charset=utf-8` con BOM UTF-8, CRLF y escape RFC 4180. XLSX: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. PDF: `application/pdf`. Siempre `Content-Disposition: attachment; filename="<entidad>-YYYYMMDD.<fmt>"`. |

**Columnas de las filas, que son también las claves de la previsualización:**
- **solicitudes:** `codigo, tipo, titulo, local, estado, prioridad, enviadaAt, decisionAt, asignadoA`. Las fechas vienen como `"YYYY-MM-DD h:mm am|pm"` en la hora de la plaza.
- **locales:** `codigo, modulo, nivel, area, medidorEnergia, medidorAgua, estado, inquilino, contratoVence`.
- **inquilinos:** `razonSocial, identificacion, contacto, email, telefono, contratosVigentes, locales` (los locales separados por `" | "`).

**Otros elementos de la página y endpoints relacionados:**
- Hay un bloque fijo "Historial de reportes", que es un placeholder fuera del alcance de v1.
- Endpoints de reportes que no se usan en esta pantalla:
  - `GET /reportes/locales/:id/export.pdf` (`reportes.ficha_local_pdf`) y `GET /reportes/inquilinos/:id/export.pdf` (`reportes.ficha_inquilino_pdf`): la web **no** los llama desde ningún lado.
  - `GET /reportes/solicitudes/:id/permiso.pdf`: ver §4.3.3.4.

---

### 5.7 Dashboard — `/admin/dashboard` y `/superadmin/dashboard`

- **Rol:** admin_plaza ve `/admin/dashboard`; superadmin ve `/superadmin/dashboard` (global) y también `/admin/dashboard` cuando impersona.
- **Permiso:** el ítem del menú no exige permiso, pero los endpoints sí (ver C-R3).
- **Datos:** ambas pantallas comparten `DashboardContenido` y hacen 2 llamadas en paralelo:
  - `GET /reportes/kpis` (:35): `@Roles(admin_plaza, superadmin)` y `reportes.kpis.ver`.
  - `GET /reportes/dashboard` (:43): `reportes.dashboard.ver`.
- **Alcance de los datos:**
  - Superadmin **sin** `x-plaza-id`: agregado de todas las plazas.
  - Superadmin con plaza, o admin: solo la plaza.
- **Sin filtros ni rango configurable.** Se recarga cada 5 min (con el badge "Auto-refresh 5 min").
- Si cualquiera de las dos llamadas falla, la pantalla solo muestra el banner "No se pudieron cargar los KPIs.".

**`KpisOutput`:**
```
{ pendientes,                    // estados enviada|asignado|en_revision|requerida_subsanacion
  aprobadasHoy, rechazadasHoy,   // decision_at >= inicio del día de El Salvador; "aprobadas" = aprobada|cerrada
  eventosProximos7d,             // evento_calendario con inicio en [ahora, +7d]
  contratosPorVencer30d,         // vigentes con fecha_fin en [ahora, +30d]
  tasaAprobacion: number|null,   // aprobadas/(aprobadas+rechazadas) histórico, 2 decimales (0..1)
  tiempoMedioRespuestaHoras: number|null, // AVG(decision_at - enviada_at), 1 decimal
  solicitudesConSubsanacion,     // nº de solicitudes distintas con evento 'subsanada' en el historial
  top5Antiguedad: [{ id, codigo, titulo, enviadaAt }] }  // pendientes más antiguas
```

**`DashboardChartsOutput`:**
```
{ tendenciaMensual: [{ mes: "YYYY-MM", <estado>: number, ... }],  // últimos 6 meses por created_at; solo aparecen los estados con datos
  porTipo: [{ tipo, total }],
  porPrioridad: [{ prioridad: 'A'..'F', total }],
  actividadReciente: [{ id, solicitudId, solicitudCodigo, evento, usuario|null, createdAt }] } // últimas 10 entradas del historial
```

**Presentación:**
1. **5 tarjetas KPI:**

   | Tarjeta | Ícono | Tinte |
   |---|---|---|
   | Pendientes | Inbox | warn |
   | Aprobadas hoy | CheckCircle2 | ok |
   | Rechazadas hoy | XCircle | danger |
   | Eventos próximos (7d) | CalendarCheck | info |
   | Contratos por vencer (30d) | FileClock | violet |

2. **3 tarjetas:**
   - Tasa de aprobación: `round(x*100)%` con barra de progreso `--ok-fg`, o "—".
   - Tiempo medio de respuesta: "N h", o "—".
   - Solicitudes con subsanación.
3. **Gráfica de líneas** "Tendencia mensual por estado (últimos 6 meses)": una línea por estado. Colores: borrador #9ca3af, enviada #3b82f6, asignado #06b6d4, en_revision #f59e0b, requerida_subsanacion #f97316, pausada #22d3ee, aprobada #10b981, cerrada #8b5cf6, rechazada #ef4444, cancelada #6b7280.
4. **Barras** "Solicitudes por tipo", con relleno `--primary`.
5. **Dona** "Distribución por prioridad": A #e0463a, B #e8852c, C #d6a811, D #3f9e5a, F #7a8499; etiqueta "X: n".
6. **Listas:**
   - "Top 5 por antigüedad": código enlazado a `/admin/solicitudes/{id}` (el superadmin global no tiene enlace), título y `enviadaAt` (YYYY-MM-DD). Vacío: "Sin solicitudes pendientes.".
   - "Actividad reciente": código, evento con `_` cambiado por espacio, "· usuario" y fecha en la hora de la plaza. Vacío: "Sin actividad registrada.".

---

### 5.8 `/admin/auditoria` — Log de auditoría

- **Rol:** admin_plaza, o superadmin con plaza seleccionada.
- **Permiso:** la sidebar exige `auditoria.ver`. Backend: `GET /auditoria` (auditoria.controller.ts:22) con `@Roles(admin_plaza, superadmin)` y `auditoria.ver`. Solo lectura.
- **Query `ListAuditoriaQuerySchema`:**
  - `page`, `pageSize` (por defecto 20, máx. 100);
  - `accion` (contains, sin distinguir mayúsculas, 1..80);
  - `entidadTipo` (igualdad, 1..40);
  - `entidadId` y `usuarioId` (UUID; la UI no los expone);
  - `fechaDesde` / `fechaHasta` (`YYYY-MM-DD`, días UTC).

  El front valida los `searchParams` con el mismo schema y, si no son válidos, vuelve a `page=1, pageSize=20`.
- **Respuesta paginada** `{items: AuditoriaOutput[], total, page, pageSize, totalPages}`, ordenada por `created_at desc`. Cada `AuditoriaOutput` trae `{id, plazaId, usuarioId, usuario: {id,nombre,email}|null, accion, entidadTipo, entidadId, antes, despues, ip, userAgent, requestId, createdAt}`.
- **Alcance:** el admin ve su plaza. El superadmin sin plaza vería todo, incluidas las acciones de plataforma con `plaza_id` null, pero la web no lo permite (pide elegir plaza).
- **Filtros** (se aplican con el botón "Filtrar" o Enter; "Limpiar" los borra):
  - Acción: texto, placeholder "ej. local.update".
  - Tipo de entidad: select con `local, inquilino, contrato, solicitud, categoria, subcategoria, usuario, adjunto, plaza, configuracion`.
  - Desde / Hasta.
- **Columnas:**
  - Fecha y hora (`dd/MM/yyyy h:mm am|pm` en la TZ de la plaza; es la columna principal).
  - Usuario (nombre, o "sistema").
  - Acción: badge por sufijo — `.create` → b-ok, `.update` → b-info, `.delete` → b-danger, el resto → b-neutral.
  - Entidad (`tipo: id[0..8]`).
  - Botón "Detalle".
- **Modal "Detalle":**
  - Título: badge de la acción, entidad e id corto.
  - Subtítulo: fecha `dd/MM/yyyy h:mm:ss aaa`, seguida de `nombre <email>`, "usuario eliminado (id …)" o "acción del sistema".
  - Metadatos: entidad con enlace "Ver detalle", plaza (o "plataforma"), IP, User-Agent y Request ID.
  - Cambios:
    - con `antes` y `despues`: tabla Campo / Antes / Después que resalta las filas cambiadas;
    - con solo uno de los dos: JSON;
    - sin ninguno: "Esta entrada no tiene payload persistido (decorador omitirBody)".
- **Enlace "Ver detalle" según el tipo de entidad:**

  | Tipo de entidad | Ruta |
  |---|---|
  | local | `/admin/locales/{id}` |
  | inquilino | `/admin/inquilinos/{id}` |
  | contrato | `/admin/contratos/{id}` |
  | solicitud | `/admin/solicitudes/{id}` |
  | categoria, subcategoria | `/admin/categorias/{id}` |
  | usuario | `/admin/usuarios-plaza/{id}` |
  | plaza | `/superadmin/plazas/{id}` (⚠️ esa página no existe, ver C-R6) |

- Vacío: "Sin eventos / No hay eventos de auditoría que coincidan con esos filtros." Paginación con `Pager`.

---

### 5.9 Superadmin — `/superadmin/plazas` e impersonación

**`/superadmin/plazas`** (pantalla de inicio del superadmin). Solo superadmin; el layout lo verifica y el backend exige `@Roles('superadmin')`, sin permisos granulares.

- **Datos:** `GET /plazas?page=1&pageSize=50` (plazas.controller.ts:65). Query `ListPlazasQuerySchema`: paginación más `search?` (sobre slug o nombre, 1..100); la UI no ofrece búsqueda ni paginación. Respuesta paginada `{items: PlazaOutput[], total, page, pageSize, totalPages}`, solo plazas no eliminadas, ordenadas por `created_at desc`.
- **`PlazaOutput`:** `{id, slug, nombreComercial, emailContacto|null, telefonoContacto|null, logoUrl|null (URL pre-firmada de MinIO), colorPrimario "#RRGGBB", timezone: "America/El_Salvador", createdAt, updatedAt, deletedAt|null}`.
- **Columnas:**
  - Plaza: punto con `colorPrimario` y nombre.
  - Slug.
  - Contacto (`emailContacto` o "—").
  - Creada (`dd/MM/yyyy`).
  - Acciones.
- Vacío: "Sin plazas / Aún no hay plazas registradas.".

**Acciones:**

| Botón | Endpoint | Payload y validación | Confirmación | Errores |
|---|---|---|---|---|
| "Nueva plaza" (diálogo) | `POST /plazas` (:52) | `CreatePlazaSchema` (ver abajo) | — (toast "Plaza creada") | 409 `PLAZA_SLUG_TAKEN`, 400 `ROL_STAFF_NO_EXISTE`, 409 `USUARIO_EMAIL_DUPLICADO` / `UNIQUE_*` (P2002), 400 `VALIDATION_ERROR` |
| "Entrar" | (local) seleccionar la plaza y navegar a `/admin/dashboard` | ver impersonación | — | — |
| "Desactivar" | `DELETE /plazas/:id` (:133), HTTP 204, borrado lógico (`deleted_at`) | — | SweetAlert `warning`: título `¿Desactivar la plaza "<nombre>"?`, texto "Ningún usuario de la plaza podrá iniciar sesión. Los datos y el historial se conservan.", botón "Sí, desactivar" | 404 `PLAZA_NOT_FOUND`; toast "No se pudo desactivar la plaza" |

**Formulario "Nueva plaza"** (subtítulo: "Se crea la plaza con su configuración, roles de staff y un administrador inicial."):
- Validación local:
  - `nombreComercial`: obligatorio, 1..120. Al escribirlo se rellena el slug automáticamente (minúsculas, sin acentos, `[^a-z0-9]` → `-`, máx. 32).
  - `slug`: `SlugSchema` (3..32, `^[a-z0-9-]+$`, se pasa a minúsculas).
  - `colorPrimario`: selector de color, `HexColorSchema` `#RRGGBB`, por defecto `#2563eb`.
  - `emailContacto`: email opcional.
  - `telefonoContacto`: máx. 40.
  - Administrador inicial: `adminNombre` (1..120), `adminRolStaffCodigo` (`admin` = "Administrador del sistema", que es el valor por defecto, `supervisor`, `ingeniero`, `tecnico`), `adminEmail`, `adminPassword` ("Contraseña temporal", **solo mínimo 8 caracteres**, sin la regla de mayúscula, minúscula y dígito).
- Payload enviado:
  `{slug, nombreComercial, emailContacto?, telefonoContacto?, colorPrimario, adminPlazaInicial: {email, nombre, password, rolStaffCodigo}}`.
- Respuesta: `PlazaOutput`.
- Lo que hace el backend al crear la plaza:
  - crea la configuración con valores por defecto;
  - crea los roles de staff por defecto y el rol de sistema `admin` (con todos los permisos);
  - crea el usuario admin inicial;
  - envía el email de bienvenida;
  - crea los buckets de MinIO;
  - registra la auditoría.

**Otros endpoints de plazas:**
- `GET /plazas/:id` (:72): superadmin cualquiera; admin_plaza solo la suya, si no 403 `PLAZA_SCOPE_VIOLATION`. Se usa para el branding y el shell.
- `PATCH /plazas/:id` (:82): `UpdatePlazaSchema` con `nombreComercial?`, `emailContacto?|null`, `telefonoContacto?|null`, `colorPrimario?`; no permite cambiar slug ni timezone. La UI del superadmin **no** tiene pantalla de edición; solo se usa desde Configuración del admin (§5.2.1.10).
- `POST /plazas/:id/logo` (:96): multipart con campo `file`, PNG o SVG de hasta 2 MB. Errores: `LOGO_REQUERIDO`, `ADJUNTO_MIME_INVALIDO`, 413 `ADJUNTO_DEMASIADO_GRANDE`. La usa Configuración (§5.2.1.10).

**Selector de plaza e impersonación** (topbar del superadmin, en todas sus pantallas):
- **Lista de plazas:** `GET /plazas?page=1&pageSize=100` (`lib/superadmin-shell.ts`). Para la plaza seleccionada se usa `GET /plazas/{id}`; su `colorPrimario` se aplica como `--color-primary` (branding).
- **Menú:**
  - Primera opción "Todas las plazas — Vista global de la plataforma" (ícono Globe).
  - Debajo, una opción por plaza con su punto de color, nombre y slug, y un check en la activa.
  - Si hay más de 7 plazas aparece el buscador "Buscar plaza…" (busca en nombre y slug); sin resultados: "Sin plazas que coincidan.".
- **Al elegir:** `selectPlazaAction(id|null)` (server action).
  - Valida que el valor sea un UUID v1-5 y lo guarda en la cookie httpOnly **`sa_plaza`** (sameSite lax, 30 días).
  - `null` borra la cookie. El logout también la borra.
  - Navega a `/admin/dashboard` si se eligió una plaza, o a `/superadmin/dashboard` si se eligió "Todas".
- **Cómo llega al backend:** `apiFetch` añade **`x-plaza-id: <uuid>`** a todas las llamadas, pero solo si `rol === 'superadmin'`. El backend (`PlazaScopeGuard`) lo lee solo en la rama superadmin:
  - si no es un UUID v1-5 → 400 `PLAZA_ID_INVALIDO`;
  - si lo es, asigna `user.plazaId = header` y `actingAsPlaza = true`, y desde ahí los services y RLS trabajan con esa plaza.
  - Para cualquier otro rol la cabecera se ignora.
  - **La app móvil debe guardar la plaza elegida en local y enviar esa cabecera** en cada petición del superadmin.
- **Pantallas de plaza sin selección:** si el superadmin abre una ruta `/admin/*` sin plaza elegida, el layout muestra la tarjeta "Selecciona una plaza para operar" en lugar del contenido.

---

### 5.10 Endpoints backend de los módulos 5.3–5.9

| Método | Ruta (`/api/v1`) | @Roles | @RequirePermission | Body / Query schema | Respuesta | Errores de dominio |
|---|---|---|---|---|---|---|
| GET | `/notificaciones/inbox` | admin_plaza, inquilino | — | Q `NotificacionesInboxQuerySchema` (`limit` 1..50, por defecto 20) | `{items: NotificacionOutput[], noLeidas}` | PLAZA_SCOPE_VIOLATION, ROLE_FORBIDDEN |
| GET | `/notificaciones/inbox/conteo` | admin_plaza, inquilino | — | — | `{noLeidas}` | idem |
| POST | `/notificaciones/inbox/leer-todas` (200) | admin_plaza, inquilino | — | — | `{actualizadas}` | idem |
| POST | `/notificaciones/inbox/:id/leer` (200) | admin_plaza, inquilino | — | `:id` UUID | `NotificacionOutput` | NOTIFICACION_NO_ENCONTRADA |
| GET | `/notificaciones` | admin_plaza, superadmin | notificaciones.ver_log | Q `ListEmailLogQuerySchema` | paginado `EmailLogOutput` | PLAZA_SCOPE_VIOLATION |
| GET | `/notificaciones/:id/preview` | admin_plaza, superadmin | notificaciones.ver_preview | — | `{subject, html}` | EMAIL_LOG_NO_ENCONTRADO |
| POST | `/notificaciones/:id/reintentar` (201) | admin_plaza, superadmin | notificaciones.reintentar | — | `EmailLogOutput` | EMAIL_NO_REINTENTABLE, EMAIL_LOG_NO_ENCONTRADO |
| GET | `/notificaciones/unsubscribes` | admin_plaza, superadmin | notificaciones.gestionar_desuscripciones | Q `ListUnsubscribesQuerySchema` (`email?`) | paginado `UnsubscribeOutput {id, plazaId, email, plantilla, createdAt}` | — |
| DELETE | `/notificaciones/unsubscribes/:id` (204) | admin_plaza, superadmin | notificaciones.gestionar_desuscripciones | — | — | UNSUBSCRIBE_NO_ENCONTRADO |
| GET | `/notificaciones/unsubscribe?token=` | pública | — | — | HTML | UNSUBSCRIBE_TOKEN_INVALIDO |
| GET | `/calendario` | admin_plaza, inquilino | calendario.ver | Q `CalendarioQuerySchema` | `CalendarioEventoOutput[]` | RANGO_INVALIDO, VALIDATION_ERROR |
| GET | `/calendario/export.ics` | admin_plaza, inquilino | calendario.exportar_ics | Q `IcsQuerySchema` (`localId?`, `tipo?` que se ignora) | `text/calendar` como adjunto | — |
| GET | `/calendario/choques` | admin_plaza, inquilino | calendario.choques.ver | Q `ChoquesQuerySchema` (`from`, `to`, `localId?`) | `ChoqueOutput[]` | — |
| PATCH | `/calendario/eventos/:id/fechas` | admin_plaza | calendario.mover_evento | B `MoverEventoFechasSchema` `{inicio, fin}` | `CalendarioEventoOutput` | EVENTO_NO_ENCONTRADO, EVENTO_CERRADO, FORBIDDEN_ROLE |
| GET | `/reportes/kpis` | admin_plaza, superadmin | reportes.kpis.ver | — | `KpisOutput` | PLAZA_SCOPE_VIOLATION |
| GET | `/reportes/dashboard` | admin_plaza, superadmin | reportes.dashboard.ver | — | `DashboardChartsOutput` | idem |
| GET | `/reportes/:entidad/preview` | admin_plaza, superadmin | reportes.preview | Q filtros según la entidad | `{items (≤10), total}` | ENTIDAD_INVALIDA, FILTROS_INVALIDOS, RANGO_EXCEDIDO, PLAZA_SCOPE_VIOLATION |
| GET | `/reportes/:entidad/export.csv` | admin_plaza, superadmin | reportes.exportar_csv | idem | `text/csv` con BOM | idem |
| GET | `/reportes/:entidad/export.xlsx` | admin_plaza, superadmin | reportes.exportar_xlsx | idem | xlsx | idem, más REPORTE_DEMASIADO_GRANDE y JSREPORT_ERROR |
| GET | `/reportes/:entidad/export.pdf` | admin_plaza, superadmin | reportes.exportar_pdf | idem | pdf | idem |
| GET | `/reportes/locales/:id/export.pdf` | admin_plaza, superadmin | reportes.ficha_local_pdf | — | pdf (la web no lo usa) | — |
| GET | `/reportes/inquilinos/:id/export.pdf` | admin_plaza, superadmin | reportes.ficha_inquilino_pdf | — | pdf (la web no lo usa) | — |
| GET | `/reportes/solicitudes/:id/permiso.pdf` | admin_plaza, superadmin, inquilino | reportes.ficha_local_pdf **o** solicitudes.detalle.ver | — | pdf (ver §4.3.3.4) | — |
| GET | `/auditoria` | admin_plaza, superadmin | auditoria.ver | Q `ListAuditoriaQuerySchema` | paginado `AuditoriaOutput` | PLAZA_SCOPE_VIOLATION |
| POST | `/plazas` | superadmin | — | B `CreatePlazaSchema` | `PlazaOutput` | PLAZA_SLUG_TAKEN, ROL_STAFF_NO_EXISTE, conflictos P2002 |
| GET | `/plazas` | superadmin | — | Q `ListPlazasQuerySchema` (`search?`) | paginado `PlazaOutput` | — |
| GET | `/plazas/:id` | superadmin, admin_plaza | — | — | `PlazaOutput` | PLAZA_NOT_FOUND, PLAZA_SCOPE_VIOLATION |
| PATCH | `/plazas/:id` | superadmin, admin_plaza | — | B `UpdatePlazaSchema` | `PlazaOutput` | idem |
| POST | `/plazas/:id/logo` | superadmin, admin_plaza | — | multipart `file` (PNG o SVG ≤ 2 MB) | `PlazaOutput` | LOGO_REQUERIDO, ADJUNTO_MIME_INVALIDO, ADJUNTO_DEMASIADO_GRANDE |
| DELETE | `/plazas/:id` (204) | superadmin | — | — | — | PLAZA_NOT_FOUND |

> El superadmin no tiene un "dashboard global" propio: `/superadmin/dashboard` reutiliza `/reportes/kpis` y `/reportes/dashboard` sin `x-plaza-id`. El módulo `admin` (`/admin/solicitudes…`) es la vista de solicitudes de todas las plazas (ver §4.3.1.5).

---

## 6. Detalles de presentación a copiar

### 6.1 Badges de estado (`components/estado-badge.tsx` + clases `.b-*` de `globals.css`)
Pill redondeada (radio 999, padding 4×9, 11.5 px, peso 600) con **punto** de 6 px del color del texto, fondo tinte y borde. Colores por *tono* en §6.4.

**Solicitud** (`SolicitudEstado`, orden canónico de filtros = el de la tabla):

| Estado | Etiqueta | Tono |
|---|---|---|
| `borrador` | Borrador | neutral |
| `enviada` | Enviada | info (azul) |
| `asignado` | Asignada | indigo |
| `en_revision` | En revisión | warn (ámbar) |
| `requerida_subsanacion` | Requiere subsanación | orange |
| `pausada` | Pausada | cyan |
| `aprobada` | Aprobada | ok (verde) |
| `cerrada` | Cerrada | violet |
| `rechazada` | Rechazada | danger (rojo) |
| `cancelada` | Cancelada | neutral |

**Resultado de cierre** (`SolicitudResultadoCierre`): `exitoso` "Exitoso" ok · `parcial` "Parcial" warn · `fallido` "Fallido" danger · `no_realizado` "No realizada" neutral.

**Local** (`LocalEstado`): `disponible` "Disponible" ok · `alquilado` "Alquilado" info · `en_mantenimiento` "En mantenimiento" warn · `fuera_de_servicio` "Fuera de servicio" neutral.

**Contrato** (`ContratoEstado`): `vigente` "Vigente" ok · `finalizado` "Finalizado" neutral · `cancelado` "Cancelado" danger.

**Prioridad** (`SolicitudPrioridad`, chip cuadrado 22×22, radio 6, fuente mono 11 px bold, texto blanco): A `#e0463a` · B `#e8852c` · C `#d6a811` · D `#3f9e5a` · F `#7a8499` (mismos colores en claro y oscuro). ⚠️ El enum real es **`A | B | C | D | F`** (`SolicitudPrioridadSchema` en `contracts/categorias`; no existe `E`, aunque el CSS define `.prio-E` `#2f8fb0` y textos dicen "A-F"). Default de subcategoría: `B`. La UI muestra **solo la letra**; los emails del backend (`labels.ts`) usan etiquetas y otra paleta: A "Alta" `#b91c1c`, B "Media" `#d97706`, C "Baja" `#2563eb`, D "Muy baja" `#6b7280`, F "Mínima" `#a8a29e` (decidir cuál copia la app).

**Tipo de solicitud** (columna "Tipo"): badge neutral con la etiqueta (Mantenimiento / Evento / Remodelación / Otro, o la `etiqueta` configurada en el catálogo de la plaza).

**Usuario** (staff e inquilino, calculado en el front): `deletedAt != null` → "Inactivo" neutral; si no, `emailInvalido` → "Email inválido" warn; si no → "Activo" ok. **Email log**: `pendiente` warn · `enviado` ok · `fallido` danger. **Auditoría** (por sufijo de `accion`): `.create` ok · `.update` info · `.delete` danger · otro neutral.

**Notificaciones in-app** e **iconos/colores del calendario**: ver §5.3 y §5.5. **Gráficas del dashboard**: ver §5.7.

**Paginador** (cambio sin commitear del 2026-10-27): texto "Página X de Y" + ‹ › con primera, última, actual y vecinas ("…" en los huecos); en teléfonos (< 480 px) solo ‹ actual ›. Oculto si `totalPages ≤ 1`.

**Semáforo SLA** (`SlaStatus` = `verde | amarillo | rojo | null`): punto de 8 px con halo (35 % opacidad, 3 px) + texto capitalizado ("Verde", "Amarillo", "Rojo"); `null` → "—" en gris. Colores: claro verde `#16a34a` / ámbar `#e0a106` / rojo `#e0463a`; oscuro `#34c77b` / `#edb43c` / `#ef6258`.

### 6.2 Fechas, horas y montos (`lib/datetime.ts`)
- Zona fija de plataforma: **`America/El_Salvador`** (UTC−6, sin DST) — T-V08. El backend guarda UTC.
- **Toda hora visible en 12 h con sufijo en minúsculas separado por espacio**: `"2:00 pm"`, nunca `"14:00"` (patrón date-fns `h:mm aaa`). Los inputs de hora siguen en 24 h (`HH:mm`) y así viajan al backend.

| Helper | Entrada → salida |
|---|---|
| `formatInPlazaTz(iso)` | instante → `dd/MM/yyyy h:mm aaa` en TZ plaza, p. ej. `05/10/2026 2:00 pm` |
| `formatDateInPlazaTz(iso)` | → `dd/MM/yyyy` |
| `formatTimeInPlazaTz(iso)` | → `h:mm aaa` |
| `formatFechaDMY('2026-10-05')` | fecha civil → `05-10-2026` (con guiones; se usa para fechas del permiso; no pasar por `DateTime` para no correr un día) ; null → `—` |
| `formatHora12('15:27')` | `HH:mm[:ss]` → `3:27 pm`; `00:05` → `12:05 am`; null → `—` |
| `formatFechaHora12(iso, tz?, conHora)` | igual que el primero pero con TZ elegible (calendario permite alternar TZ del dispositivo ↔ plaza) |

- **Montos**: sin formateo de moneda; se muestran crudos como `` `${moneda} ${montoMensual}` `` (p. ej. `USD 1500`), con sufijo ` / mes` en detalles de local/inquilino y `—` si es null. La carga inicial usa `USD 1234.00` (`toFixed(2)`). El wizard etiqueta "Monto presupuesto (USD)".

### 6.3 Branding por plaza (`lib/branding.ts`)
- Única variable de marca: **`--color-primary`** (default `#2f62e6`, texto sobre primario `#ffffff`). Se sobreescribe en `:root` con el `colorPrimario` de la plaza (`HexColorSchema`: `#RRGGBB`).
- Fuente del color: admin_plaza → `GET /api/v1/plazas/{plazaId del JWT}` (`PlazaOutput`: `id, slug, nombreComercial, emailContacto, telefonoContacto, logoUrl, colorPrimario, timezone, createdAt, updatedAt, deletedAt`); superadmin con plaza seleccionada → la plaza seleccionada; inquilino → **default** (no hay endpoint accesible para él).
- Escala derivada (claro): `primary-50` = 8 % primario + blanco; `-100` 14 %; `-200` 26 %; `-300` 42 %; `-500` = primario; `-600` = 84 % primario + negro; `-700` 68 % + negro; `primary-soft` 12 % + blanco; `primary-ring` 38 % sobre transparente. Oscuro: `primary-soft` = 22 % sobre `#0d1420`; `primary-700` = 52 % + blanco. Ítem activo de sidebar: fondo primario al 22 % (26 % en oscuro) y barra `primary-300`.
- `logoUrl` solo se muestra en Configuración (preview); la sidebar siempre usa el monograma "P".

### 6.4 Tokens de tema (`app/globals.css`)
Tema por atributo `data-theme="light|dark"` en `<html>`; preferencia en `localStorage['theme']`, por defecto la del sistema. Tipografías: **General Sans** (400/500/600/700, Fontshare) y **JetBrains Mono** (Google Fonts); cuerpo 14 px / 1.5. Radios: xs 5, sm 7, md 10, lg 14, xl 18, pill 999.

| Token | Claro | Oscuro |
|---|---|---|
| `--bg` | `#f4f6f9` | `#080b11` |
| `--surface` / `-2` / `-3` / `-inset` | `#ffffff` / `#fafbfc` / `#f1f3f6` / `#f6f8fa` | `#10151e` / `#0c111a` / `#18202c` / `#0c121b` |
| `--border` / `-2` / `-strong` | `#e6e8ee` / `#eef0f4` / `#d6dae2` | `#222b39` / `#1a2230` / `#2d3848` |
| `--text` / `-2` / `-3` / `-muted` | `#131a26` / `#475063` / `#6b7486` / `#98a0b0` | `#e9edf4` / `#a4afc0` / `#818c9f` / `#5f6a7d` |
| `--side-bg` (sidebar navy) | `#0d1521` (grad `#101a28→#0b131e`) | `#0a1019` (grad `#0c131e→#080d15`) |
| `--side-text` / `-dim` / `-strong` / `--side-section` | `#9aa7ba` / `#6b7791` / `#fff` / `#5d6a82` | `#97a3b6` / `#636f83` / `#fff` / (hereda) |

Tonos semánticos (fg / bg / borde):

| Tono | Claro | Oscuro |
|---|---|---|
| ok | `#0a6b46` / `#e7f6ee` / `#bce6cf` | `#5fd6a0` / `#0e2920` / `#1d4838` |
| info | `#0b5cab` / `#e6f1fd` / `#bcdcf6` | `#6fb4f4` / `#0e2436` / `#1d3f5c` |
| warn | `#9a6206` / `#fdf3e2` / `#f3dcab` | `#f0bd5a` / `#2c2210` / `#4d3c18` |
| orange | `#b14a08` / `#fdeee2` / `#f6cba6` | `#f3a164` / `#2e1d10` / `#523619` |
| indigo | `#3f3fb0` / `#ebebfb` / `#cfcff3` | `#9a9af0` / `#1b1b38` / `#33336a` |
| cyan | `#0a6a78` / `#e2f5f8` / `#a9e2ea` | `#54c6d6` / `#0c2a30` / `#19474f` |
| danger | `#b42318` / `#fdeceb` / `#f5c4c0` | `#f3837a` / `#2e1414` / `#562525` |
| violet | `#6b35c2` / `#f1e9fc` / `#dcc8f4` | `#b794f0` / `#241734` / `#412b5e` |
| neutral | `#5a6678` / `#eef0f3` / `#dde1e8` | `#9aa6b8` / `#1a2230` / `#2a3543` |

## 7. Riesgos / cosas raras

Las etiquetas `A1-Rn`, `A2-Rn`, `B1-Rn`, `B2-Rn`, `C-Rn` remiten a las listas completas por área (§7.4–§7.8).

### 7.1 Verificación cruzada web ↔ backend
- Comparé todas las rutas que el web llama (`apiFetch` en 57 archivos, más los `fetch` directos de login, refresh, logout y reset) con las **138 rutas** de los 21 controllers (Anexo A). **Todas existen: no hay endpoints fantasma.** Los problemas son de semántica, permisos o validación (abajo).
- **Endpoints del backend que el web no usa.** Algunos son útiles para la app; otros conviene evitarlos.

  | Uso | Endpoints |
  |---|---|
  | Útiles para la app | `GET /auth/me`; `GET /solicitudes/:id/comentarios`, `/historial` y `/adjuntos` (el web usa los que vienen embebidos en el detalle); `GET /calendario/choques`; `GET /locales/:id/contratos`; `GET /inquilinos/:id/contratos`; `POST /locales/:id/fuera-de-servicio`; `PATCH /contratos/:id`; `GET /reportes/locales/:id/export.pdf`; `GET /reportes/inquilinos/:id/export.pdf`; `POST /usuarios/:id/reset-email-invalido`; `GET /roles-staff/:id`; `GET /categorias/:id/subcategorias/:subId`; `POST`/`DELETE /permisos/roles/:id/permisos/:permisoId` |
  | Evitar | `GET /notificaciones/unsubscribe` (público, devuelve HTML); `POST /solicitudes/cron/*` y `POST /contratos/cron/test-alertas` (solo dev, 404 en producción); `/health*` |

- **Working tree en movimiento.** Mientras se hacía este inventario aparecieron cambios **sin commitear** del 2026-10-27 en 11 archivos del frontend. Los funcionales son:
  - `promptAction` sustituye a `window.prompt` en Liberar y Cancelar; corrige el bug de que "Cancelar" ejecutaba la acción.
  - Paginador compacto.
  - Etiquetas de accesibilidad.

  El documento describe ese estado. Si se descartan esos cambios, A2-R3 vuelve a aplicar.
- **El working tree siguió cambiando durante el análisis** (28 archivos del frontend modificados al cerrar este documento, más specs e2e nuevos). Los cambios posteriores revisados son de presentación:
  - tokens de tema en lugar de colores `gray-*` (modo oscuro);
  - badges `.badge .b-*` en subcategorías;
  - etiquetas de accesibilidad;
  - **fechas de contrato mostradas como `DD-MM-YYYY`** con `formatFechaDMY`, lo que deja B1-R16 parcialmente desactualizado.

  No cambian endpoints ni payloads. Conviene repasar `git diff` antes de cerrar la especificación de la app.

### 7.2 Hallazgos prioritarios (afectan a lo que la app debe hacer)

**Bugs reales hoy (web y/o backend):**
1. **Editar una solicitud de tipo `remodelacion` falla siempre** con `422 CAMPOS_EXTRA_INVALIDOS`. La `z.union` de `UpdateSolicitudSchema.camposExtra` la interpreta como un evento y descarta los campos propios (A1-R1). Reproducido con los contracts compilados.
2. **Un `PATCH /solicitudes/:id` parcial pone `esEmergencia=false`.** En Zod 4, `.partial()` aplica el `.default(false)`. La app debe enviar siempre `esEmergencia` (A1-R2).
3. **Las ventanas de fechas (48 h / 5 d / 7 d) solo se validan en `POST /solicitudes`.** Ni PATCH, ni `enviar`, ni `subsanar` las revisan, así que un borrador duplicado (sin fechas) puede enviarse (A1-R3). La app debe validar en cliente antes de enviar.
4. **Doble escape HTML al editar.** El backend guarda entidades (`&amp;`) y el wizard las reenvía, que se acumulan como `&amp;amp;`. Hay que decodificar al mostrar y no reenviar campos sin cambios (A1-R4).
5. **El rol staff de un usuario no se puede cambiar.** El diálogo envía `rolStaffId`, pero `PATCH /usuarios/:id` solo guarda `nombre` y `telefono`, y no existe otro endpoint para hacerlo (B2-R1).
6. **Los usuarios deshabilitados no aparecen en ningún listado.** `GET /usuarios` ignora `activo` y filtra `deleted_at`, así que "Reactivar" solo es alcanzable conociendo el id (B2-R2).
7. **El superadmin tiene en el menú opciones que el backend le niega.** "Calendario" (`@Roles('admin_plaza','inquilino')`) y "Configuración" (`@Roles('admin_plaza')`) devuelven 403 (C-R2, B2-R3). Además, su bandeja sale vacía por defecto y la UI le oculta acciones que el backend sí le permite (A2-R6).
8. **El inquilino no puede gestionar los adjuntos de sus contratos en el web.** Las server actions exigen `contratos.adjuntos.*` y su lista de permisos es `[]`; el backend sí se lo permite (B1-R1, verificado en `admin/contratos/actions.ts`).
9. **Mensajes de error:** el envelope del backend trae `detail`, no `message`. Varias acciones del web muestran siempre el texto genérico (C-R1). Además, `VALIDATION_ERROR.detail` es un **array**.
10. **SLA:**
    - Solo `GET /solicitudes/bandeja` devuelve `slaStatus`; detalle, listado del inquilino y vistas del superadmin devuelven `null` (A2-R1).
    - La matview se refresca una vez al día (A2-R2).
11. **Prioridad y cierre en la UI:**
    - El select de prioridad aparece en `borrador` y `aprobada`, donde el backend responde 400 (A2-R4).
    - Al cerrar con resultado "exitoso", el comentario opcional se descarta (A2-R9).
12. **Desactivar una plaza no impide el login de sus usuarios**, aunque el diálogo lo promete. Verificado: `AuthService.login` solo mira `usuario.deleted_at`, y `DELETE /plazas/:id` solo marca la plaza (C-R5).
13. **Dashboard:**
    - Su ítem de menú no pide permiso, pero los endpoints exigen `reportes.kpis.ver` y `reportes.dashboard.ver`. Un admin sin ellos aterriza en su home y solo ve un error (C-R3).
    - El "Dashboard global" del superadmin muestra una sola plaza si hay una seleccionada (C-R4).

**Autorización al ir directo al backend** (el BFF del web hoy tapa parte de esto):
- `PATCH /plazas/:id` y `POST /plazas/:id/logo` no tienen `@RequirePermission`: cualquier admin_plaza puede cambiar el nombre, el color o el logo de su plaza. `PATCH /configuracion` acepta cualquiera de los 5 `configuracion.editar_*` para cualquier campo (B2-R4).
- El backend no valida que el tipo de solicitud esté activo (A1-R7), ni que el local esté `disponible` al crear un contrato (B1-R9).
- El inquilino puede borrar sus adjuntos en cualquier estado (A1-R12).
- `rechazar` no exige ser el admin asignado (A2-R5).
- Un usuario con solo `solicitudes.bandeja.asignadas_a_mi` puede pedir `asignadasAMi=false` y ver toda la plaza (A2-R7).
- `GET /categorias/:id` expone al inquilino el nombre y el email del staff responsable y de los supervisores (A1-R15).
- **Rate limit por IP:** 100 req/min global y 5/min en login, con `req.ip` resuelto vía `trust proxy`. Con la app móvil, muchos usuarios detrás del mismo CGNAT o Wi-Fi compartirán contador y recibirán 429. Revisar la clave del throttler antes de publicar la app.
- La contraseña del admin inicial al crear una plaza solo exige 8 caracteres, no la política completa (C-R12).

**Contrato de datos para los modelos Flutter:**
- **Prioridad:** `A | B | C | D | F` (no existe `E`).
- **Estados:** `aprobada` **no** es terminal (`SOLICITUD_ESTADOS_TERMINALES` = `cerrada`, `rechazada`, `cancelada`).
- **Códigos de permiso:** 15 tienen 3 segmentos (`solicitudes.bandeja.ver`…) y no pasan la regex de `PermisoCodigoSchema`. No validarlos con ella (B2-R8).
- **Campos opcionales vacíos:** omitirlos o mandar `null`, **nunca `''`** (fechas, emails, enums y números `min(1)` lo rechazan) (B1-R3). Excepción: `UpdateLocalSchema` acepta `''` y lo convierte en `null` (borrar).
- **Reaccionar por `code`, no por status.** Ejemplos:
  - `ACCOUNT_LOCKED` sale como 429, aunque el catálogo dice 423.
  - `ROL_SISTEMA_NO_MODIFICABLE` sale como 403, aunque el catálogo dice 409 (B2-R7).
  - En los adjuntos de una solicitud ajena, el 404 trae el código `CONTRATO_NOT_FOUND` (A1-R17).
- **Fechas:**
  - Las fechas civiles (`YYYY-MM-DD`) y horas (`HH:mm`) de permisos y contratos están en hora de El Salvador.
  - En cambio, los filtros `fechaDesde`/`fechaHasta` (solicitudes, auditoría, emails, reportes) se interpretan como días **UTC** (A2-R13, C-R8).
  - Las ventanas T-30/T-7 de contratos también se calculan en UTC (B1-R17).
  - El cupo de 3 emergencias se cuenta por mes UTC e incluye todos los estados (A1-R5).
- **Adjuntos:**
  - El backend valida el MIME **declarado** en la parte multipart: hay que fijar el `contentType` del `MultipartFile`.
  - Un archivo por request, campo `file`.
  - Máximo 10 por solicitud.
  - El inquilino no puede leer la configuración real (MIME y tamaño) de su plaza (A1-R10).
- **TTLs reales:** access 1 h, refresh 14 d, reset 30 min. CLAUDE.md aún dice 15 min / 7 d.

**Huecos de producto / decisiones para la app:**
- **Rutas huérfanas:** `/inquilino/contratos` (sin menú) y `/admin/usuarios-plaza/[id]` (sin enlace). Decidir si la app las expone.
- **Enlaces de los emails:** reset de contraseña, bienvenida, link del `.ics` y unsubscribe apuntan a `FRONTEND_URL` (web). Hacen falta deep links / universal links o abrir el navegador.
- **Contraseñas temporales:** las genera el cliente (`Tmp` + base64url(9 bytes) + `1a`) y se muestran una sola vez. El backend no las devuelve y no fuerza el cambio en el primer login (B1-R13).
- **Plantilla Excel de carga inicial:** es un estático del frontend (`/plantillas/plantilla-carga-inicial.xlsx`) (B1-R11).
- **Branding del inquilino:** no hay endpoint que le dé el color o el logo de su plaza (`GET /plazas/:id` es solo superadmin y admin_plaza), así que ve el color por defecto.
- **Buscador del topbar:** es decorativo (sin funcionalidad).
- **Comentarios:** no hay comentarios internos; el inquilino ve todos (A2-R16).
- **Prioridad:** la UI muestra solo la letra; los emails usan "Alta/Media/…" (A2-R14).
- **Listas truncadas sin paginar:**
  - combos a 100 elementos;
  - plazas a 50 y desuscripciones a 50;
  - "Mis contratos" a 50.

  Ver B1-R5, C-R10 y A1-R14.
- **iCal:** exporta todo el histórico de eventos, sin filtro de fechas ni tipos (C-R9).
- **Fuera de servicio:** el web lo pone por `PATCH /locales/:id`, que no rechaza solicitudes pendientes; existe `POST /locales/:id/fuera-de-servicio`, que sí lo hace (B1-R7).
- **Botones sin `<Can>`:** muchos se muestran sin el permiso y fallan después (B1-R6, B2-R11, C-R14). La app debería ocultarlos con el permiso correspondiente (tabla §1.11).

### 7.3 Auth, sesión y transversales (revisión propia)
- **TTL documentado ≠ real:** CLAUDE.md dice access 15 min / refresh 7 d; `backend/.env*` usa **1 h / 14 d** (T-V13).
- **Código HTTP de `ACCOUNT_LOCKED`:** el catálogo `DOMAIN_ERRORS` lo declara 423, pero `AuthService.login` lanza **429**.
- **Login del web y los 429:** el web trata cualquier 429 como "cuenta bloqueada", aunque sea el throttler de 5/min. La app puede distinguirlos por `code`: `ACCOUNT_LOCKED` (con `meta.retryAfter`) o `TOO_MANY_REQUESTS` (header `Retry-After`).
- **Token rotado no persistido (limitación declarada del web):** `apiFetch` reintenta tras un 401 con el token rotado, pero no lo guarda. Con la detección de reuso del refresh, dos refresh concurrentes con el mismo token **revocan todas las sesiones** del usuario. En la app, el refresh debe ser *single-flight* y persistir el par nuevo de forma atómica.
- **Rutas huérfanas:** `/inquilino/contratos` no está en `nav-config.ts`; `/admin/usuarios-plaza/[id]` no tiene enlaces.
- **Buscador del topbar** ("Buscar…" con `⌘K`): es decorativo.
- **CORS sin `PUT`:** `main.ts` no lista `PUT` en los métodos permitidos, y `PUT /permisos/roles/:id` lo necesita. Solo afecta si se compila Flutter **web**.
- **Prioridad:** el enum es `A|B|C|D|F`, pero el CSS define `.prio-E` y la descripción del permiso dice "(A-F)".
- **Inquilino sin branding:** no puede leer el branding de su plaza (`GET /plazas/:id` excluye `inquilino`), así que el topbar muestra "Mi plaza" con el color por defecto.

### 7.4 Lista completa A1 · creación y edición de solicitudes

- **A1-R1.** **Editar una `remodelacion` falla.** `UpdateSolicitudSchema.camposExtra` es una `z.union` (mantenimiento | evento | remodelacion | otro) de objetos que eliminan las claves desconocidas. Un `camposExtra` de remodelación no encaja con la opción mantenimiento (le falta `area_afectada`) y **sí encaja con la de evento**, que descarta `fecha_inicio_estimada/duracion_dias/empresa_constructora/monto_presupuesto`. Después `validateCamposExtra('remodelacion', …)` responde `422 CAMPOS_EXTRA_INVALIDOS`. Lo reproduje con `packages/contracts/dist`. Afecta a la web (el wizard en edición siempre envía `tipo` y `camposExtra`) y a la móvil. La única salida desde el cliente es un PATCH sin `tipo` ni `camposExtra`, que no permite editar esos campos.
- **A1-R2.** **Un PATCH parcial pone `esEmergencia=false`.** `BaseSolicitudSchema.esEmergencia` tiene `.default(false)` y, en Zod 4, `.partial()` aplica el default aunque el campo se omita (verificado: `{titulo:'x'}` → `{titulo:'x', esEmergencia:false}`). Cualquier PATCH que no incluya `esEmergencia` desactiva el modo emergencia de un borrador. La web no lo nota porque siempre envía el payload completo. **La app debe enviar siempre `esEmergencia`.**
- **A1-R3.** **Las ventanas de fecha solo se validan en `POST /solicitudes`.** `UpdateSolicitudSchema` no tiene el `superRefine` (48 h / 5 d / 7 d) ni el `refine` de categoría y subcategoría obligatorias, y `enviar` y `subsanar` no revisan las fechas. Por PATCH se pueden guardar fechas fuera de ventana o en el pasado. Un **borrador duplicado** (fechas `null`) se puede **enviar sin fechas** desde el botón "Enviar" del detalle. ⚠️ verificar si esto se acepta en el negocio.
- **A1-R4.** **Doble escape de entidades HTML.** El backend sanitiza con `sanitize-html` (`titulo` y campos de empresa como texto plano, `descripcion` como HTML rico) y **codifica** `&`→`&amp;`, `>`→`&gt;` (verificado). Al editar, el wizard recarga los valores codificados y los reenvía, así que se acumula `&amp;amp;`. La app móvil debe decodificar entidades al mostrar y evitar reenviar campos que no cambiaron.
- **A1-R5.** **Cupo de emergencias:** cuenta las solicitudes `es_emergencia=true` **creadas** en el mes calendario **UTC** (no en hora de El Salvador) y en **cualquier estado**, incluidas canceladas y borradores. Un borrador de emergencia que se descarta consume cupo. ⚠️ verificar con negocio.
- **A1-R6.** **Umbral de aprobación especial inalcanzable:** `asistentes_estimados` está limitado a 1..20, pero el umbral por defecto (`aprobacion_especial_asistentes_min`) es 200. Con la configuración por defecto, `requiere_aprobacion_especial` nunca será `true`.
- **A1-R7.** **El backend no valida que el `tipo` esté activo** en la plaza (`solicitud_tipo_config.activo`). Solo la UI filtra los tipos. Un cliente puede crear solicitudes de un tipo desactivado.
- **A1-R8.** **La categoría no se filtra por tipo** (ni en front ni en back): cualquier subcategoría activa vale para cualquier tipo.
- **A1-R9.** **Divergencia de reloj en las fechas:** el wizard valida contra el momento de montaje, el backend contra la hora del request. Si el usuario tarda, el backend puede rechazar fechas que el wizard aceptó (por ejemplo, una fecha justo en el límite de +48 h). Además, la validación depende de `TZ=America/El_Salvador` en el contenedor del backend; si cambia la TZ, cambian las ventanas.
- **A1-R10.** **MIME y tamaño reales de la plaza no visibles para el inquilino** (`GET /configuracion` es solo `admin_plaza`). La web valida con los defaults; si la plaza restringió la lista o el tamaño, el usuario solo se entera por el error del backend.
- **A1-R11.** **Cancelar desde el detalle del inquilino**: en `HEAD` usaba `prompt()` nativo y cancelaba aunque el usuario pulsara "Cancelar" en el prompt; los cambios sin commitear del 2026-10-27 ya usan `promptAction` (aborta al cerrar). La UI oculta Cancelar en `pausada`, aunque el backend permite `pausada → cancelada`.
- **A1-R12.** **Adjuntos del inquilino:** el backend deja que el inquilino **borre** sus adjuntos en cualquier estado (no comprueba el estado de la solicitud). Solo la UI lo limita a `borrador` y `requerida_subsanacion`. Un comentario del detalle dice que en `pausada` el inquilino "sigue pudiendo adjuntar", pero el backend responde `403 UPLOAD_FORBIDDEN`.
- **A1-R13.** **Texto engañoso en el wizard:** dice que los adjuntos se suben "solo al enviar", pero se suben también al "Guardar borrador". Las subidas fallidas no revierten la solicitud (queda creada, con un toast por archivo).
- **A1-R14.** **Carga N+1 de categorías:** 1 + N llamadas (`GET /categorias/:id` por categoría) en cada apertura del wizard. Con `pageSize=100` se truncan tanto categorías como contratos vigentes si hay más de 100.
- **A1-R15.** **Exposición menor:** `GET /categorias/:id` devuelve al inquilino `responsable` y `supervisores` (nombre y email del staff) de cada subcategoría.
- **A1-R16.** **Historial de reenvío:** `POST :id/subsanar` registra el evento `enviada` (comentario "Reenviada tras subsanación"), no `subsanada` (ese evento lo usa el admin al pedir la subsanación). Tenerlo en cuenta al pintar el timeline.
- **A1-R17.** **Código de error engañoso en adjuntos:** si un inquilino intenta descargar o borrar el adjunto de una solicitud ajena, el backend responde `404` con code `CONTRATO_NOT_FOUND` (reutiliza `assertContratoScope`).

### 7.5 Lista completa A2 · bandeja, detalle y transiciones

- **A2-R1.** **SLA nulo fuera de la bandeja**: `GET /solicitudes/:id`, `GET /solicitudes` y los endpoints `/admin/solicitudes*` nunca calculan `slaStatus`, así que el semáforo del detalle (admin y superadmin) y del listado global siempre sale "—". Para mostrar el SLA en el detalle, el móvil tendría que calcularlo con `configuracion` o tomarlo de la bandeja.
- **A2-R2.** **SLA desactualizado en la bandeja**: la matview guarda `status` calculado al refrescar (cron diario 02:00), así que el color puede tener hasta 24 h de atraso. Una solicitud pausada o aprobada después del refresco sigue mostrando su color viejo hasta el siguiente, porque la fila aún existe en la matview. ⚠️ verificar.
- **A2-R3.** **Liberar / Cancelar con `window.prompt` (bug ya corregido en el working tree).** En `HEAD` (a01f9de) usaban `prompt()` nativo y, al pulsar "Cancelar" en el prompt, la acción se ejecutaba igual. Los cambios **sin commitear** del 2026-10-27 lo sustituyen por `promptAction` (SweetAlert, aborta con `null`). La app debe replicar el comportamiento corregido: cerrar el diálogo = no hacer nada.
- **A2-R4.** **El select de Prioridad aparece en `borrador` y `aprobada`**, donde el backend devuelve `400 INVALID_STATE_TRANSITION`.
- **A2-R5.** **Rechazar**: la UI lo limita al asignado; el backend no exige ser el asignado (asimetría con aprobar y pedir subsanación).
- **A2-R6.** **Superadmin impersonando**: la UI le oculta acciones que el backend sí le permite (tomar en `asignado`, aprobar, cerrar, liberar…). Además, la bandeja por defecto (`asignadasAMi=true`) le sale vacía, porque se filtra por su propio id y no tiene `rol_staff` de sistema.
- **A2-R7.** **Permiso de bandeja**: el menú pide `solicitudes.bandeja.ver`, pero el backend también acepta `solicitudes.bandeja.asignadas_a_mi` y no impide que ese usuario pida `asignadasAMi=false` (verá toda la plaza).
- **A2-R8.** **Adjuntos del inquilino**: la zona de subida se muestra en estados donde el backend la rechaza (`UPLOAD_FORBIDDEN`). La UI usa siempre `MIME_PERMITIDOS_DEFAULT` y el tamaño por defecto, no la configuración de la plaza que valida el backend.
- **A2-R9.** **Cierre "exitoso"**: el comentario opcional que escribe el admin se descarta (no se envía).
- **A2-R10.** **Export CSV del superadmin**: el comentario del service habla de `422 EXPORT_TOO_LARGE`, pero el código trunca en silencio a 10 000 filas, sin cabecera que avise. El contrato dice que `search` incluye la razón social del inquilino, pero el `buildWhere` no la incluye.
- **A2-R11.** **Detalle del superadmin global**: no muestra comentarios, historial, adjuntos, contacto de emergencia ni campos extra, aunque `GET /admin/solicitudes/:id` sí los devuelve. Tampoco ofrece el PDF: el endpoint del PDF exige plaza, así que haría falta `x-plaza-id`.
- **A2-R12.** **SC-4 inalcanzable**: solo el inquilino puede `POST /solicitudes`, así que `usuarioCreadorId` nunca es un admin; el banner SC-4 y `CANNOT_*_OWN_REQUEST` son código muerto en la práctica.
- **A2-R13.** **Fechas en listas, comentarios e historial**: se muestran solo como `dd/MM/yyyy` (sin hora). Los filtros `fechaDesde`/`fechaHasta` se interpretan en UTC, no en America/El_Salvador (desfase de 6 h en los bordes).
- **A2-R14.** **Etiquetas de prioridad**: la UI solo muestra la letra; los emails del backend usan "Alta/Media/Baja/Muy baja/Mínima" con otra paleta de colores. Hay que decidir cuál copia el móvil.
- **A2-R15.** **Errores de validación**: `VALIDATION_ERROR` trae `detail` como **array** de strings (`"path: mensaje"`), no como string. El web lo une con `; `.
- **A2-R16.** **Comentarios sin visibilidad interna**: todo comentario del staff lo ve el inquilino (el placeholder del admin lo asume: "Comentario para el inquilino…").

### 7.6 Lista completa B1 · locales, inquilinos, contratos, carga inicial

- **B1-R1.** **El inquilino no puede gestionar adjuntos de contrato en el web.**
   - `subirAdjuntoContratoAction`, `descargarAdjuntoAction` y `eliminarAdjuntoAction` llaman a `assertAnyCan(['contratos.adjuntos.*' …])`.
   - `GET /auth/me/permisos` devuelve `[]` para el inquilino, así que las tres acciones fallan con "Permiso denegado: requiere …".
   - El backend sí lo permite.
   - En la app móvil (llamando directo al backend) funcionará; conviene decidir si se replica el comportamiento "roto" del web o el intencionado (subir, descargar y borrar lo propio).
- **B1-R2.** **`/inquilino/contratos` no tiene ítem de menú** en `nav-config.ts`: la pantalla existe pero está huérfana.
- **B1-R3.** **Inputs vacíos contra los Zod schemas** (⚠️ verificar en el web real).
   - `NuevoContratoForm`, `NuevoInquilinoForm`, `CerrarContratoDialog` y `RenovarContratoDialog` usan `zodResolver` con inputs no controlados.
   - Los campos opcionales vacíos llegan como `''`, y `CreateContratoSchema` y `CreateInquilinoSchema` los rechazan:
     - `plazoMeses: ''` → 0 → "Too small";
     - fechas `''` → "Invalid ISO date";
     - emails `''` → "Invalid email";
     - `tipoCliente: ''` → enum inválido.
   - En el cierre, `fechaFinEfectiva: ''` falla en el resolver antes de que el `onSubmit` lo convierta a `undefined`.
   - Comprobado con zod 4.4.3. Probablemente obliga a rellenar todos los campos en el web. **En móvil: omitir o mandar `null`.**
- **B1-R4.** **Etiquetas de obligatoriedad engañosas**: "Módulo *" y "Nivel *" al crear un local, pero son opcionales en `CreateLocalSchema` (y en la carga inicial MODULO sí es obligatorio).
- **B1-R5.** **Combos truncados a 100**: los filtros de `/admin/contratos` y el combo de "Nuevo contrato" piden `pageSize=100` (el máximo del backend); con más de 100 locales o inquilinos faltan opciones.
- **B1-R6.** **Sin `<Can>` en muchos botones**, que el web muestra aunque el usuario no tenga permiso (la acción falla después con un toast):
   - Nuevo local / inquilino / contrato;
   - Guardar en la edición de local e inquilino;
   - Desactivar en la edición de inquilino;
   - Renovar y Cerrar contrato;
   - Alta rápida de usuario y todas las acciones de la tabla de usuarios.
   La app debería protegerlos con: `locales.crear/editar`, `inquilinos.crear/editar/deshabilitar/alta_usuario/resetear_clave/deshabilitar_usuario/reactivar_usuario`, `contratos.crear/renovar/cerrar`.
- **B1-R7.** **Fuera de servicio sin efecto en solicitudes**: el web pasa el local a `fuera_de_servicio` vía `PATCH` y **no** dispara el rechazo o cancelación masiva. El endpoint dedicado `POST /locales/:id/fuera-de-servicio` (con `motivo` y `rechazarSolicitudesPendientes`) existe pero no se usa.
- **B1-R8.** **Endpoints sin UI en el web**:
   - `PATCH /contratos/:id` (editar monto/condiciones; existe el permiso `contratos.editar`);
   - `GET /locales/:id/contratos` y `GET /inquilinos/:id/contratos` (historial paginado; el web usa el array embebido en el detalle);
   - fichas PDF `/reportes/locales/:id/export.pdf` e `/reportes/inquilinos/:id/export.pdf`;
   - `POST /usuarios/:id/reset-email-invalido`.
- **B1-R9.** **Crear contrato no exige local `disponible`** en el backend; solo el front filtra `estado=disponible`. Un cliente directo podría crear un contrato sobre un local `en_mantenimiento` o `fuera_de_servicio`, y lo deja `alquilado`.
- **B1-R10.** **Desactivar usuario ya inactivo**: el comentario del service dice 409 `USUARIO_YA_INACTIVO`, pero el código real devuelve **404 `USUARIO_NO_ENCONTRADO`**.
- **B1-R11.** **Plantilla Excel solo en el frontend** (`/plantillas/plantilla-carga-inicial.xlsx`, servida por Next). La app móvil tiene que empaquetarla o enlazar al dominio web.
- **B1-R12.** **Enlaces de reset de contraseña al web**: `POST /usuarios/:id/reset-password` envía un enlace a `{FRONTEND_URL}/reset-password/{token}`. Si la app quiere manejar el reset, hace falta deep link o universal link.
- **B1-R13.** **Contraseña temporal generada en el cliente**: el backend no genera ni devuelve contraseñas. La app debe replicar `Tmp{base64url(9 bytes)}1a`, o cualquier valor que cumpla `PasswordSchema` (≥8 caracteres, mayúscula, minúscula, dígito). No hay forzado de cambio en el primer login.
- **B1-R14.** **Límite de tamaño de adjuntos fijo en el front**: 50 MB en el uploader de locales y contratos, mientras el backend usa `configuracion.tamanio_max_archivo_mb` de la plaza. Si la plaza baja el límite, el front no lo refleja (el backend sí lo valida).
- **B1-R15.** **Editar usuario de inquilino** no revalida ni refresca la lista: el nombre o teléfono editado no se ve hasta navegar.
- **B1-R16.** **Fechas sin formatear en el web**: inicio, fin y fechas de contrato se muestran crudas (`YYYY-MM-DD`); solo `createdAt`/`updatedAt` usan `formatDateInPlazaTz`. Los montos se muestran como `{moneda} {numero}` sin formato de miles (canon con `toFixed(2)`).
- **B1-R17.** **Las ventanas T-30/T-7** se calculan con la fecha UTC del servidor, no con la zona de la plaza (America/El_Salvador): puede haber un día de diferencia por la noche.

### 7.7 Lista completa B2 · usuarios, roles, permisos, catálogos, configuración

- **B2-R1.** ⚠️ **Editar usuario staff no cambia el rol de staff.** El diálogo envía `rolStaffId` y muestra "Usuario actualizado", pero `UsuariosService.update` solo aplica `nombre`/`telefono` (comentario: "no se expone `rolStaffId` ni `activo` aquí"). No existe otro endpoint para cambiar el `rol_staff` de un usuario. La app móvil no debe ofrecer ese cambio (o debe esperar un fix del backend).
- **B2-R2.** ⚠️ **Usuarios deshabilitados invisibles:** `GET /usuarios` filtra siempre `deleted_at: null` e ignora `activo`; por eso el botón "Reactivar" de la tabla y el badge "Inactivo" nunca aparecen en el listado de staff. `POST /usuarios/:id/reactivate` existe pero solo es alcanzable conociendo el id (p. ej. desde auditoría). El comentario del service habla de `409 USUARIO_YA_INACTIVO` al re-deshabilitar, pero en realidad devuelve `404 USUARIO_NO_ENCONTRADO`.
- **B2-R3.** ⚠️ **Superadmin y Configuración:** el menú del superadmin muestra "Configuración", pero `GET/PATCH /configuracion` tienen `@Roles('admin_plaza')` (superadmin → `403 ROLE_FORBIDDEN`), y la página usa `session.user.plazaId` (null para superadmin) → banner "Esta pantalla requiere una plaza asignada." Las actions de plaza/logo sí resuelven la plaza seleccionada (`sa_plaza`), pero la página nunca llega a renderizar el formulario.
- **B2-R4.** ⚠️ **`PATCH /plazas/:id` y `POST /plazas/:id/logo` sin `@RequirePermission`:** cualquier `admin_plaza` de la plaza (aunque su rol de staff no tenga `configuracion.editar_general/branding`) puede cambiar nombre, contacto, color y logo llamando directo a la API (la app móvil hablará directo). Solo el BFF web lo frena con `assertAnyCan`. Igual `PATCH /configuracion` acepta cualquiera de los 5 `editar_*` para cualquier campo (OR global).
- **B2-R5.** ⚠️ **Matriz: gate FE vs BE desalineado.** La página acepta `permisos.ver_matriz` **o** `roles_staff.gestionar_permisos`, pero `GET /permisos` y `GET /permisos/roles/:id` exigen solo `permisos.ver_matriz` → un rol con solo `gestionar_permisos` ve "No se pudo cargar el catálogo de permisos (HTTP 403)".
- **B2-R6.** ⚠️ **Rol de sistema detectado por `codigo==='admin'`** en el web (no por `es_sistema`). `RolStaffOutput` no expone `esSistema`; además `PATCH/DELETE /roles-staff/:id` no validan `es_sistema` en el service: renombrar el rol `admin` dispara la excepción del trigger de BD (`ROL_SISTEMA_NO_MODIFICABLE` como error crudo de Postgres; `PrismaExceptionFilter` solo mapea P2002/P2003/P2025 → ⚠️ verificar, probablemente 500 `INTERNAL_ERROR`), y **desactivar** el rol `admin` está permitido (trigger lo deja). El diálogo de edición del web no impide editar el rol `admin`.
- **B2-R7.** **Inconsistencia de código HTTP:** `ROL_SISTEMA_NO_MODIFICABLE` se lanza como `ForbiddenException` (403) en `PermisosService`, pero el catálogo `DOMAIN_ERRORS` lo declara 409. La app debe reaccionar por `code`, no por status.
- **B2-R8.** **Regex de `PermisoCodigoSchema` (`<modulo>.<accion>`, un solo punto) no acepta 15 códigos reales con 3 segmentos** (`solicitudes.bandeja.ver`, `solicitudes.bandeja.asignadas_a_mi`, `solicitudes.detalle.ver`, `solicitudes.adjuntos.{subir,descargar,eliminar}`, `locales.adjuntos.*`, `contratos.adjuntos.*`, `reportes.dashboard.ver`, `reportes.kpis.ver`, `calendario.choques.ver`). Hoy **no rompe nada** porque ni backend ni frontend parsean las respuestas con `PermisoOutputSchema`/`ListarPermisosOutputSchema` (solo casts de tipo). Si la app Flutter genera modelos/validadores desde esos schemas, **no** debe validar `codigo` con esa regex.
- **B2-R9.** **CORS sin `PUT`:** `main.ts` permite `GET, POST, PATCH, DELETE, OPTIONS`; `PUT /permisos/roles/:id` fallaría desde un navegador en llamada directa. Irrelevante para el BFF (server-side) y para una app nativa Flutter (no aplica CORS); sí importaría si se compila Flutter **web**.
- **B2-R10.** **Endpoints/pantallas huérfanas:** `/admin/usuarios-plaza/[id]` no está enlazada desde ninguna pantalla; `POST /usuarios/:id/reset-email-invalido` no se usa en el web (la UI no ofrece "corregir email inválido"); las actions `agregar/quitarPermisoRolAction` no se usan.
- **B2-R11.** **Botones sin `<Can>`:** "Nuevo usuario", "Nuevo rol", "Nueva categoría", formulario de categoría, formulario de tipo de solicitud e input de logo se muestran sin chequear permiso (la action/backend sí lo valida). En móvil conviene ocultarlos con `usuarios_plaza.crear`, `roles_staff.crear`, `categorias.crear`/`editar`, `tipos_solicitud.editar`, `configuracion.editar_branding`.
- **B2-R12.** **Sin reactivación en UI** de categorías ni subcategorías (el backend la permite con `PATCH {activo:true}`); la edición de subcategoría no expone `activo`.
- **B2-R13.** **Bug menor tipo de solicitud:** el form incluye `activo` (valor inicial) en "Guardar cambios"; si el usuario usa el toggle Activar/Desactivar y luego guarda otros campos sin recargar, se reenvía el `activo` viejo y revierte el toggle. En móvil enviar solo los campos cambiados.
- **B2-R14.** **Bug menor supervisores:** el diálogo de supervisores usa el `sub` capturado al abrir; tras agregar/quitar no refleja la lista nueva hasta cerrarlo y reabrirlo.
- **B2-R15.** **`GET /roles-staff` sin `@Roles`:** el comentario dice que el inquilino puede listar roles activos, pero `PermissionsGuard` lo deniega (el endpoint no incluye `inquilino` en `@Roles`) → `403 PERMISSION_DENIED` para inquilino.
- **B2-R16.** **Opciones de responsable/supervisor dependen de `GET /usuarios`**, que exige `usuarios_plaza.listar` o `inquilinos.listar`: un rol con `subcategorias.*` pero sin esos permisos verá selects vacíos.
- **B2-R17.** **Config adjuntos:** `tamanioMaxArchivoMb` admite hasta 2048, pero los endpoints de subida cortan a 100 MB (multer `ADJUNTO_HARD_LIMIT_BYTES`); valores >100 no tienen efecto real. Si una configuración antigua contiene `application/acad` (alias legacy), guardar la pestaña Adjuntos falla con `MIME_NO_PERMITIDO` porque la UI conserva ese valor en el array sin mostrarlo.

### 7.8 Lista completa C · transversales y superadmin

- **C-R1 — El campo de error no coincide entre el front y el backend.** `AllExceptionsFilter` responde con `detail`, nunca con `message`. Varias rutas de la web leen `err.message`, así que siempre muestran el texto genérico de respaldo:
  - `calendario-actions.ts` (feed y mover evento);
  - `api/reportes/export/route.ts`;
  - `superadmin/plazas/actions.ts` (`createPlazaAction`).

  Por ejemplo, `EVENTO_CERRADO` o `PLAZA_SLUG_TAKEN` nunca llegan al usuario. **En móvil hay que leer `detail`.** Ojo: en `VALIDATION_ERROR`, `detail` es un **array** de strings.
- **C-R2 — El superadmin ve "Calendario" en el menú pero el backend lo rechaza.** `GET /calendario` exige `@Roles('admin_plaza','inquilino')` y `GET /configuracion` exige `@Roles('admin_plaza')`, así que el superadmin que impersona recibe 403 `ROLE_FORBIDDEN` y la web muestra un banner de error. Además, `moverEventoAction` deja pasar al superadmin, pero el backend solo acepta `admin_plaza`.
- **C-R3 — El dashboard no se protege en la navegación pero sí en el backend.** El ítem no tiene `permisoRequerido`, pero `/reportes/kpis` exige `reportes.kpis.ver` y `/reportes/dashboard` exige `reportes.dashboard.ver`. Un staff sin esos permisos aterriza en su pantalla de inicio (`/admin/dashboard`) y solo ve "No se pudieron cargar los KPIs.".
- **C-R4 — El "Dashboard global" no siempre es global.** Si el superadmin tiene una plaza seleccionada (cookie `sa_plaza`), `apiFetch` envía `x-plaza-id` también desde `/superadmin/dashboard`, y los KPIs que se muestran son los de esa plaza aunque la página diga "Métricas agregadas de todas las plazas".
- **C-R5 — Desactivar una plaza no bloquea el login (verificado en `auth.service.ts`).** El diálogo promete "Ningún usuario de la plaza podrá iniciar sesión", pero `AuthService.login` y `JwtStrategy.validate` no comprueban `plaza.deleted_at`. `DELETE /plazas/:id` solo marca `deleted_at` en la plaza.
- **C-R6 — Enlaces de auditoría y listas incompletas.**
  - El enlace de auditoría para `entidadTipo = plaza` apunta a `/superadmin/plazas/{id}`, una ruta que no existe (404).
  - El select de tipo de entidad no incluye tipos que sí se auditan (`email_log`, `unsubscribe`, `evento_calendario`, `rol_staff`, …).
- **C-R7 — Faltan valores en filtros de la UI.**
  - `EMAIL_PLANTILLAS` (contracts) no incluye `solicitud-cerrada`, aunque esa plantilla existe en `email-templates.registry.ts`.
  - El filtro `prioridad` de los reportes de solicitudes existe en el backend pero la UI no lo ofrece.
- **C-R8 — Algunos filtros de fecha usan días UTC.** En el log de emails, la auditoría y los reportes, `fechaDesde`/`fechaHasta` se convierten a `T00:00Z`/`T24:00Z` (UTC), no a la hora de El Salvador (UTC-6): un registro creado a las 19:00 hora local cae en el día siguiente.
- **C-R9 — El iCal no aplica filtros.** No tiene rango de fechas (exporta todos los `evento_calendario` históricos, incluidas las solicitudes cerradas), ignora `tipo` y no incluye mantenimientos, hitos ni solicitudes.
- **C-R10 — Listas con tope sin paginación.**
  - Los filtros del calendario y de reportes cargan como máximo 100 locales e inquilinos.
  - `/superadmin/plazas` muestra solo las primeras 50 plazas, sin paginar ni buscar.
  - El selector de plazas carga como máximo 100.
  - Las desuscripciones se limitan a 50.
- **C-R11 — Reportes.**
  - El CSV no tiene tope de filas; XLSX y PDF sí (10 000).
  - La previsualización calcula el conjunto completo y luego recorta a 10.
  - La previsualización de solicitudes también puede responder 413 `RANGO_EXCEDIDO`.
  - El superadmin sin plaza recibe 403 en cualquier export o previsualización.
  - La página no usa `<Can>` en los botones de exportar.
- **C-R12 — Contraseña del admin inicial.** Al crear una plaza, la contraseña del admin inicial solo exige 8 caracteres (`CreatePlazaSchema`), no la política `PasswordSchema` (mayúscula, minúscula y dígito).
- **C-R13 — La campana no aparece para el superadmin.** Tampoco al impersonar, y es coherente con el backend, que rechaza al superadmin en `/notificaciones/inbox*`. La notificación `contrato_por_vencer` solo navega a una ruta de admin.
- **C-R14 — Botones sin protección por permiso en el front.** "Reintentar" y "Ver" (log de emails) y "Resetear" (desuscripciones) no usan `<Can>`: se muestran aunque el usuario no tenga el permiso, y el error aparece en el banner. "Resetear" no pide confirmación (no usa SweetAlert).

## Anexo A. Tabla maestra de endpoints del backend (138 rutas, 21 controllers)

Generada a partir de los decoradores de `backend/src/modules/*/*.controller.ts`. "Roles" = `@Roles(...)` (`autenticado` = sin `@Roles`, cualquier usuario con JWT; `Public` = sin JWT). "Permiso" = `@RequirePermission(...)` en OR. Recordatorio: el inquilino **ignora** `@RequirePermission` si su rol está en `@Roles`; el superadmin pasa siempre; un admin_plaza sin `rolStaffId` (legacy) pasa siempre.

| Método | Ruta | Roles | Permiso (OR) | Controller:línea |
|---|---|---|---|---|
| DELETE | `/api/v1/adjuntos/:id` | admin_plaza, superadmin, inquilino | solicitudes.adjuntos.eliminar, locales.adjuntos.eliminar, contratos.adjuntos.eliminar | `adjuntos/adjuntos.controller.ts:44` |
| GET | `/api/v1/adjuntos/:id/download` | admin_plaza, superadmin, inquilino | solicitudes.adjuntos.descargar, locales.adjuntos.descargar, contratos.adjuntos.descargar | `adjuntos/adjuntos.controller.ts:29` |
| GET | `/api/v1/admin/solicitudes` | superadmin | — | `admin/admin.controller.ts:32` |
| GET | `/api/v1/admin/solicitudes/:id` | superadmin | — | `admin/admin.controller.ts:57` |
| GET | `/api/v1/admin/solicitudes/export.csv` | superadmin | — | `admin/admin.controller.ts:39` |
| GET | `/api/v1/admin/tipos-solicitud` | admin_plaza, superadmin | tipos_solicitud.listar | `tipos-solicitud/tipos-solicitud.controller.ts:49` |
| GET | `/api/v1/admin/tipos-solicitud/:id` | admin_plaza, superadmin | tipos_solicitud.listar | `tipos-solicitud/tipos-solicitud.controller.ts:56` |
| PATCH | `/api/v1/admin/tipos-solicitud/:id` | admin_plaza, superadmin | tipos_solicitud.editar | `tipos-solicitud/tipos-solicitud.controller.ts:71` |
| GET | `/api/v1/auditoria` | admin_plaza, superadmin | auditoria.ver | `auditoria/auditoria.controller.ts:22` |
| PATCH | `/api/v1/auth/change-password` | autenticado | — | `auth/auth.controller.ts:111` |
| POST | `/api/v1/auth/login` | Public | — | `auth/auth.controller.ts:38` |
| POST | `/api/v1/auth/logout` | autenticado | — | `auth/auth.controller.ts:65` |
| GET | `/api/v1/auth/me` | autenticado | — | `auth/auth.controller.ts:127` |
| GET | `/api/v1/auth/me/permisos` | autenticado | — | `auth/auth.controller.ts:157` |
| POST | `/api/v1/auth/refresh` | Public | — | `auth/auth.controller.ts:49` |
| POST | `/api/v1/auth/reset-password` | Public | — | `auth/auth.controller.ts:82` |
| POST | `/api/v1/auth/reset-password/confirm` | Public | — | `auth/auth.controller.ts:96` |
| GET | `/api/v1/calendario` | admin_plaza, inquilino | calendario.ver | `calendario/calendario.controller.ts:39` |
| GET | `/api/v1/calendario/choques` | admin_plaza, inquilino | calendario.choques.ver | `calendario/calendario.controller.ts:55` |
| PATCH | `/api/v1/calendario/eventos/:id/fechas` | admin_plaza | calendario.mover_evento | `calendario/calendario.controller.ts:72` |
| GET | `/api/v1/calendario/export.ics` | admin_plaza, inquilino | calendario.exportar_ics | `calendario/calendario.controller.ts:44` |
| GET | `/api/v1/categorias` | admin_plaza, superadmin, inquilino | categorias.listar | `categorias/categorias.controller.ts:53` |
| POST | `/api/v1/categorias` | admin_plaza, superadmin | categorias.crear | `categorias/categorias.controller.ts:48` |
| DELETE | `/api/v1/categorias/:id` | admin_plaza, superadmin | categorias.deshabilitar | `categorias/categorias.controller.ts:86` |
| GET | `/api/v1/categorias/:id` | admin_plaza, superadmin, inquilino | categorias.listar | `categorias/categorias.controller.ts:67` |
| PATCH | `/api/v1/categorias/:id` | admin_plaza, superadmin | categorias.editar | `categorias/categorias.controller.ts:81` |
| GET | `/api/v1/categorias/:id/subcategorias` | admin_plaza, superadmin, inquilino | categorias.listar | `categorias/categorias.controller.ts:117` |
| POST | `/api/v1/categorias/:id/subcategorias` | admin_plaza, superadmin | subcategorias.crear | `categorias/categorias.controller.ts:101` |
| DELETE | `/api/v1/categorias/:id/subcategorias/:subId` | admin_plaza, superadmin | subcategorias.deshabilitar | `categorias/categorias.controller.ts:163` |
| GET | `/api/v1/categorias/:id/subcategorias/:subId` | admin_plaza, superadmin, inquilino | categorias.listar | `categorias/categorias.controller.ts:139` |
| PATCH | `/api/v1/categorias/:id/subcategorias/:subId` | admin_plaza, superadmin | subcategorias.editar | `categorias/categorias.controller.ts:151` |
| PATCH | `/api/v1/categorias/:id/subcategorias/:subId/responsable` | admin_plaza, superadmin | subcategorias.asignar_responsable | `categorias/categorias.controller.ts:185` |
| POST | `/api/v1/categorias/:id/subcategorias/:subId/supervisores` | admin_plaza, superadmin | subcategorias.gestionar_supervisores | `categorias/categorias.controller.ts:209` |
| DELETE | `/api/v1/categorias/:id/subcategorias/:subId/supervisores/:usuarioId` | admin_plaza, superadmin | subcategorias.gestionar_supervisores | `categorias/categorias.controller.ts:234` |
| GET | `/api/v1/configuracion` | admin_plaza | configuracion.ver | `configuracion/configuracion.controller.ts:18` |
| PATCH | `/api/v1/configuracion` | admin_plaza | configuracion.editar_general, configuracion.editar_branding, configuracion.editar_sla, configuracion.editar_adjuntos, configuracion.editar_calendario | `configuracion/configuracion.controller.ts:26` |
| GET | `/api/v1/contratos` | admin_plaza, superadmin, inquilino | contratos.listar | `contratos/contratos.controller.ts:78` |
| POST | `/api/v1/contratos` | admin_plaza, superadmin | contratos.crear | `contratos/contratos.controller.ts:73` |
| GET | `/api/v1/contratos/:id` | admin_plaza, superadmin, inquilino | contratos.listar | `contratos/contratos.controller.ts:92` |
| PATCH | `/api/v1/contratos/:id` | admin_plaza, superadmin | contratos.editar | `contratos/contratos.controller.ts:106` |
| GET | `/api/v1/contratos/:id/adjuntos` | admin_plaza, superadmin, inquilino | contratos.adjuntos.descargar | `contratos/contratos.controller.ts:160` |
| POST | `/api/v1/contratos/:id/adjuntos` | admin_plaza, superadmin, inquilino | contratos.adjuntos.subir | `contratos/contratos.controller.ts:141` |
| POST | `/api/v1/contratos/:id/cerrar` | admin_plaza, superadmin | contratos.cerrar | `contratos/contratos.controller.ts:111` |
| POST | `/api/v1/contratos/:id/renovar` | admin_plaza, superadmin | contratos.renovar | `contratos/contratos.controller.ts:126` |
| POST | `/api/v1/contratos/cron/test-alertas` | admin_plaza, superadmin | contratos.listar | `contratos/contratos.controller.ts:54` |
| GET | `/api/v1/health` | Public | — | `health/health.controller.ts:21` |
| GET | `/api/v1/health/ready` | Public | — | `health/health.controller.ts:32` |
| POST | `/api/v1/importacion/carga-inicial/analizar` | admin_plaza, superadmin | contratos.importar | `importacion/importacion.controller.ts:32` |
| POST | `/api/v1/importacion/carga-inicial/ejecutar` | admin_plaza, superadmin | contratos.importar | `importacion/importacion.controller.ts:43` |
| GET | `/api/v1/inquilinos` | admin_plaza, superadmin, inquilino | inquilinos.listar | `inquilinos/inquilinos.controller.ts:50` |
| POST | `/api/v1/inquilinos` | admin_plaza, superadmin | inquilinos.crear | `inquilinos/inquilinos.controller.ts:45` |
| DELETE | `/api/v1/inquilinos/:id` | admin_plaza, superadmin | inquilinos.deshabilitar | `inquilinos/inquilinos.controller.ts:111` |
| GET | `/api/v1/inquilinos/:id` | admin_plaza, superadmin, inquilino | inquilinos.listar | `inquilinos/inquilinos.controller.ts:64` |
| PATCH | `/api/v1/inquilinos/:id` | admin_plaza, superadmin | inquilinos.editar | `inquilinos/inquilinos.controller.ts:99` |
| GET | `/api/v1/inquilinos/:id/contratos` | admin_plaza, superadmin, inquilino | contratos.listar | `inquilinos/inquilinos.controller.ts:78` |
| GET | `/api/v1/inquilinos/:id/usuarios` | admin_plaza, superadmin, inquilino | usuarios_plaza.listar, inquilinos.listar | `inquilinos/inquilinos.controller.ts:83` |
| GET | `/api/v1/locales` | admin_plaza, superadmin, inquilino | locales.listar | `locales/locales.controller.ts:56` |
| POST | `/api/v1/locales` | admin_plaza, superadmin | locales.crear | `locales/locales.controller.ts:51` |
| DELETE | `/api/v1/locales/:id` | admin_plaza, superadmin | locales.deshabilitar | `locales/locales.controller.ts:119` |
| GET | `/api/v1/locales/:id` | admin_plaza, superadmin, inquilino | locales.listar | `locales/locales.controller.ts:70` |
| PATCH | `/api/v1/locales/:id` | admin_plaza, superadmin | locales.editar | `locales/locales.controller.ts:89` |
| GET | `/api/v1/locales/:id/adjuntos` | admin_plaza, superadmin | locales.adjuntos.descargar | `locales/locales.controller.ts:159` |
| POST | `/api/v1/locales/:id/adjuntos` | admin_plaza, superadmin | locales.adjuntos.subir | `locales/locales.controller.ts:141` |
| GET | `/api/v1/locales/:id/contratos` | admin_plaza, superadmin | contratos.listar | `locales/locales.controller.ts:84` |
| POST | `/api/v1/locales/:id/fuera-de-servicio` | admin_plaza, superadmin | locales.fuera_de_servicio | `locales/locales.controller.ts:102` |
| GET | `/api/v1/notificaciones` | admin_plaza, superadmin | notificaciones.ver_log | `notificaciones/notificaciones.controller.ts:143` |
| GET | `/api/v1/notificaciones/:id/preview` | admin_plaza, superadmin | notificaciones.ver_preview | `notificaciones/notificaciones.controller.ts:160` |
| POST | `/api/v1/notificaciones/:id/reintentar` | admin_plaza, superadmin | notificaciones.reintentar | `notificaciones/notificaciones.controller.ts:175` |
| GET | `/api/v1/notificaciones/inbox` | admin_plaza, inquilino | — | `notificaciones/notificaciones.controller.ts:85` |
| POST | `/api/v1/notificaciones/inbox/:id/leer` | admin_plaza, inquilino | — | `notificaciones/notificaciones.controller.ts:113` |
| GET | `/api/v1/notificaciones/inbox/conteo` | admin_plaza, inquilino | — | `notificaciones/notificaciones.controller.ts:90` |
| POST | `/api/v1/notificaciones/inbox/leer-todas` | admin_plaza, inquilino | — | `notificaciones/notificaciones.controller.ts:104` |
| GET | `/api/v1/notificaciones/unsubscribe` | Public | — | `notificaciones/notificaciones.controller.ts:53` |
| GET | `/api/v1/notificaciones/unsubscribes` | admin_plaza, superadmin | notificaciones.gestionar_desuscripciones | `notificaciones/notificaciones.controller.ts:124` |
| DELETE | `/api/v1/notificaciones/unsubscribes/:id` | admin_plaza, superadmin | notificaciones.gestionar_desuscripciones | `notificaciones/notificaciones.controller.ts:130` |
| GET | `/api/v1/permisos` | admin_plaza, superadmin | permisos.ver_matriz | `permisos/permisos.controller.ts:45` |
| GET | `/api/v1/permisos/roles/:rolStaffId` | admin_plaza, superadmin | permisos.ver_matriz | `permisos/permisos.controller.ts:55` |
| PUT | `/api/v1/permisos/roles/:rolStaffId` | admin_plaza, superadmin | roles_staff.gestionar_permisos, permisos.asignar_a_roles | `permisos/permisos.controller.ts:62` |
| DELETE | `/api/v1/permisos/roles/:rolStaffId/permisos/:permisoId` | admin_plaza, superadmin | roles_staff.gestionar_permisos, permisos.asignar_a_roles | `permisos/permisos.controller.ts:92` |
| POST | `/api/v1/permisos/roles/:rolStaffId/permisos/:permisoId` | admin_plaza, superadmin | roles_staff.gestionar_permisos, permisos.asignar_a_roles | `permisos/permisos.controller.ts:77` |
| GET | `/api/v1/plazas` | superadmin | — | `plazas/plazas.controller.ts:56` |
| POST | `/api/v1/plazas` | superadmin | — | `plazas/plazas.controller.ts:52` |
| DELETE | `/api/v1/plazas/:id` | superadmin | — | `plazas/plazas.controller.ts:102` |
| GET | `/api/v1/plazas/:id` | superadmin, admin_plaza | — | `plazas/plazas.controller.ts:72` |
| PATCH | `/api/v1/plazas/:id` | superadmin, admin_plaza | — | `plazas/plazas.controller.ts:76` |
| POST | `/api/v1/plazas/:id/logo` | superadmin, admin_plaza | — | `plazas/plazas.controller.ts:86` |
| GET | `/api/v1/reportes/:entidad/export.csv` | admin_plaza, superadmin | reportes.exportar_csv | `reportes/reportes.controller.ts:97` |
| GET | `/api/v1/reportes/:entidad/export.pdf` | admin_plaza, superadmin | reportes.exportar_pdf | `reportes/reportes.controller.ts:129` |
| GET | `/api/v1/reportes/:entidad/export.xlsx` | admin_plaza, superadmin | reportes.exportar_xlsx | `reportes/reportes.controller.ts:110` |
| GET | `/api/v1/reportes/:entidad/preview` | admin_plaza, superadmin | reportes.preview | `reportes/reportes.controller.ts:84` |
| GET | `/api/v1/reportes/dashboard` | admin_plaza, superadmin | reportes.dashboard.ver | `reportes/reportes.controller.ts:43` |
| GET | `/api/v1/reportes/inquilinos/:id/export.pdf` | admin_plaza, superadmin | reportes.ficha_inquilino_pdf | `reportes/reportes.controller.ts:56` |
| GET | `/api/v1/reportes/kpis` | admin_plaza, superadmin | reportes.kpis.ver | `reportes/reportes.controller.ts:35` |
| GET | `/api/v1/reportes/locales/:id/export.pdf` | admin_plaza, superadmin | reportes.ficha_local_pdf | `reportes/reportes.controller.ts:51` |
| GET | `/api/v1/reportes/solicitudes/:id/permiso.pdf` | admin_plaza, superadmin, inquilino | reportes.ficha_local_pdf, solicitudes.detalle.ver | `reportes/reportes.controller.ts:69` |
| GET | `/api/v1/roles-staff` | autenticado | roles_staff.listar | `roles-staff/roles-staff.controller.ts:56` |
| POST | `/api/v1/roles-staff` | admin_plaza, superadmin | roles_staff.crear | `roles-staff/roles-staff.controller.ts:60` |
| DELETE | `/api/v1/roles-staff/:id` | admin_plaza, superadmin | roles_staff.deshabilitar | `roles-staff/roles-staff.controller.ts:95` |
| GET | `/api/v1/roles-staff/:id` | autenticado | roles_staff.listar | `roles-staff/roles-staff.controller.ts:71` |
| PATCH | `/api/v1/roles-staff/:id` | admin_plaza, superadmin | roles_staff.editar | `roles-staff/roles-staff.controller.ts:84` |
| GET | `/api/v1/roles-staff/con-asignaciones` | admin_plaza, superadmin | roles_staff.listar | `roles-staff/roles-staff.controller.ts:46` |
| GET | `/api/v1/solicitudes` | admin_plaza, superadmin, inquilino | solicitudes.bandeja.ver | `solicitudes/solicitudes.controller.ts:82` |
| POST | `/api/v1/solicitudes` | inquilino | — | `solicitudes/solicitudes.controller.ts:67` |
| GET | `/api/v1/solicitudes/:id` | admin_plaza, superadmin, inquilino | solicitudes.detalle.ver | `solicitudes/solicitudes.controller.ts:96` |
| PATCH | `/api/v1/solicitudes/:id` | inquilino | — | `solicitudes/solicitudes.controller.ts:110` |
| GET | `/api/v1/solicitudes/:id/adjuntos` | admin_plaza, superadmin, inquilino | solicitudes.adjuntos.descargar, solicitudes.detalle.ver | `solicitudes/solicitudes.controller.ts:249` |
| POST | `/api/v1/solicitudes/:id/adjuntos` | admin_plaza, superadmin, inquilino | solicitudes.adjuntos.subir | `solicitudes/solicitudes.controller.ts:242` |
| POST | `/api/v1/solicitudes/:id/aprobar` | admin_plaza, superadmin | solicitudes.aprobar | `aprobaciones/aprobaciones.controller.ts:135` |
| POST | `/api/v1/solicitudes/:id/cancelar` | admin_plaza, superadmin, inquilino | solicitudes.cancelar | `solicitudes/solicitudes.controller.ts:134` |
| POST | `/api/v1/solicitudes/:id/cerrar` | admin_plaza, superadmin | solicitudes.cerrar | `aprobaciones/aprobaciones.controller.ts:152` |
| GET | `/api/v1/solicitudes/:id/comentarios` | admin_plaza, superadmin, inquilino | solicitudes.detalle.ver | `solicitudes/solicitudes.controller.ts:211` |
| POST | `/api/v1/solicitudes/:id/comentarios` | admin_plaza, superadmin, inquilino | solicitudes.comentar | `solicitudes/solicitudes.controller.ts:194` |
| POST | `/api/v1/solicitudes/:id/duplicar` | inquilino | — | `solicitudes/solicitudes.controller.ts:165` |
| POST | `/api/v1/solicitudes/:id/enviar` | inquilino | — | `solicitudes/solicitudes.controller.ts:114` |
| GET | `/api/v1/solicitudes/:id/historial` | admin_plaza, superadmin, inquilino | solicitudes.detalle.ver | `solicitudes/solicitudes.controller.ts:226` |
| POST | `/api/v1/solicitudes/:id/liberar` | admin_plaza, superadmin | solicitudes.liberar | `aprobaciones/aprobaciones.controller.ts:121` |
| POST | `/api/v1/solicitudes/:id/pausar` | admin_plaza, superadmin | solicitudes.pausar | `aprobaciones/aprobaciones.controller.ts:218` |
| POST | `/api/v1/solicitudes/:id/pedir-subsanacion` | admin_plaza, superadmin | solicitudes.pedir_subsanacion | `aprobaciones/aprobaciones.controller.ts:186` |
| PATCH | `/api/v1/solicitudes/:id/prioridad` | admin_plaza, superadmin | solicitudes.cambiar_prioridad | `solicitudes/solicitudes.controller.ts:180` |
| POST | `/api/v1/solicitudes/:id/reanudar` | admin_plaza, superadmin | solicitudes.reanudar | `aprobaciones/aprobaciones.controller.ts:236` |
| POST | `/api/v1/solicitudes/:id/reasignar` | admin_plaza, superadmin | solicitudes.reasignar | `aprobaciones/aprobaciones.controller.ts:203` |
| POST | `/api/v1/solicitudes/:id/rechazar` | admin_plaza, superadmin | solicitudes.rechazar | `aprobaciones/aprobaciones.controller.ts:171` |
| POST | `/api/v1/solicitudes/:id/subsanar` | inquilino | — | `solicitudes/solicitudes.controller.ts:148` |
| POST | `/api/v1/solicitudes/:id/tomar` | admin_plaza, superadmin | solicitudes.tomar | `aprobaciones/aprobaciones.controller.ts:114` |
| GET | `/api/v1/solicitudes/bandeja` | admin_plaza, superadmin | solicitudes.bandeja.ver, solicitudes.bandeja.asignadas_a_mi | `aprobaciones/aprobaciones.controller.ts:60` |
| POST | `/api/v1/solicitudes/cron/test-auto-asignacion` | admin_plaza, superadmin | solicitudes.tomar | `aprobaciones/aprobaciones.controller.ts:65` |
| POST | `/api/v1/solicitudes/cron/test-mantenimiento-fin` | admin_plaza, superadmin | solicitudes.aprobar | `aprobaciones/aprobaciones.controller.ts:94` |
| POST | `/api/v1/solicitudes/cron/test-sla-refresh` | admin_plaza, superadmin | solicitudes.bandeja.ver | `aprobaciones/aprobaciones.controller.ts:82` |
| GET | `/api/v1/solicitudes/duplicados` | admin_plaza, superadmin, inquilino | solicitudes.bandeja.ver, solicitudes.detalle.ver | `solicitudes/solicitudes.controller.ts:60` |
| GET | `/api/v1/solicitudes/tipos` | admin_plaza, superadmin, inquilino | tipos_solicitud.listar | `tipos-solicitud/tipos-solicitud.controller.ts:36` |
| GET | `/api/v1/usuarios` | admin_plaza, superadmin | usuarios_plaza.listar, inquilinos.listar | `usuarios/usuarios.controller.ts:51` |
| POST | `/api/v1/usuarios` | admin_plaza, superadmin | usuarios_plaza.crear, inquilinos.alta_usuario | `usuarios/usuarios.controller.ts:56` |
| DELETE | `/api/v1/usuarios/:id` | admin_plaza, superadmin | usuarios_plaza.deshabilitar, inquilinos.deshabilitar_usuario | `usuarios/usuarios.controller.ts:101` |
| GET | `/api/v1/usuarios/:id` | admin_plaza, superadmin | usuarios_plaza.listar, inquilinos.listar | `usuarios/usuarios.controller.ts:83` |
| PATCH | `/api/v1/usuarios/:id` | admin_plaza, superadmin | usuarios_plaza.editar, inquilinos.editar | `usuarios/usuarios.controller.ts:67` |
| POST | `/api/v1/usuarios/:id/reactivate` | admin_plaza, superadmin | usuarios_plaza.reactivar, inquilinos.reactivar_usuario | `usuarios/usuarios.controller.ts:137` |
| POST | `/api/v1/usuarios/:id/reset-email-invalido` | admin_plaza, superadmin | usuarios_plaza.editar, inquilinos.editar | `usuarios/usuarios.controller.ts:158` |
| POST | `/api/v1/usuarios/:id/reset-password` | admin_plaza, superadmin | usuarios_plaza.resetear_clave, inquilinos.resetear_clave | `usuarios/usuarios.controller.ts:116` |
