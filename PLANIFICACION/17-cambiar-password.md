# 17 · Cambiar contraseña (usuario autenticado)

> **Estado:** ✅ Implementada (2026-09-25).
> **Cierra en UI** el CU-AU-5 (`docs/03-modulos-del-sistema.md`). El endpoint ya existía desde T-030.

## Contexto

El backend exponía `PATCH /api/v1/auth/change-password` (T-030), pero el frontend no tenía ningún punto de entrada, así que los usuarios no podían cambiar su contraseña. Se pidió ubicarlo cerca del botón de cerrar sesión.

## Decisiones

| # | Decisión | Justificación |
|---|---|---|
| D1 | Botón con icono de llave (`KeyRound`) **junto a "Cerrar sesión" en el pie de la sidebar**, disponible para los tres roles. | El logout vive en la sidebar (no en el topbar); no existe menú de usuario desplegable. |
| D2 | Tras un cambio exitoso se **cierra la sesión** y se redirige a `/login?password_changed=1` (toast de confirmación). | El backend revoca todos los refresh tokens del usuario; la sesión actual moriría en el siguiente refresh. Cerrarla de forma controlada es coherente y avisa al usuario. |
| D3 | La nueva contraseña debe ser **distinta de la actual**: `refine` en el cliente + `400 SAME_PASSWORD` en el backend. | Defensa en profundidad. |
| D4 | Sin dependencias nuevas. | Diálogo con shadcn `Dialog` + React Hook Form + Zod, igual que el resto de los diálogos. |

## Archivos tocados

- `packages/contracts/src/auth/index.ts`: `ChangePasswordFormSchema` (confirmación + distinta de la actual) y tipo `ChangePasswordFormInput`.
- `backend/src/modules/auth/auth.service.ts`: `changePassword` rechaza la misma contraseña con `SAME_PASSWORD`.
- `backend/src/common/interceptors/auditoria.interceptor.ts`: `currentpassword`, `newpassword` y `confirmpassword` añadidas a `LLAVES_SENSIBLES` (el endpoint ya usa `omitirBody`).
- `frontend/src/app/change-password-action.ts` (nuevo): Server Action (BFF) que mapea `INVALID_CURRENT_PASSWORD` / `SAME_PASSWORD` al campo del formulario.
- `frontend/src/app/logout-action.ts`: `logoutAndRedirect(url)` (solo acepta destinos `/login…`, sin open-redirect); `logoutAction` delega en ella.
- `frontend/src/components/client/cambiar-password-dialog.tsx` (nuevo): diálogo con 3 campos, mostrar/ocultar, hint de la política y aviso de cierre de sesión.
- `frontend/src/components/shell/sidebar.tsx` + `globals.css`: contenedor `.side-foot-actions` (fila; columna con la sidebar colapsada).
- `frontend/src/components/client/login-form.tsx`: toast `password_changed=1` (con `id` fijo para no duplicarse por StrictMode).

## Verificación realizada (2026-09-25, stack local levantado)

- UI (Playwright, `inquilino@demo.com`): confirmación distinta, misma contraseña, contraseña débil y contraseña actual incorrecta muestran el error en su campo sin cerrar la sesión. Un cambio válido redirige a `/login?password_changed=1` con el toast; el login con la nueva contraseña funciona. La contraseña demo se restauró.
- API (`admin@demo.com`): `SAME_PASSWORD` → 400; un cambio válido → 204; refresh con el token previo → 401; login con la contraseña vieja → 401. Contraseña restaurada.
- `auditoria`: filas `auth.password_change` con `despues = null` (sin body).
- Layout: pie de la sidebar a 1280 px (fila), colapsada (columna) y drawer a 390 px; diálogo a 390 px sin scroll horizontal.
- `npm run lint` y `npm run type-check` (frontend), `tsc --noEmit` (backend): sin errores nuevos.

## Bitácora de cambios

- 2026-09-25 · Implementación inicial (D1–D4). ⚠️ Gotcha de entorno: el dev server (Turbopack) no recompiló `globals.css` tras la edición ni con `touch`; se regeneró al hacer un cambio real de contenido. Si un estilo nuevo "no aplica" en dev, comprobar el CSS servido antes de depurar el componente.
