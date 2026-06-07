# Módulo 07 — Aprobaciones (state machine)

> **Propósito:** Implementar la state machine completa de solicitudes (T1–T12 del `docs/05`), el lock de 30 min con expiración, la bandeja priorizada, las transiciones terminales con comentario obligatorio (T7, T8), la defensa anti-auto-aprobación (SC-4), la reasignación T12, la creación de `evento_calendario` al aprobar un evento, el cambio automático de `local.estado = en_mantenimiento` al aprobar una remodelación, la SLA visual con semáforo, y las pantallas de bandeja/detalle del admin.
>
> **Pre-requisito:** T-001 a T-090 (todo lo anterior, incluyendo solicitudes) deben estar `Completada`.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-091 | Implementar servicio de state machine para solicitudes (SolicitudStateService) | Alta | Completada |
| T-091b | Cron de auto-asignación a los 15 minutos (NUEVA, T-V03) | Alta | Completada |
| T-091c | Endpoint tomar: asignado → en_revision (NUEVA, T-V03) | Alta | Completada |
| T-092 | Implementar POST /api/v1/solicitudes/:id/tomar (legacy) | Media | Reemplazada por T-091c |
| T-093 | Implementar POST /api/v1/solicitudes/:id/liberar | Media | Completada |
| T-094 | Implementar POST /api/v1/solicitudes/:id/aprobar (T6) con SC-4 defense | Alta | Completada |
| T-095 | Implementar POST /api/v1/solicitudes/:id/rechazar (T7) con comentario obligatorio | Alta | Completada |
| T-096 | Implementar POST /api/v1/solicitudes/:id/pedir-subsanacion (T8) con comentario obligatorio | Alta | Completada |
| T-097 | Implementar POST /api/v1/solicitudes/:id/reasignar (T12) | Alta | Completada |
| T-098 | Implementar job de expiración automática de lock a 30 min | Alta | Reemplazada por T-091b |
| T-099 | Implementar bandeja priorizada GET /api/v1/solicitudes/bandeja | Alta | Completada |
| T-100 | Implementar SLA visual con semáforo (verde/amarillo/rojo) | Alta | Completada |
| T-101 | Crear vista materializada solicitud_sla_view + cron diario | Media | Completada |
| T-102 | Implementar transición T6 que crea evento_calendario (si tipo=evento) | Alta | Completada |
| T-103 | Implementar transición T6 que cambia local a en_mantenimiento (si tipo=remodelacion) | Alta | Completada |
| T-104 | Implementar reenvío T9 (requerida_subsanacion → enviada, T-V03) — server-side | Alta | Completada |
| T-105 | Implementar escritura inmutable en solicitud_historial con triggers RI-1 | Alta | Completada |
| T-106 | Implementar pantalla /admin/solicitudes (bandeja) | Alta | Completada |
| T-107 | Implementar pantalla /admin/solicitudes/[id] con acciones | Alta | Completada |
| T-108 | Implementar rechazo con motivo: cambio a local fuera_de_servicio (caso especial) | Media | Completada |

---

### T-091 — Implementar servicio de state machine para solicitudes (SolicitudStateService)

- **Descripción:** Implementar un servicio central `SolicitudStateService` que encapsule TODAS las transiciones del state machine. Este servicio es invocado por los endpoints de T-081, T-082, T-083, T-092 a T-097, y T-104. Garantiza que las validaciones de transición se hagan en un solo lugar y que el historial se inserte correctamente. Materializa la state machine de `docs/05` §2.2.
- **Criterios de aceptación:**
  - [ ] `backend/src/modules/solicitudes/state/solicitud-state.service.ts` con métodos: `crear()`, `enviar()`, `cancelar()`, `tomar()`, `liberar()`, `aprobar()`, `rechazar()`, `pedirSubsanacion()`, `reasignar()`, `subsanar()`.
  - [ ] Cada método recibe `(solicitud, usuario, payload?)` y retorna la solicitud actualizada.
  - [ ] Cada método:
    1. Valida la transición permitida (lanza `InvalidStateTransitionException` si no).
    2. Valida las reglas de negocio (lock, SC-4, comentario obligatorio, etc.).
    3. Actualiza los campos correspondientes.
    4. Inserta en `solicitud_historial` (append-only, T-105).
    5. Encola los emails correspondientes.
  - [ ] Cada método corre dentro de una transacción Prisma.
  - [ ] Métodos privados para evitar duplicación: `_insertarHistorial()`, `_enqueueEmail()`.
  - [ ] Tabla interna de transiciones válidas: `[estado_actual, evento, estado_nuevo]`.
  - [ ] El servicio es el ÚNICO que escribe en `solicitud.estado`. Los controllers nunca modifican el estado directamente.
  - [ ] Tests unitarios para cada transición válida e inválida.
- **Dependencias:** T-074, T-075, T-118, T-022, T-038.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** `solicitudes/state/solicitud-state.service.ts` con tabla interna de transiciones del flujo T-V03 (sin lock) y métodos enviar/cancelar/reenviar/autoAsignar/tomar/aprobar/rechazar/pedirSubsanacion/reasignar/liberar + helpers `insertarHistorial` (T-105) y `enqueueEmail` (encola en `email_log`, estado `pendiente`). ⚠️ Diseño: los métodos reciben el `tx` del `withTenant` del caller (composición sin ciclos); el service vive en `SolicitudStateModule` propio, importado por solicitudes/aprobaciones/categorias/locales. Es el ÚNICO escritor de `solicitud.estado`. ⚠️ Sin tests unitarios (política del proyecto, docs/02 §2.11): cada transición válida e inválida se verificó manualmente con curl (ver bitácoras de T-094..T-097).

### T-091b — Cron de auto-asignación a los 15 minutos (NUEVA, T-V03)

- **Descripción:** Cron `@Cron('*/1 * * * *')` que busca solicitudes en `enviada` con `enviada_at < now() - 15 min` y las transiciona a `asignado`, asignando al `responsable_id` ACTUAL de la subcategoría. Reemplaza el concepto de auto-asignación inmediata + lock de la T-081/T-098 originales. Creada por mandato de la bitácora de T-V03.
- **Criterios de aceptación:**
  - [x] `backend/src/modules/aprobaciones/cron/auto-asignacion.cron.ts` cada 1 min.
  - [x] Descubre candidatas con el admin client; cada escritura corre bajo `withTenant` (RLS) y re-verifica el estado en la transacción (idempotente).
  - [x] Valida SC-6 del responsable dentro de la transacción; si la subcategoría está inactiva o sin responsable válido (o tipo=otro sin subcategoría), la solicitud permanece en `enviada` con warning (toma manual desde la bandeja).
  - [x] Historial `evento='asignada'` con `usuario_id NULL` (sistema).
  - [x] Encola `solicitud-asignada-responsable` (responsable) y `solicitud-nueva-supervisor` (cada supervisor, deduplicado si coincide con el responsable; respeta `email_invalido`).
  - [x] Logging pino del conteo asignadas/omitidas. Endpoint dev `POST /solicitudes/cron/test-auto-asignacion` (404 en producción).
- **Dependencias:** T-091, T-066 (supervisores), T-013.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** Verificado E2E: enviada con `enviada_at` forzado a -20 min → cron → `asignado` al responsable con emails `pendiente` en `email_log`; reenvío tras subsanación re-asignado al responsable ACTUAL.

### T-091c — Endpoint tomar: asignado → en_revision (NUEVA, T-V03)

- **Descripción:** `POST /api/v1/solicitudes/:id/tomar`. En `asignado`, SOLO el admin asignado puede tomar (decisión confirmada con el cliente el 2026-06-06: "solo el asignado", más predecible; otro admin debe reasignar primero). Desde `enviada` (cola sin asignar) cualquier `admin_plaza` puede tomar (cubre tipo=otro / sin responsable válido). Reemplaza a T-092.
- **Criterios de aceptación:**
  - [x] `asignado → en_revision` solo por `admin_asignado_id` (otro admin → 403 `NOT_ASSIGNED_ADMIN`); superadmin exento.
  - [x] `enviada → en_revision` por cualquier admin_plaza (se auto-asigna al tomar).
  - [x] Historial `evento='tomada'`. Sin email (el admin actuó él mismo).
- **Dependencias:** T-091, T-091b.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** Verificado E2E: admin no asignado → 403; asignado → `en_revision`.

### T-092 — Implementar POST /api/v1/solicitudes/:id/tomar (legacy)

- **Descripción:** Implementar el endpoint legacy `tomar` que pasa de `enviada` a `en_revision` cuando el lock ha expirado y nadie la tomó. En la práctica, este endpoint se usa poco porque T-081 ya auto-asigna. Pero queda para casos manuales. Materializa T-4 de `docs/05` §2.2.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/solicitudes/:id/tomar` con `@Roles('admin_plaza', 'superadmin')`.
  - [ ] Solo permitido si la solicitud está en `enviada` y el lock expiró (`lock_expira_at < now()`). Si no → `400 INVALID_STATE_TRANSITION` o `409 SOLICITUD_LOCKED`.
  - [ ] En una transacción:
    - `estado = 'en_revision'`, `admin_asignado_id = user.sub`, `asignada_at = now()`, `lock_expira_at = now() + 30 min`.
    - Insert en `solicitud_historial` con `evento: 'tomada'`.
    - Email al `admin_asignado_id` (plantilla `solicitud-recibida.html`).
  - [ ] RLS probado.
- **Dependencias:** T-091, T-098.
- **Prioridad:** Media.
- **Estado:** Reemplazada por T-091c.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** ⚠️ **REEMPLAZADA por T-091c** (T-V03): ya no existe el lock ni su expiración. El endpoint `POST /solicitudes/:id/tomar` quedó con doble semántica: `asignado → en_revision` SOLO por el admin asignado (decisión confirmada con el cliente) y `enviada → en_revision` por cualquier admin_plaza (cubre la cola sin responsable: tipo=otro o subcategoría sin responsable válido — espíritu del T-092 legacy). ⚠️ Sin email al tomar (el admin actuó él mismo; la notificación relevante es la de asignación T-091b).

### T-093 — Implementar POST /api/v1/solicitudes/:id/liberar

- **Descripción:** Implementar la liberación manual del lock: un `admin_plaza` puede liberar su lock para que la solicitud vuelva a `enviada` y esté disponible para otro admin. Materializa `docs/05` §2.5 (liberar lock).
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/solicitudes/:id/liberar` con `@Roles('admin_plaza', 'superadmin')`.
  - [ ] Solo permitido si la solicitud está en `en_revision` y el `admin_asignado_id` es el usuario actual. Si no → `403 NOT_LOCK_OWNER`.
  - [ ] En una transacción:
    - `estado = 'enviada'`, libera `lock_expira_at` (NULL), `admin_asignado_id = NULL`.
    - Insert en `solicitud_historial` con `evento: 'comentario'` y `comentario: 'Lock liberado por {user}'`.
  - [ ] El admin que libera puede opcionalmente pasar un `motivo` en el body.
  - [ ] RLS probado.
- **Dependencias:** T-091.
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** ⚠️ REDEFINIDA por T-V03 (sin lock): `liberar` transiciona `asignado|en_revision → enviada` (cola), `admin_asignado_id=NULL`, solo el asignado (403 `NOT_ASSIGNED_ADMIN`), motivo opcional al historial. `enviada_at` NO se resetea (el SLA cuenta desde el envío original); el cron re-asignará al responsable actual en el siguiente tick. Verificado con curl.

### T-094 — Implementar POST /api/v1/solicitudes/:id/aprobar (T6) con SC-4 defense

- **Descripción:** Implementar la transición T6 (`en_revision → aprobada`). Valida SC-4: el admin que aprueba NO puede ser el `usuario_creador_id` (defense in depth). Comentario opcional. Si es `evento`, crea `evento_calendario` (T-102). Si es `remodelacion`, cambia `local.estado = en_mantenimiento` (T-103). Materializa T-6 y SC-4.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/solicitudes/:id/aprobar` con body opcional `{ comentario }` y `@Roles('admin_plaza', 'superadmin')`.
  - [ ] Solo permitido en `en_revision` → `400 INVALID_STATE_TRANSITION`.
  - [ ] SC-4: si `user.sub == solicitud.usuario_creador_id` → `403 CANNOT_APPROVE_OWN_REQUEST`.
  - [ ] Lock vigente: si `lock_expira_at < now()` → `409 SOLICITUD_LOCK_EXPIRED` (debe re-tomar).
  - [ ] En una transacción:
    - `estado = 'aprobada'`, `decision_at = now()`, libera `lock_expira_at`.
    - Insert en `solicitud_historial` con `evento: 'aprobada'`, `comentario: comentario?`.
    - Email al inquilino (plantilla `solicitud-aprobada.html`).
    - Si `tipo=evento`: crear `evento_calendario` (T-102).
    - Si `tipo=remodelacion`: update `local.estado = 'en_mantenimiento'` con `fecha_inicio = campos_extra.fecha_inicio_estimada` y `fecha_fin = fecha_inicio + campos_extra.duracion_dias` (T-103).
  - [ ] RLS probado.
  - [ ] Errores: `CANNOT_APPROVE_OWN_REQUEST`, `SOLICITUD_LOCK_EXPIRED`, `INVALID_STATE_TRANSITION`.
- **Dependencias:** T-091, T-102, T-103, T-128 (en `10-calendario.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** Verificado E2E: aprobar → `aprobada` + `decision_at` + historial + email `solicitud-aprobada` encolado; tipo=evento creó `evento_calendario` (upsert 1:1, horas combinadas en TZ -06:00); tipo=remodelacion marcó `local.estado=en_mantenimiento` con ventana. ⚠️ T-V03: el criterio "lock vigente → 409 SOLICITUD_LOCK_EXPIRED" quedó OBSOLETO (no hay lock); en su lugar, solo el admin asignado puede aprobar (`NOT_ASSIGNED_ADMIN`). SC-4 implementado (`CANNOT_APPROVE_OWN_REQUEST`).

### T-095 — Implementar POST /api/v1/solicitudes/:id/rechazar (T7) con comentario obligatorio

- **Descripción:** Implementar la transición T7 (`en_revision → rechazada`) con comentario obligatorio no vacío. Estado terminal. Materializa T-7.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/solicitudes/:id/rechazar` con body `{ comentario }` y `@Roles('admin_plaza', 'superadmin')`.
  - [ ] `comentario` obligatorio, 1-4000 chars, no solo whitespace. Si vacío → `400 COMENTARIO_REQUERIDO`.
  - [ ] SC-4: si `user.sub == solicitud.usuario_creador_id` → `403 CANNOT_REJECT_OWN_REQUEST`.
  - [ ] Lock vigente (igual que T-094).
  - [ ] En una transacción:
    - `estado = 'rechazada'`, `decision_at = now()`, libera `lock_expira_at`.
    - Insert en `solicitud_historial` con `evento: 'rechazada'`, `comentario`.
    - Email al inquilino (plantilla `solicitud-rechazada.html`).
  - [ ] Estado terminal: no se puede transicionar a otro estado.
  - [ ] RLS probado.
- **Dependencias:** T-091.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** Verificado con curl: rechazar sin comentario → 400 (Zod `RechazarSolicitudSchema` + defensa del state service `COMENTARIO_REQUERIDO`); con comentario → `rechazada` + `decision_at` + historial + email `solicitud-rechazada` encolado. SC-4 en código (`CANNOT_REJECT_OWN_REQUEST`); no reproducible vía API en v1 porque POST /solicitudes es solo-inquilino (defensa en profundidad). Solo el admin asignado decide (`NOT_ASSIGNED_ADMIN`).

### T-096 — Implementar POST /api/v1/solicitudes/:id/subsanar (T8) con comentario obligatorio

- **Descripción:** Implementar la transición T8 (`en_revision → requerida_subsanacion`) con comentario obligatorio no vacío. La solicitud queda en estado de espera para que el inquilino corrija y reenvíe (T9).
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/solicitudes/:id/subsanar` con body `{ comentario }` y `@Roles('admin_plaza', 'superadmin')`.
  - [ ] `comentario` obligatorio. Si vacío → `400 COMENTARIO_REQUERIDO`.
  - [ ] Lock vigente (igual que T-094).
  - [ ] En una transacción:
    - `estado = 'requerida_subsanacion'`, libera `lock_expira_at`, `admin_asignado_id = NULL` (queda sin asignar hasta T9).
    - Insert en `solicitud_historial` con `evento: 'subsanada'`, `comentario` (aunque el evento es el admin pidiendo subsanación, el `evento` en historial es `subsanada` para mantener el histórico; la acción se describe en `comentario`).
    - Insert en `comentario` con `tipo: 'subsanacion'`, `cuerpo: comentario`.
    - Email al inquilino (plantilla `solicitud-subsanacion.html`).
  - [ ] Estado NO terminal: se puede transicionar a `en_revision` con T-083.
  - [ ] RLS probado.
- **Dependencias:** T-091, T-077.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** Verificado: comentario obligatorio; transiciona a `requerida_subsanacion` con `admin_asignado_id=NULL`, historial `subsanada`, fila en `comentario` tipo `subsanacion` y email `solicitud-subsanacion` encolado. ⚠️ Endpoint renombrado a `POST /solicitudes/:id/pedir-subsanacion` (el plan original lo colisionaba con el reenvío del inquilino T-083, que conserva `/subsanar`).

### T-097 — Implementar POST /api/v1/solicitudes/:id/reasignar (T12)

- **Descripción:** Implementar la reasignación manual de una solicitud en `en_revision` a otro `admin_plaza`. Libera el lock anterior y crea uno nuevo de 30 min. Cualquier `admin_plaza` puede reasignar (no solo supervisores). Materializa T-12 y S-Reasignacion.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/solicitudes/:id/reasignar` con body `{ nuevoResponsableId, comentario? }` y `@Roles('admin_plaza', 'superadmin')`.
  - [ ] Solo permitido en `en_revision` → `400 INVALID_STATE_TRANSITION`.
  - [ ] Valida que `nuevoResponsableId` es `admin_plaza` con `rol_staff` activo y misma plaza → `403 RESPONSABLE_INVALIDO` (reusa T-071).
  - [ ] No permite reasignar al mismo admin que ya la tiene (no-op) → `400 SAME_ASSIGNEE`.
  - [ ] En una transacción:
    - Libera lock anterior, `admin_asignado_id = nuevoResponsableId`, `asignada_at = now()`, `lock_expira_at = now() + 30 min`. El estado sigue siendo `en_revision`.
    - Insert en `solicitud_historial` con `evento: 'reasignada'`, `estado_anterior: 'en_revision'`, `estado_nuevo: 'en_revision'`, `comentario: comentario?` o `'Reasignada de {anterior} a {nuevo}'`.
    - Email al nuevo responsable (plantilla `solicitud-reasignada.html`).
  - [ ] RLS probado.
- **Dependencias:** T-091, T-071 (en `05-categorias-subcategorias.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** Verificado: reasignación en `asignado` y `en_revision` (T-V04), cualquier admin_plaza, SC-6 vía el validator de T-071, mismo asignado → 400 `SAME_ASSIGNEE`, email `solicitud-reasignada` al nuevo. ⚠️ T-V03: no hay lock que transferir; solo cambian `admin_asignado_id` y `asignada_at`, el estado se conserva.

### T-098 — Implementar job de expiración automática de lock a 30 min

- **Descripción:** Implementar un cron con `@nestjs/schedule` que cada 1 min busque solicitudes con `lock_expira_at < now()` y `estado = 'en_revision'`, y las devuelva a `enviada` (libera lock, NULL `admin_asignado_id`). Materializa S-LockTimeout y `docs/05` §2.5.
- **Criterios de aceptación:**
  - [ ] `backend/src/modules/solicitudes/cron/lock-expiration.cron.ts` con `@Cron('*/1 * * * *')`.
  - [ ] Query: `SELECT id FROM solicitud WHERE estado = 'en_revision' AND lock_expira_at < NOW()`.
  - [ ] Para cada una: transicionar a `enviada` con `SolicitudStateService.cancelar()` o un método específico `liberarPorExpiracion()`.
  - [ ] Inserta en `solicitud_historial` con `evento: 'comentario'`, `comentario: 'Lock expirado automáticamente'`.
  - [ ] El job es idempotente: si la solicitud ya está en `enviada` (otra carrera), no hace nada.
  - [ ] Logging con `pino` del conteo de locks expirados por ejecución.
  - [ ] En v1 NO se reasigna automáticamente; queda en `enviada` para que cualquier `admin_plaza` la tome.
- **Dependencias:** T-091, T-013 (en `01-setup-base.md`, pino).
- **Prioridad:** Alta.
- **Estado:** Reemplazada por T-091b.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** ⚠️ **REEMPLAZADA por T-091b** (T-V03): no existe expiración de lock. El cron de cada 1 min ahora hace la AUTO-ASIGNACIÓN: `enviada` con `enviada_at < now()-15min` → `asignado` al responsable ACTUAL de la subcategoría (ver T-091b). Logging con pino del conteo asignadas/omitidas.

### T-099 — Implementar bandeja priorizada GET /api/v1/solicitudes/bandeja

- **Descripción:** Implementar la bandeja de entrada para `admin_plaza` con las solicitudes pendientes de su plaza, ordenadas por prioridad (S-SLA-Prioridad) y antigüedad. Materializa CU-AP-1 y `docs/03` §3.7.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/solicitudes/bandeja?filtros` con `@Roles('admin_plaza', 'superadmin')`.
  - [ ] Retorna solicitudes en `enviada` o `en_revision` con `lock_expira_at` válido (o NULL).
  - [ ] Orden: `prioridad ASC, enviada_at ASC` (A > B > C > D > F, y más antiguas primero).
  - [ ] Filtros: `tipo=`, `categoriaId=`, `subcategoriaId=`, `localId=`, `prioridad=`, `asignadoA mí=bool`.
  - [ ] Cada item incluye el `sla_status`: `verde`/`amarillo`/`rojo` calculado en backend (T-100).
  - [ ] Paginación `?page=&pageSize=`.
  - [ ] RLS probado.
- **Dependencias:** T-080, T-100.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** `GET /solicitudes/bandeja` con las 3 colas de T-V03 (`enviada`/`asignado`/`en_revision`), orden `prioridad ASC, enviada_at ASC`, filtros (tipo/categoría/subcategoría/local/prioridad/asignadasAMi) y paginación. `sla_status` por item: lee la matview (T-101) y calcula al vuelo (T-100) las filas aún no materializadas. ⚠️ La ruta estática exige que `AprobacionesModule` se registre ANTES de `SolicitudesModule` en `app.module.ts` (si no, cae en `GET /solicitudes/:id`). Verificado con curl (orden y semáforo correctos). RLS: la query siempre corre bajo `withTenant` del JWT.

### T-100 — Implementar SLA visual con semáforo (verde/amarillo/rojo)

- **Descripción:** Implementar el cálculo del SLA visual por tipo y prioridad, retornando el estado de semáforo. Materializa S-SLA y `docs/05` §2.6.
- **Criterios de aceptación:**
  - [ ] Función `calcularSlaStatus(solicitud, configuracion): 'verde' | 'amarillo' | 'rojo'`.
  - [ ] Fórmula: `sla_dias = configuracion.sla_dias_por_tipo[solicitud.tipo] * configuracion.sla_multiplicador_por_prioridad[solicitud.prioridad]`.
  - [ ] `transcurrido_dias = (now() - solicitud.enviada_at) / 86400`.
  - [ ] `porcentaje = transcurrido_dias / sla_dias`.
  - [ ] Si `porcentaje < 0.5` → `verde`.
  - [ ] Si `0.5 <= porcentaje < 1.0` → `amarillo`.
  - [ ] Si `porcentaje >= 1.0` → `rojo`.
  - [ ] Estados terminales (`aprobada`, `rechazada`, `cancelada`) siempre retornan `null` (no aplica).
  - [ ] Test unitario: solicitud enviada hace 3 días, tipo=`mantenimiento` (sla=5), prioridad=`B` (multiplicador=1.0) → `porcentaje=0.6` → `amarillo`.
- **Dependencias:** T-044 (en `03-plazas-multitenant.md`, configuracion), T-074.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** `solicitudes/sla/sla.util.ts::calcularSlaStatus`. ⚠️ T-V03: el timer corre desde `enviada_at` (no asignada_at) y los multiplicadores default son A=0.5,B=1.0,C=1.5,D=2.0,F=3.0 (ya en `configuracion`). Verificado E2E: mantenimiento (sla 5d) prioridad A (×0.5) enviada hace 3 días → 120% → `rojo`. Terminales y sin `enviada_at` → null.

### T-101 — Crear vista materializada solicitud_sla_view + cron diario

- **Descripción:** Crear una vista materializada PostgreSQL `solicitud_sla_view` que precalcule el estado de SLA para todas las solicitudes activas, refrescada diariamente. Optimiza la consulta de bandeja. Materializa S-SLA.
- **Criterios de aceptación:**
  - [ ] Migración `00X_solicitud_sla_view/migration.sql` con `CREATE MATERIALIZED VIEW solicitud_sla_view AS SELECT ...` con todos los campos relevantes (`id`, `plaza_id`, `prioridad`, `tipo`, `enviada_at`, `sla_dias`, `sla_multiplicador`, `porcentaje`, `status`).
  - [ ] Índice `UNIQUE INDEX ON (id)`, `INDEX(plaza_id, status)`.
  - [ ] `REFRESH MATERIALIZED VIEW CONCURRENTLY solicitud_sla_view` ejecutado por un cron diario (`@Cron('0 2 * * *')`).
  - [ ] El endpoint T-099 hace `LEFT JOIN solicitud_sla_view` en lugar de calcular en cada request.
- **Dependencias:** T-074, T-044, T-100.
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** Migración `20260607021500_solicitud_sla_view`: matview con sla_dias/porcentaje/status calculados desde los JSONB de `configuracion`, `UNIQUE INDEX(id)` (necesario para `REFRESH CONCURRENTLY`) + `INDEX(plaza_id,status)`; `GRANT SELECT` a syssol_app. Cron diario 02:00 (TZ El Salvador) en `aprobaciones/cron/sla-refresh.cron.ts` + endpoint dev de prueba. ⚠️ Las matviews no heredan RLS: la bandeja (admin-only) la consulta SOLO por los ids de la página ya filtrados por el tenant.

### T-102 — Implementar transición T6 que crea evento_calendario (si tipo=evento)

- **Descripción:** Cuando se aprueba una solicitud con `tipo=evento`, crear automáticamente un registro en `evento_calendario` 1:1 con la solicitud. Materializa RN-AP-4.
- **Criterios de aceptación:**
  - [ ] En T-094, si `solicitud.tipo == 'evento'` y `campos_extra` tiene `fecha_evento_inicio` y `fecha_evento_fin`:
    - Crear `evento_calendario` con `solicitud_id = solicitud.id`, `titulo = solicitud.titulo`, `inicio = fecha_evento_inicio + hora_inicio`, `fin = fecha_evento_fin + hora_fin`, `color = color_por_tipo(evento)` (config o default).
  - [ ] Si ya existe un `evento_calendario` para esta solicitud (1:1), se actualiza en lugar de crear duplicado.
  - [ ] Si la solicitud es rechazada después de aprobada (reversión manual, no UI), el `evento_calendario` se marca con flag `deleted` o se elimina (decisión: soft delete con `deleted_at` para auditoría).
  - [ ] RLS probado.
- **Dependencias:** T-094, T-128 (en `10-calendario.md`, modelo evento_calendario).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** Verificado E2E: aprobar evento creó `evento_calendario` 1:1 (inicio 18:00 → 00:00Z, fin 22:00 → 04:00Z, TZ -06:00 fija). Upsert: re-aprobación actualiza en lugar de duplicar; soft delete con `deleted_at` para reversión. ⚠️ El modelo `evento_calendario` (T-128, módulo 10) se ADELANTÓ a esta rama (migración + RLS + CHECK fin>inicio); el feed del calendario sigue siendo del módulo 10.

### T-103 — Implementar transición T6 que cambia local a en_mantenimiento (si tipo=remodelacion)

- **Descripción:** Cuando se aprueba una solicitud con `tipo=remodelacion`, cambiar `local.estado = en_mantenimiento` durante el rango definido en `campos_extra`. Al finalizar el rango, un cron devuelve el estado a `disponible` (o `alquilado` si tiene contrato vigente). Materializa S-RemodelEstado y RN-AP-5.
- **Criterios de aceptación:**
  - [ ] En T-094, si `solicitud.tipo == 'remodelacion'` y `campos_extra` tiene `fecha_inicio_estimada` y `duracion_dias`:
    - `local.estado = 'en_mantenimiento'`.
    - Guardar `fecha_inicio_mantenimiento = fecha_inicio_estimada`, `fecha_fin_mantenimiento = fecha_inicio + duracion_dias` (en una nueva columna o en `local.metadata` JSONB).
  - [ ] Cron diario que revisa locales en `en_mantenimiento` y, si `fecha_fin_mantenimiento < now()`, los devuelve a `disponible` (o `alquilado` si hay contrato vigente).
  - [ ] Si se rechaza la remodelación, el `local.estado` NO se modifica (o se revierte si ya estaba cambiado).
  - [ ] RLS probado.
- **Dependencias:** T-094, T-051 (en `04-locales-inquilinos-contratos.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** Verificado E2E: aprobar remodelación (inicio 2026-06-01, 3 días) → `local.estado=en_mantenimiento` con ventana en columnas nuevas `fecha_inicio/fin_mantenimiento` (⚠️ extensión del modelo `local` del módulo 04, decisión: columnas explícitas en lugar de JSONB). Cron diario 03:00 (`mantenimiento-fin.cron.ts`) restaura a `alquilado` (contrato vigente) o `disponible`; verificado con el endpoint dev (ventana vencida → `alquilado`). El rechazo NO toca el local (solo se marca al aprobar).

### T-104 — Implementar reenvío T9 (requerida_subsanacion → en_revision) — server-side

- **Descripción:** Implementar la lógica server-side de T9 que es invocada por el endpoint T-083 (`POST /solicitudes/:id/subsanar`). La separación es: T-083 es el endpoint HTTP, T-104 es el método del state service. Materializa T-9.
- **Criterios de aceptación:**
  - [ ] Método `subsanar(solicitud, usuario)` en `SolicitudStateService` (T-091).
  - [ ] Solo permitido en `requerida_subsanacion`.
  - [ ] Re-asigna al responsable actual de la subcategoría (puede haber cambiado desde el envío original).
  - [ ] En una transacción:
    - `estado = 'en_revision'`, `enviada_at = now()`, `asignada_at = now()`, `lock_expira_at = now() + 30 min`, `admin_asignado_id = subcategoria.responsable_id` (actual).
    - Insert en `solicitud_historial` con `evento: 'enviada'`, `estado_anterior: 'requerida_subsanacion'`, `estado_nuevo: 'en_revision'`.
    - Email al responsable (plantilla `solicitud-recibida.html` o `solicitud-asignada-responsable.html`).
- **Dependencias:** T-091, T-083 (en `06-solicitudes.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** ⚠️ REDEFINIDA por T-V03: el método server-side es `SolicitudStateService.reenviar` (`requerida_subsanacion → enviada`); NO re-asigna directamente — vuelve a la cola y el cron T-091b asigna al responsable ACTUAL (cubre el caso "la subcategoría cambió de responsable"). Verificado E2E: reenvío → `enviada` → cron → `asignado`.

### T-105 — Implementar escritura inmutable en solicitud_historial con triggers RI-1

- **Descripción:** Configurar el servicio de aplicación para que SIEMPRE use el helper `_insertarHistorial()` que llama a un INSERT directo. Adicionalmente, el trigger `tg_solicitud_historial_no_update_delete` de T-075 refuerza la inmutabilidad en BD. Materializa RI-1.
- **Criterios de aceptación:**
  - [ ] Helper privado `_insertarHistorial(tx, params)` en `SolicitudStateService` que siempre hace INSERT, nunca UPDATE.
  - [ ] El helper es el único punto de entrada para escribir en `solicitud_historial`.
  - [ ] Si un controller intenta hacer UPDATE o DELETE directamente, falla con error de BD (permisos/trigger).
  - [ ] Auditoría: las inserciones se loguean con el `requestId`.
  - [ ] Test: intentar `prisma.solicitud_historial.update()` desde un script falla.
- **Dependencias:** T-075, T-091.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** `insertarHistorial` es el único punto de escritura (lo usan todas las transiciones, el upload de adjuntos y los comentarios). Refuerzos de BD del módulo 06: trigger `tg_solicitud_historial_no_update_delete` + REVOKE UPDATE/DELETE a syssol_app — verificados (UPDATE y DELETE fallan con `insufficient_privilege`). Las inserciones quedan ligadas al requestId vía auditoría del endpoint.

### T-106 — Implementar pantalla /admin/solicitudes (bandeja)

- **Descripción:** Pantalla principal del admin con la bandeja priorizada y filtros.
- **Criterios de aceptación:**
  - [ ] `/admin/solicitudes` con tabla shadcn DataTable.
  - [ ] Columnas: código, tipo, título, local, prioridad (badge con color), antigüedad (enviada_at), semáforo SLA, asignado a, acciones.
  - [ ] Toggle "Asignadas a mí" para filtrar.
  - [ ] Filtros: tipo, categoría, subcategoría, local, prioridad.
  - [ ] Click en fila → `/admin/solicitudes/[id]`.
  - [ ] Botón "Top 5 por antigüedad" que muestra el top destacado (T-141 en `11-reportes-panel.md`).
  - [ ] Paginación server-side.
  - [ ] Refrescamiento automático cada 60 segundos.
- **Dependencias:** T-099, T-100, T-101.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** `/admin/solicitudes`: tabla con código/tipo/título/local/estado/prioridad/semáforo SLA/asignado/fechas, filtros por cola/tipo/prioridad, toggle "Asignadas a mí" y refresco automático cada 60 s (client `AutoRefresh` con `router.refresh()`, mantiene el BFF). ⚠️ El botón "Top 5 por antigüedad" es de T-141 (módulo 11): la bandeja ya ordena por prioridad+antigüedad. Paginación server-side. Build/lint en verde.

### T-107 — Implementar pantalla /admin/solicitudes/[id] con acciones

- **Descripción:** Pantalla de detalle para el admin con todas las acciones del flujo.
- **Criterios de aceptación:**
  - [ ] `/admin/solicitudes/[id]` con layout similar a T-089 (header + tabs).
  - [ ] Tab "Detalle": muestra todos los campos + `campos_extra` formateados.
  - [ ] Tab "Comentarios": thread con formulario para agregar.
  - [ ] Tab "Historial": timeline con todas las transiciones.
  - [ ] Tab "Adjuntos": lista con preview y download.
  - [ ] Acciones contextuales según estado y SC-4:
    - `en_revision` y soy el asignado y no soy el creador: "Aprobar", "Rechazar" (modal con comentario obligatorio), "Pedir subsanación" (modal con comentario obligatorio), "Reasignar" (modal con búsqueda de admin_plaza), "Liberar lock".
    - `en_revision` y soy el creador: "Rechazar" deshabilitado (SC-4), "Aprobar" deshabilitado, solo "Comentar" y "Liberar lock".
    - `requerida_subsanacion`: sin acciones de admin.
    - `enviada`: "Tomar" (si lock expirado) o "Ver" (si lock vigente de otro).
  - [ ] SLA visual con barra de progreso.
- **Dependencias:** T-080, T-094, T-095, T-096, T-097, T-093, T-100, T-086, T-112.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** `/admin/solicitudes/[id]`: header con badges + semáforo, tabs detalle/comentarios/historial/adjuntos. Acciones por estado y SC-4: `enviada`→Tomar (cualquier admin); `asignado` y soy asignado→Tomar/Reasignar/Liberar; `en_revision` y soy asignado y NO creador→Aprobar/Rechazar/Pedir subsanación (modales con comentario obligatorio en T7/T8)+Reasignar/Liberar; si soy creador→decisiones ocultas con aviso SC-4; no terminal→cambiar prioridad y Cancelar. Modal de reasignación con combobox de admin_plaza con staff activo.

### T-108 — Implementar rechazo con motivo: cambio a local fuera_de_servicio (caso especial)

- **Descripción:** Caso especial documentado en `docs/05` §2.7: si un local baja a `fuera_de_servicio` mientras tiene solicitudes en curso, el admin debe rechazarlas con motivo. Esta tarea implementa el endpoint que permite hacerlo masivamente. Materializa `docs/05` §2.7.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/locales/:id/fuera-de-servicio` con `@Roles('admin_plaza', 'superadmin')`. Body: `{ motivo, rechazarSolicitudesPendientes: bool }`.
  - [ ] Cambia `local.estado = 'fuera_de_servicio'`.
  - [ ] Si `rechazarSolicitudesPendientes = true`, rechaza todas las solicitudes en estados no terminales del local con `comentario = motivo`. Cada una se rechaza individualmente (cada una tiene su transición e historial).
  - [ ] Retorna `{ local, solicitudesRechazadas: [...] }`.
  - [ ] RLS probado.
- **Dependencias:** T-051, T-095.
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** `POST /locales/:id/fuera-de-servicio` con `{motivo, rechazarSolicitudesPendientes}`. Verificado E2E: local → `fuera_de_servicio` y la solicitud pendiente quedó terminal con el motivo. ⚠️ Matiz de implementación: las `en_revision` se RECHAZAN formalmente (T7); las `enviada`/`asignado`/`requerida_subsanacion` se CANCELAN con motivo (no están en revisión: rechazar exigiría tomar cada una; el resultado terminal + email `solicitud-rechazada` + historial es equivalente para el inquilino). Cada transición es individual con su historial. Retorna `{local, solicitudesRechazadas}`.
