# Permisos · RBAC granular de Plazapp

> Documentación canónica del sistema de permisos granulares para **Admin
> Plaza** (`/admin/*`). Lee este archivo antes de añadir un permiso nuevo,
> crear un endpoint protegido, o crear un rol custom.

## 1. Introducción

Plazapp usa un sistema RBAC (Role-Based Access Control) **híbrido** que combina:

- **3 roles globales fijos** (`superadmin`, `admin_plaza`, `inquilino`) —
  inmutables, declarados en `packages/contracts/src/usuarios/index.ts`. Definen
  el **perímetro máximo** al que un usuario puede acceder.
- **Roles de staff por plaza** (`rol_staff`) — `admin_plaza` los usa para
  clasificar al personal (técnico, supervisor, etc.).
- **Permisos granulares** (`permiso`) — un catálogo global de **~80 acciones
  atómicas** (`solicitudes.aprobar`, `locales.crear`, etc.) que el backend
  verifica en cada request y el frontend usa para gating fino de UI.

La diferencia clave respecto al modelo anterior: un `admin_plaza` ya **no
tiene acceso total por defecto**. Cada acción requiere un permiso específico
que se otorga a través del `rol_staff` del usuario.

**Alcance:** el RBAC aplica **solo al segmento `/admin/*`**. El flujo de
inquilino (`/inquilino/*`) y el panel de superadmin (`/superadmin/*`)
operan con los roles globales como hasta ahora (no se rompe nada para
inquilinos).

---

## 2. Roles globales (no se modifican)

| `rol` global | `plaza_id` | Acceso |
|---|---|---|
| `superadmin` | `NULL` (plataforma) | Todas las plazas. JWT contiene `permisos: ['*']`. |
| `admin_plaza` | obligatorio | Solo su plaza. Permisos derivados del `rol_staff` asignado. |
| `inquilino` | obligatorio | Solo su panel de inquilino. Sin permisos granulares. |

Estos roles **no se renombran, eliminan ni reemplazan**. Son el primer
filtro que aplica el `RolesGuard` antes del `PermissionsGuard`.

---

## 3. Roles de staff + permisos (lo nuevo)

### 3.1 Modelo de datos

Tres tablas nuevas (migración RBAC, ver §10):

```
permiso                       (catálogo global, sin plaza_id)
  codigo PK lógico, modulo, accion, descripcion

rol_staff_permiso             (pivote por-plaza con RLS)
  rol_staff_id + permiso_id   (PK compuesta)
  plaza_id (desnormalizado para RLS)
  otorgado_por (FK opcional a usuario.id)

rol_staff                     (existente, ahora con campo)
  es_sistema BOOLEAN          ← rol "admin" del sistema
```

### 3.2 Resolución de permisos efectivos

Al emitir el JWT (login o refresh), el backend calcula los permisos del
usuario:

```
if (usuario.rol === 'superadmin')          → ['*']           // wildcard
if (usuario.rol === 'admin_plaza' y !rol_staff_id)
                                            → TODOS los del catálogo
if (usuario.rol === 'admin_plaza' y rol_staff_id)
                                            → permisos del rol_staff asignado
if (usuario.rol === 'inquilino')           → []              // sin RBAC granular
```

Estos permisos viajan en el JWT como `permisos: string[]` y se cachean en
la sesión de Auth.js. Latencia: cero (no se consulta BD en cada request).

### 3.3 Multi-tenancy

La tabla `rol_staff_permiso` tiene **RLS activo** (igual que el resto de
tablas de negocio): un usuario de la plaza A nunca puede ver ni modificar
los permisos asignados en la plaza B. La verificación se hace en el test
§12 paso 5.

---

## 4. El rol "admin" del sistema

Es un `rol_staff` con `es_sistema = true` y `codigo = 'admin'`:

- **Inamovible:** el backend rechaza su edición, deshabilitación o
  eliminación con `ROL_SISTEMA_NO_MODIFICABLE` (409).
- **Auto-asignado:** el seed (`backend/prisma/seed.ts`) lo crea en cada
  plaza y le asigna **TODOS los permisos del catálogo**.
- **Intransferible:** su `id` se siembra una vez; ningún admin_plaza puede
  duplicarlo ni renombrarlo.
- **Único gestor de la matriz:** solo un usuario con este rol asignado
  puede asignar/quitar permisos de otros roles
  (`permisos.asignar_a_roles`).

Convención UI: la página `/admin/usuarios-plaza/permisos` detecta el rol
"admin" por convención (`codigo === 'admin'`) — no se expone el flag
`es_sistema` en la API. Esto evita leaks de metadata interna.

---

## 5. Catálogo de permisos

Catálogo completo: **80 permisos** agrupados por módulo. Fuente única:
`backend/prisma/seed-data/permisos.ts`. La UI los muestra en ese orden
(módulos alfabéticos, permisos alfabéticos dentro del módulo).

Módulos principales:

| Módulo | Permisos | Notas |
|---|---|---|
| `usuarios-plaza` | 11 | CRUD + reset + gestión de roles_staff |
| `solicitudes` | 16 | Bandeja, detalle, tomar, decidir, reasignar, comentarios, adjuntos |
| `locales` | 8 | CRUD + fuera_de_servicio + adjuntos |
| `inquilinos` | 9 | CRUD + gestión de usuarios inquilino |
| `contratos` | 8 | CRUD + adjuntos |
| `categorias` | 9 | CRUD + subcategorías + responsables + supervisores |
| `tipos-solicitud` | 2 | Listar / editar (catálogo semilla) |
| `reportes` | 8 | Preview + exportaciones (CSV/XLSX/PDF/fichas) |
| `notificaciones` | 4 | Log + reintentar + preview + desuscripciones |
| `configuracion` | 6 | Ver + 5 sub-áreas editables |
| `calendario` | 4 | Ver + exportar + choques + mover |
| `permisos` | 2 | Ver matriz + asignar (este último solo rol admin) |
| `auditoria` | 1 | Ver log |

Para ver la lista canónica, ejecuta `npx prisma studio` y abre la tabla
`permiso`, o lee directamente `backend/prisma/seed-data/permisos.ts`.

---

## 6. Cómo agregar un nuevo permiso (procedimiento OBLIGATORIO)

⚠️ **Este es el único flujo válido.** Saltarse pasos deja el sistema
inconsistente (UI que muestra el permiso pero BD sin fila, o endpoint que
lo exige pero el seed no lo crea).

### Paso 1: Definir el código

Añade una entrada en `backend/prisma/seed-data/permisos.ts` siguiendo la
convención `<modulo>.<accion>` en snake_case lowercase. Ejemplo:

```ts
{
  codigo: 'solicitudes.comentar_interno',
  modulo: 'solicitudes',
  accion: 'comentar_interno',
  descripcion: 'Comentar una solicitud con visibilidad solo staff.',
},
```

Añade la entrada **al final del módulo correspondiente** para preservar el
orden de la matriz UI.

### Paso 2: Registrar en BD (seed idempotente)

Ejecuta `npx prisma db seed` (idempotente: `upsert` por `codigo`). Esto
crea la fila en `permiso` y, automáticamente, **se la asigna al rol
"admin"** de cada plaza (porque el seed procesa todos los permisos contra
todos los roles `es_sistema = true`).

No se requiere migración nueva — la tabla `permiso` ya existe.

### Paso 3: Aplicar el decorador en el endpoint (backend)

```ts
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Post(':id/comentario-interno')
@Roles('admin_plaza', 'superadmin')
@RequirePermission('solicitudes.comentar_interno')
async addComentarioInterno(@Param('id') id: string, ...) { ... }
```

Para endpoints polimórficos que cubren varios contextos (ej: adjuntos
de solicitud/local/contrato), acepta un **OR array** de permisos:

```ts
@RequirePermission([
  'solicitudes.adjuntos.descargar',
  'locales.adjuntos.descargar',
  'contratos.adjuntos.descargar',
])
```

### Paso 4: Aplicar `assertCan` / `assertAnyCan` en el Server Action

`frontend/src/app/(admin-plaza)/admin/<modulo>/actions.ts`:

```ts
import { ForbiddenError, assertAnyCan } from '@/lib/server/assert-can';

async function ensureCan(permisos: string[]): Promise<{ ok: false; error: string } | null> {
  try {
    await assertAnyCan(permisos);
    return null;
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function addComentarioInternoAction(...) {
  const denied = await ensureCan(['solicitudes.comentar_interno']);
  if (denied) return denied;
  // ...
}
```

Convenciones:
- `assertCan(permiso)` → exige **uno** de los permisos del array.
- `assertAnyCan([a, b])` → **OR** (basta con uno) — usar cuando un mismo
  botón cubre varios contextos (ej: el botón "Descargar adjunto" del
  módulo de contratos usa el OR de los tres `*.adjuntos.descargar`).

### Paso 5: Aplicar gating en el Client Component (frontend)

```tsx
import { Can } from '@/components/client/can';

<Can permiso="solicitudes.comentar_interno">
  <Button onClick={...}>Comentario interno</Button>
</Can>
```

`<Can>` lee los permisos del usuario vía `useSession()`. Para Server
Components, pasa los permisos como **prop** al Client Component:

```tsx
// page.tsx (Server Component)
<Component permisos={session.user.permisos ?? []} />

// component.tsx (Client Component)
function Component({ permisos }: { permisos: readonly string[] }) {
  return can(permisos, 'solicitudes.comentar_interno') ? <Button /> : null;
}
```

### Paso 6: Asignar al rol "admin" (automático)

Tras correr el seed en paso 2, el rol "admin" ya tiene el permiso nuevo.
**No requiere acción manual.**

Para usuarios con roles custom (no "admin"), el owner del rol debe
asignar el permiso desde `/admin/usuarios-plaza/permisos` usando la
matriz UI.

### Paso 7: Documentar la bitácora

Si el permiso está ligado a una tarea de `PLANIFICACION/*.md`, abre
entrada de bitácora con la desviación si la hay. Si es un permiso nuevo
fuera del plan original, documenta el porqué en la sección del módulo
afectado.

---

## 7. Cómo agregar un nuevo endpoint protegido

Si el endpoint NO usa un permiso nuevo (usa uno ya existente del
catálogo), basta con:

1. Aplicar `@RequirePermission('codigo.existente')` en el controller.
2. Aplicar `await assertCan('codigo.existente')` en el Server Action (si
   existe uno equivalente).
3. Aplicar `<Can permiso="codigo.existente">` en el Client Component (si
   la acción está en UI).
4. No requiere migración ni seed (el permiso ya existe).

---

## 8. Cómo crear un rol custom

UI: `/admin/usuarios-plaza` → pestaña **"Permisos"**.

Flujo:

1. Click en **"Nuevo rol"** (requiere `roles_staff.crear`).
2. Ingresar `codigo` (kebab-case único en la plaza) y `nombre`.
3. Click en **"Gestionar permisos"** del nuevo rol
   (requiere `permisos.asignar_a_roles`).
4. Marcar/desmarcar checkboxes en la matriz.
5. Click en **"Guardar"**.
6. Crear usuarios con `rolStaffId = <id del nuevo rol>` desde la pestaña
   "Usuarios de plaza".

⚠️ Solo el rol "admin" puede asignar permisos a otros roles. Esto se
garantiza con `@RequirePermission('roles_staff.gestionar_permisos')` en el
backend y con gating fino en la UI.

---

## 9. Cómo auditar cambios en permisos

Cada `POST`/`PATCH`/`DELETE` sobre `rol_staff_permiso` queda registrado en
la tabla `auditoria` con:

- `entidad_tipo = 'rol_staff_permiso'`
- `entidad_id = <id del rol_staff afectado>` (no del permiso individual)
- `accion = 'INSERT' | 'DELETE'` (PUT se traduce a múltiples)
- `metadata = { permiso_codigo, plaza_id, otorgado_por }`

Consultar vía `GET /auditoria?entidadTipo=rol_staff_permiso` (requiere
`auditoria.ver`). Sin UI en v1 — usar Swagger o `psql` directo.

---

## 10. Pendientes por módulo (gating fino progresivo)

Estado del refactor `assertAnyCan` en Server Actions y `<Can>` en Client
Components (2026-06-24):

| Módulo | Server Actions | Client Components | Notas |
|---|---|---|---|
| `permisos` | ✅ Completo | ✅ Completo | Único con UI de gestión |
| `usuarios-plaza` | ✅ Completo | ✅ Completo | Tabla + acciones |
| `roles-staff` | ✅ Completo | ✅ Completo | Tabla + acciones |
| `solicitudes` (admin) | ✅ Completo | ✅ Completo | Panel de decisión |
| `locales` | ✅ Completo | ✅ Completo | Tabla + desactivar |
| `inquilinos` | ✅ Completo | ✅ Completo | Tabla + desactivar |
| `contratos` | ✅ Completo | ✅ Completo | Tabla sin acciones inline |
| `categorias` | ✅ Completo | ✅ Completo | Tabla + subcategorías |
| `tipos-solicitud` | ✅ Completo | ⏳ Pendiente | Editor individual en página |
| `reportes` | ✅ Completo | ⏳ Pendiente | Botones de exportación |
| `notificaciones` | ✅ Completo | ⏳ Pendiente | Botones de la tabla |
| `configuracion` | ✅ Completo | ✅ Completo | 5 tabs con save |
| `calendario` | — (sin Server Actions específicos) | ⏳ Pendiente | Botón "mover evento" |
| `adjuntos` (polimórfico) | ✅ Completo | ⏳ Pendiente | `<AdjuntoUploader>` |

Los "⏳ Pendiente" son botones en Client Components que aún no se han
envuelto con `<Can>`. Los Server Actions ya están protegidos (defensa en
backend), así que la falta de gating fino en el cliente solo afecta UX
(no seguridad). Se cierran progresivamente sin bloqueante.

---

## 11. Compatibilidad hacia atrás

- **admin_plaza sin `rol_staff`:** recibe TODOS los permisos en el JWT
  (compat con datos seed existentes que aún no tienen rol asignado).
- **superadmin:** recibe wildcard `['*']` → `can()` siempre devuelve true.
- **inquilino:** intacto. Su JWT no lleva `permisos` (o lo lleva vacío) y
  el `PermissionsGuard` solo aplica a endpoints decorados, que en el flujo
  de inquilino son nulos en esta fase.
- **Endpoints sin `@RequirePermission`:** siguen funcionando solo con el
  `@Roles(...)` existente. El guard global es **opt-in**: si no hay
  metadata, no aplica gating fino.

---

## 12. Pruebas manuales

### Preparación

```bash
# Levantar entorno
docker compose up -d postgres minio mailhog
cd backend && npm run start:dev
cd frontend && npm run dev

# Cargar permisos (idempotente)
cd backend && npx prisma db seed
```

### Casos a verificar

1. **Seed correcto:** `permiso` tiene ~80 filas; `rol_staff` con
   `codigo='admin'` y `es_sistema=true` existe en plaza demo;
   `rol_staff_permiso` tiene ~80 filas para ese rol;
   `admin@demo.com` tiene `rol_staff_id` apuntando al rol admin.

2. **Login admin demo:** JWT contiene `permisos: [...todos los 80...]`.
   Sidebar muestra todos los items. Todos los botones de acción visibles.

3. **Crear rol custom "Visualizador":** crear rol_staff con código
   `visualizador` (sin permisos) → asignar 3 permisos desde la matriz →
   crear usuario `visualizador@demo.com` con ese `rol_staff_id` → login:
   sidebar muestra solo items permitidos; los botones de crear/editar/
   deshabilitar están ocultos; los endpoints rechazan con 403 si los
   invoca por URL directa (`curl`).

4. **Borrar rol "admin":** API rechaza con `409 ROL_SISTEMA_NO_MODIFICABLE`.
   UI: botón "Desactivar" del rol admin está deshabilitado con tooltip.

5. **Multi-tenancy (defensa crítica):** crear plaza 2 con su propio rol
   custom → verificar que un admin de plaza 1 NO ve ni modifica los
   permisos de la plaza 2 (RLS en `rol_staff_permiso`). Test con
   `curl -H "Authorization: Bearer <jwt_plaza_1>"` apuntando a un
   `rol_staff_id` de plaza 2 → debe responder 404 (RLS oculta la fila).

6. **Inquilino intacto:** login de `inquilino@demo.com` ve la UI de
   inquilino exactamente igual que antes; ningún item del sidebar de
   admin plaza aparece; ningún endpoint admin devuelve 403 por permisos
   (porque el rol `inquilino` no aplica al RBAC granular en esta fase).

7. **Compat admin_plaza sin rol_staff:** crear usuario admin_plaza sin
   `rol_staff_id` → JWT contiene `permisos: [<todos los 80>]`. Sidebar
   completo. UI sin restricciones.

### Auditoría

```sql
-- Cambios recientes en permisos de un rol concreto
SELECT a.created_at, a.accion, a.metadata
FROM auditoria a
WHERE a.entidad_tipo = 'rol_staff_permiso'
  AND a.entidad_id = '<rol_staff_id>'
ORDER BY a.created_at DESC
LIMIT 50;
```

---

## Referencias internas

- `backend/prisma/seed-data/permisos.ts` — catálogo canónico.
- `backend/src/common/decorators/require-permission.decorator.ts` — `@RequirePermission`.
- `backend/src/common/guards/permissions.guard.ts` — `PermissionsGuard` global.
- `backend/src/modules/permisos/` — controller + service del módulo permisos.
- `frontend/src/lib/can.ts` — helper `can()`.
- `frontend/src/lib/server/assert-can.ts` — `assertCan` / `assertAnyCan` + `ForbiddenError`.
- `frontend/src/components/client/can.tsx` — `<Can>` Client Component.
- `frontend/src/components/shell/nav-config.ts` — gating del sidebar.
- `frontend/src/app/(admin-plaza)/admin/usuarios-plaza/permisos/` — UI matriz.

## Decisiones de diseño

- **Permisos en JWT, no en cada request:** cero latencia, refresh cada 1h.
  Trade-off: cambios en permisos tardan hasta 1h en propagarse. Aceptable
  para v1; si el negocio exige inmediatez, pasar a "consultar BD bajo
  demanda" (configurable por endpoint).
- **OR dentro del array `@RequirePermission(['a','b'])`:** se eligió OR
  sobre AND porque refleja la realidad de los endpoints polimórficos
  (un adjunto puede pertenecer a solicitud, local o contrato).
- **Wildcard `['*']` para superadmin:** evita tener que mantener una
  copia maestra de permisos en el frontend (que ya tiene 80).
- **Convención "rol admin" por `codigo === 'admin'`:** evita exponer el
  flag `es_sistema` en la API pública y mantiene la UI simple.