# Módulo 05 — Categorías y Subcategorías

> **Propósito:** CRUD de categorías (per-plaza), CRUD de subcategorías con asignación de 1 responsable y hasta 5 supervisores (enforced por trigger PL/pgSQL), validación SC-6 (responsable y supervisores deben ser `admin_plaza` con `rol_staff` activo y misma plaza), cambio de responsable con reasignación de solicitudes futuras, y pantallas asociadas.
>
> **Pre-requisito:** T-001 a T-046 (setup, auth, plazas) y T-047 a T-062 (locales, contratos) deben estar `Completada`.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-063 | Crear migración Prisma con `categoria` | Alta | Pendiente |
| T-064 | Crear migración Prisma con `subcategoria` | Alta | Pendiente |
| T-065 | Crear migración Prisma con `subcategoria_supervisor` (N:M) | Alta | Pendiente |
| T-066 | Crear trigger `tg_subcategoria_max_5_supervisores` | Alta | Pendiente |
| T-067 | Implementar CRUD categorias (POST/GET/PATCH/DELETE) | Alta | Pendiente |
| T-068 | Implementar CRUD subcategorias (POST/GET/PATCH/DELETE) | Alta | Pendiente |
| T-069 | Implementar asignación/cambio de responsable de subcategoría | Alta | Pendiente |
| T-070 | Implementar endpoints de supervisores (POST/DELETE) | Alta | Pendiente |
| T-071 | Validar SC-6 en aplicación (responsable y supervisores admin_plaza con rol_staff activo y misma plaza) | Alta | Pendiente |
| T-072 | Implementar pantalla /admin/categorias | Alta | Pendiente |
| T-073 | Implementar pantalla /admin/categorias/[id]/subcategorias | Alta | Pendiente |

---

### T-063 — Crear migración Prisma con `categoria`

- **Descripción:** Crear el modelo `categoria` configurable por plaza: `id` (UUID), `plaza_id` (FK), `nombre` (UNIQUE por plaza), `descripcion`, `activo` (bool, soft delete), `created_at`, `updated_at`. Materializa S-Categorias y S-MD-L.
- **Criterios de aceptación:**
  - [ ] Modelo `categoria` con todos los campos.
  - [ ] Índice `UNIQUE(plaza_id, nombre)`, `INDEX(plaza_id, activo)`.
  - [ ] Migración aplicada.
  - [ ] Validación Zod: `nombre` 1-80 chars, `descripcion` máx 500.
  - [ ] RLS habilitado.
  - [ ] Seed inicial: 4 categorías base por plaza demo (`Mantenimiento`, `Eventos`, `Remodelaciones`, `Otros`).
- **Dependencias:** T-036 (en `03-plazas-multitenant.md`), T-038.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-064 — Crear migración Prisma con `subcategoria`

- **Descripción:** Crear el modelo `subcategoria`: `id` (UUID), `plaza_id` (FK), `categoria_id` (FK), `responsable_id` (FK a `usuario`, debe ser `admin_plaza` con `rol_staff` activo), `nombre` (UNIQUE por categoría), `descripcion`, `prioridad` (ENUM default `B`), `activo` (bool), `created_at`, `updated_at`. Materializa S-Subcategoria y SC-6.
- **Criterios de aceptación:**
  - [ ] Modelo `subcategoria` con todos los campos.
  - [ ] Índice `UNIQUE(categoria_id, nombre)`, `INDEX(plaza_id, activo)`, `INDEX(responsable_id)`.
  - [ ] ENUM `solicitud_prioridad` (A|B|C|D|F) usado en `prioridad` (se crea en T-079, en `06-solicitudes.md`).
  - [ ] Migración aplicada.
  - [ ] Validación Zod: `nombre` 1-80, `prioridad` ∈ {A,B,C,D,F}.
  - [ ] RLS habilitado.
- **Dependencias:** T-063, T-018, T-019.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-065 — Crear migración Prisma con `subcategoria_supervisor` (N:M)

- **Descripción:** Crear la tabla pivote `subcategoria_supervisor` con PK compuesta (`subcategoria_id`, `usuario_id`) y `created_at`. ON DELETE CASCADE. Materializa S-SC-A.
- **Criterios de aceptación:**
  - [ ] Modelo `subcategoria_supervisor` con PK compuesta.
  - [ ] Migración aplicada.
  - [ ] FK a `subcategoria` con `onDelete: Cascade`.
  - [ ] FK a `usuario`.
  - [ ] RLS habilitado (heredado del `plaza_id` de la subcategoría, vía función).
  - [ ] Una política RLS que une `subcategoria_supervisor` con `subcategoria.plaza_id`.
- **Dependencias:** T-064.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-066 — Crear trigger `tg_subcategoria_max_5_supervisores`

- **Descripción:** Crear un trigger `BEFORE INSERT OR UPDATE` en `subcategoria_supervisor` que rechace la operación si al insertar la fila nueva el conteo de supervisores para esa `subcategoria_id` supera 5. Materializa S-SC-A y la regla de `docs/04` §1.7 (S-MD-M).
- **Criterios de aceptación:**
  - [ ] Migración `00X_subcategoria_max_5_supervisores_trigger/migration.sql`.
  - [ ] Trigger que cuenta filas en `subcategoria_supervisor WHERE subcategoria_id = NEW.subcategoria_id` y aborta si `> 5`.
  - [ ] Excepción con código `SUBCATEGORIA_MAX_5_SUPERVISORES` y mensaje claro.
  - [ ] Test: agregar 5 supervisores OK, el 6º falla con el error.
  - [ ] El trigger maneja correctamente UPDATE (no doble-conteo del mismo registro).
  - [ ] El trigger se elimina correctamente al hacer DELETE (y permite re-INSERT).
- **Dependencias:** T-065.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-067 — Implementar CRUD categorias (POST/GET/PATCH/DELETE)

- **Descripción:** Implementar el CRUD de categorías. `admin_plaza` y `superadmin` pueden escribir. `inquilino` solo lectura. La desactivación de una categoría está bloqueada si tiene subcategorías activas. Materializa RN-CA-1 a RN-CA-2.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/categorias` con `@Roles('admin_plaza', 'superadmin')`.
  - [ ] `GET /api/v1/categorias?activo=` con paginación. `inquilino` ve solo `activo=true`.
  - [ ] `GET /api/v1/categorias/:id` con detalle + subcategorías activas.
  - [ ] `PATCH /api/v1/categorias/:id` con `@Roles('admin_plaza', 'superadmin')`.
  - [ ] `DELETE /api/v1/categorias/:id` con `@Roles('admin_plaza', 'superadmin')` hace soft delete (`activo=false`). Si tiene subcategorías activas → `400 CATEGORIA_HAS_ACTIVE_SUBCATEGORIAS`.
  - [ ] RLS probado.
  - [ ] Errores con códigos de dominio.
- **Dependencias:** T-063, T-022.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-068 — Implementar CRUD subcategorias (POST/GET/PATCH/DELETE)

- **Descripción:** Implementar el CRUD de subcategorías. Al crear, se debe pasar `responsableId` y opcionalmente hasta 5 `supervisorIds`. Al editar, se puede cambiar el responsable (T-069) y los supervisores (T-070). Materializa S-Subcategoria.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/categorias/:id/subcategorias` con `@Roles('admin_plaza', 'superadmin')`. Body: `{ nombre, descripcion?, responsableId, prioridad?, supervisorIds? }`.
  - [ ] `responsableId` validado por SC-6 (T-071).
  - [ ] `supervisorIds` validado por SC-6 y por el trigger T-066 (máx 5).
  - [ ] `prioridad` default `B`, validada con Zod.
  - [ ] `GET /api/v1/categorias/:id/subcategorias?activo=` paginado. `inquilino` ve solo activas (usado en formularios de solicitudes).
  - [ ] `GET /api/v1/categorias/:id/subcategorias/:subId` con detalle + responsable + supervisores.
  - [ ] `PATCH /api/v1/categorias/:id/subcategorias/:subId` permite cambiar nombre, descripción, prioridad, responsable.
  - [ ] `DELETE /api/v1/categorias/:id/subcategorias/:subId` hace soft delete. Subcategoría inactiva no se usa en nuevas solicitudes.
  - [ ] RLS probado.
  - [ ] Errores con códigos: `RESPONSABLE_INVALIDO`, `SUPERVISOR_INVALIDO`, `SUBCATEGORIA_MAX_5_SUPERVISORES`.
- **Dependencias:** T-064, T-065, T-066, T-067, T-069, T-070, T-071.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-069 — Implementar asignación/cambio de responsable de subcategoría

- **Descripción:** Endpoint específico para cambiar el `responsable_id` de una subcategoría. Valida SC-6. NO reasigna solicitudes en curso (solo afecta a las solicitudes futuras, según S-ResponsabilidadStaff de `docs/05`).
- **Criterios de aceptación:**
  - [ ] `PATCH /api/v1/categorias/:id/subcategorias/:subId/responsable` con body `{ responsableId }` y `@Roles('admin_plaza', 'superadmin')`.
  - [ ] Valida que `responsableId` es `admin_plaza` con `rol_staff` activo y mismo `plaza_id`. Si no → `403 RESPONSABLE_INVALIDO`.
  - [ ] Actualiza `subcategoria.responsable_id`.
  - [ ] NO modifica solicitudes en `en_revision`, `borrador`, `requerida_subsanacion` (sus `admin_asignado_id` quedan como están).
  - [ ] Las solicitudes nuevas (en `enviar`, T-082) usarán el nuevo responsable.
  - [ ] Auditoría: registra el cambio con `antes`/`después` del responsable.
- **Dependencias:** T-064, T-071.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-070 — Implementar endpoints de supervisores (POST/DELETE)

- **Descripción:** Endpoints para agregar y quitar supervisores de una subcategoría. El trigger T-066 enforça el máximo de 5. La validación de aplicación (SC-6) enforça que sean `admin_plaza` con `rol_staff` activo y misma plaza.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/categorias/:id/subcategorias/:subId/supervisores` con body `{ usuarioId }` y `@Roles('admin_plaza', 'superadmin')`.
  - [ ] Valida SC-6. Si no → `403 SUPERVISOR_INVALIDO`.
  - [ ] El trigger T-066 valida que no exceda 5 → `409 SUBCATEGORIA_MAX_5_SUPERVISORES`.
  - [ ] Idempotente: si el supervisor ya está asignado, retorna `200 OK` con el registro.
  - [ ] `DELETE /api/v1/categorias/:id/subcategorias/:subId/supervisores/:usuarioId` lo quita. Si no existe → `404`.
  - [ ] RLS probado.
- **Dependencias:** T-065, T-066, T-071.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-071 — Validar SC-6 en aplicación (responsable y supervisores admin_plaza con rol_staff activo y misma plaza)

- **Descripción:** Implementar un validador reutilizable `validateStaffForSubcategoria(usuarioId, plazaId)` que verifica que el usuario sea `admin_plaza` con `rol_staff` activo y mismo `plaza_id`. Usado por T-069 y T-070. Materializa SC-6.
- **Criterios de aceptación:**
  - [ ] `backend/src/modules/categorias/validators/staff-for-subcategoria.validator.ts` con la función.
  - [ ] Retorna `void` si válido, lanza `UnprocessableEntityException` con código `RESPONSABLE_INVALIDO` o `SUPERVISOR_INVALIDO` según contexto si no.
  - [ ] Test unitario: usuario con `rol=inquilino` → falla.
  - [ ] Test: usuario `admin_plaza` sin `rol_staff_id` → falla (S-ResponsabilidadStaff).
  - [ ] Test: usuario `admin_plaza` con `rol_staff.activo = false` → falla.
  - [ ] Test: usuario `admin_plaza` de otra plaza → falla con `403`.
  - [ ] El validador cachea la consulta del usuario por 1 min para no pegar a BD en cada llamada.
- **Dependencias:** T-018, T-019.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-072 — Implementar pantalla /admin/categorias

- **Descripción:** Pantalla del admin para gestión de categorías con listado, alta, edición, y desactivación.
- **Criterios de aceptación:**
  - [ ] `/admin/categorias` con tabla shadcn DataTable paginada, filtros por estado, botón "Nueva categoría".
  - [ ] `/admin/categorias/nueva` con formulario RHF + Zod.
  - [ ] `/admin/categorias/[id]` con detalle + lista de subcategorías (link a T-073).
  - [ ] Acción "Desactivar" pide confirmación; si tiene subcategorías activas, muestra mensaje y bloquea.
  - [ ] Si `inquilino`, ve un read-only de las categorías activas (usado en el formulario de nueva solicitud).
- **Dependencias:** T-067.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-073 — Implementar pantalla /admin/categorias/[id]/subcategorias

- **Descripción:** Pantalla para gestión de subcategorías dentro de una categoría. Permite crear, editar, asignar responsable, asignar/quitar supervisores (con contador 0-5 visible).
- **Criterios de aceptación:**
  - [ ] `/admin/categorias/[id]/subcategorias` con tabla de subcategorías, columna "Responsable" y "Supervisores (N/5)".
  - [ ] Botón "Nueva subcategoría" abre modal con formulario: nombre, descripción, prioridad (select A-F), responsable (combobox de `admin_plaza` con `rol_staff` activo), supervisores (multi-select con máximo 5).
  - [ ] Acción "Editar" abre modal similar.
  - [ ] Acción "Asignar responsable" permite cambiar el responsable desde un sub-modal.
  - [ ] Acción "Gestionar supervisores" abre modal con la lista actual + agregar/quitar.
  - [ ] El badge de supervisores muestra "N/5" en rojo si está al límite.
  - [ ] Si `inquilino`, ve solo lectura de las subcategorías activas (usado en T-089).
- **Dependencias:** T-068, T-069, T-070.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*
