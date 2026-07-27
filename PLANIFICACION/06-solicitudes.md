# Módulo 06 — Solicitudes

> **Propósito:** CRUD de solicitudes con 4 tipos (`mantenimiento`, `evento`, `remodelacion`, `otro`), campos extra por tipo almacenados en JSONB y validados con Zod, prioridad heredada de subcategoría y modificable por `admin_plaza`, recurrencia para eventos, duplicar solicitudes, 10 adjuntos máximo, y pantallas de inquilino (crear, listar, detalle, editar, cancelar, subsanar, duplicar).
>
> **Pre-requisito:** T-001 a T-073 (todo lo anterior) deben estar `Completada`. Este módulo es el corazón del producto, pero NO incluye las transiciones de estado (esas están en `07-aprobaciones.md`).

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-074 | Crear migración Prisma con `solicitud` | Alta | Completada |
| T-075 | Crear migración Prisma con `solicitud_historial` (append-only) | Alta | Completada |
| T-076 | Crear migración Prisma con `solicitud_evento_recurrente` | Alta | Descartada (T-V05) |
| T-077 | Crear migración Prisma con `comentario` | Alta | Completada |
| T-078 | Crear ENUMs PostgreSQL (solicitud_estado, solicitud_tipo, solicitud_prioridad) | Alta | Completada |
| T-079 | Definir Zod schemas para campos_extra por tipo en @app/contracts | Alta | Completada |
| T-080 | Implementar CRUD solicitudes (POST/GET/PATCH /api/v1/solicitudes) | Alta | Completada |
| T-081 | Implementar POST /api/v1/solicitudes/:id/enviar (borrador→enviada, T-V03) | Alta | Completada |
| T-082 | Implementar POST /api/v1/solicitudes/:id/cancelar | Alta | Completada |
| T-083 | Implementar POST /api/v1/solicitudes/:id/subsanar (reenvío→cola, T-V03) | Alta | Completada |
| T-084 | Implementar POST /api/v1/solicitudes/:id/duplicar | Media | Completada |
| T-085 | Implementar PATCH /api/v1/solicitudes/:id/prioridad | Alta | Completada |
| T-086 | Implementar endpoints de comentarios e historial | Alta | Completada |
| T-087 | Implementar pantalla /solicitudes (listado) | Alta | Completada |
| T-088 | Implementar pantalla /solicitudes/nueva con formulario dinámico por tipo | Alta | Completada |
| T-089 | Implementar pantalla /solicitudes/[id] | Alta | Completada |
| T-090 | Implementar heurística de duplicados y límite de 10 adjuntos | Media | Completada |

---

### T-074 — Crear migración Prisma con `solicitud`

- **Descripción:** Crear el modelo `solicitud` con todos los campos del modelo de datos (`docs/04` §1.1): `id` (UUID), `plaza_id` (FK), `local_id` (FK), `inquilino_id` (FK), `usuario_creador_id` (FK), `admin_asignado_id` (FK, nullable), `categoria_id` (FK, nullable si `tipo=otro` con `categoria_libre`), `subcategoria_id` (FK, nullable idem), `codigo` (TEXT, formato `SOL-{plaza_short}-{seq}`, UNIQUE por plaza), `tipo` (ENUM), `prioridad` (ENUM), `titulo` (≤120), `descripcion` (≤4000), `estado` (ENUM), `campos_extra` (JSONB), `fecha_evento_inicio`, `fecha_evento_fin`, `hora_inicio`, `hora_fin`, `enviada_at`, `asignada_at`, `decision_at`, `lock_expira_at` (no documentado en §1.1 pero necesario para T-091), `created_at`, `updated_at`. Materializa el núcleo de la BD.
- **Criterios de aceptación:**
  - [ ] Modelo `solicitud` con todos los campos.
  - [ ] Índices: `UNIQUE(plaza_id, codigo)`, `INDEX(plaza_id, estado)`, `INDEX(plaza_id, local_id, created_at)`, `INDEX(plaza_id, tipo, created_at)`, `INDEX(plaza_id, fecha_evento_inicio)`, `INDEX(plaza_id, admin_asignado_id, estado)` (para bandeja), `INDEX(plaza_id, lock_expira_at)`.
  - [ ] Validación a nivel BD: `titulo` no vacío, `descripcion` no vacía (CHECK constraint o solo Zod).
  - [ ] Migración aplicada.
  - [ ] RLS habilitado.
  - [ ] Función helper para generar `codigo`: `SOL-{plaza.short}-{seq}` donde `seq` es un contador por plaza (secuencia PG o ROW_NUMBER).
- **Dependencias:** T-047, T-048, T-063, T-018, T-078.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** Modelo `solicitud` en migración `20260606232906`. ⚠️ T-V03: SIN `lock_expira_at` ni su índice (el lock de 30 min se eliminó); en su lugar `INDEX(plaza_id, estado, enviada_at)` para el cron de auto-asignación y la bandeja. Validación de titulo/descripcion en Zod (sin CHECK, mensajes más claros). Código `SOL-{SLUG8}-{seq}` por trigger `fn_solicitud_set_codigo` **SECURITY DEFINER** con tabla contador `solicitud_codigo_seq` (único bypass de RLS, documentado en la migración `20260606232940`); verificado secuencial por plaza en BD. RLS habilitado.

### T-075 — Crear migración Prisma con `solicitud_historial` (append-only)

- **Descripción:** Crear el modelo `solicitud_historial`: `id`, `plaza_id`, `solicitud_id`, `usuario_id`, `evento` (ENUM: `creada`, `enviada`, `tomada`, `aprobada`, `rechazada`, `subsanada`, `cancelada`, `reasignada`, `comentario`, `adjunto_agregado`, `prioridad_cambiada`), `estado_anterior`, `estado_nuevo`, `comentario`, `created_at`. Append-only: NO se permite UPDATE ni DELETE. Materializa RI-1 y la inmutabilidad de `docs/05` §2.4.
- **Criterios de aceptación:**
  - [ ] Modelo `solicitud_historial` con todos los campos.
  - [ ] Índice `INDEX(solicitud_id, created_at)`.
  - [ ] Migración aplicada.
  - [ ] Trigger PL/pgSQL `tg_solicitud_historial_no_update_delete` que rechaza UPDATE y DELETE.
  - [ ] Permisos de BD: el rol `syssol_app` solo tiene `INSERT` y `SELECT` sobre esta tabla, no `UPDATE` ni `DELETE`.
  - [ ] RLS habilitado.
  - [ ] Test: intentar UPDATE o DELETE falla con error de permisos/trigger.
- **Dependencias:** T-018, T-074.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** Modelo + trigger `tg_solicitud_historial_no_update_delete` + `REVOKE UPDATE, DELETE FROM syssol_app` (doble defensa). Verificado en BD: UPDATE y DELETE rechazados con `insufficient_privilege`. El enum de eventos añade `asignada` (auto-asignación del cron T-091b) y `reasignada`/`prioridad_cambiada`. `usuario_id` nullable (eventos del sistema).

### T-076 — Crear migración Prisma con `solicitud_evento_recurrente`

- **Descripción:** Crear el modelo `solicitud_evento_recurrente` para soportar recurrencia de eventos: `id`, `solicitud_id` (FK UNIQUE, 1:1), `patron` (ENUM: `diario`, `semanal`, `mensual`, `personalizado`), `intervalo` (INT, default 1), `dias_semana` (TEXT, ej. "L,M,X" para semanal), `fecha_fin_recurrencia` (DATE), `created_at`. Materializa S-Recurrencia.
- **Criterios de aceptación:**
  - [ ] Modelo con todos los campos.
  - [ ] Migración aplicada.
  - [ ] Validación Zod: si `patron=semanal`, `dias_semana` requerido. Si `patron=mensual`, no se permiten `dias_semana`.
  - [ ] Solo se permite `solicitud.tipo = 'evento'`.
  - [ ] RLS habilitado (heredado de `solicitud.plaza_id`).
- **Dependencias:** T-074.
- **Prioridad:** Alta.
- **Estado:** Descartada (T-V05).
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** ⚠️ **DESCARTADA por T-V05** (sin recurrencia en v1): el modelo `solicitud_evento_recurrente` NO se crea. Los eventos recurrentes se manejan creando N solicitudes manualmente. El wizard (T-088) no tiene paso de recurrencia.

### T-077 — Crear migración Prisma con `comentario`

- **Descripción:** Crear el modelo `comentario`: `id`, `plaza_id`, `solicitud_id`, `usuario_id`, `tipo` (ENUM: `decision` | `subsanacion` | `general`), `cuerpo` (TEXT NOT NULL), `created_at`. Materializa el sub-recurso de comentarios.
- **Criterios de aceptación:**
  - [ ] Modelo con todos los campos.
  - [ ] Índice `INDEX(solicitud_id, created_at)`.
  - [ ] Migración aplicada.
  - [ ] Validación Zod: `cuerpo` 1-4000 chars.
  - [ ] RLS habilitado.
  - [ ] Endpoint `GET /api/v1/solicitudes/:id/comentarios` retorna el thread de comentarios.
- **Dependencias:** T-074, T-018.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** Modelo `comentario` con enum `comentario_tipo` y RLS. `GET /solicitudes/:id/comentarios` implementado en T-086. Validación Zod 1-4000 en `CreateComentarioSchema`.

### T-078 — Crear ENUMs PostgreSQL (solicitud_estado, solicitud_tipo, solicitud_prioridad)

- **Descripción:** Crear los ENUMs PostgreSQL: `solicitud_estado` (`borrador`, `enviada`, `en_revision`, `aprobada`, `rechazada`, `cancelada`, `requerida_subsanacion`), `solicitud_tipo` (`mantenimiento`, `evento`, `remodelacion`, `otro`), `solicitud_prioridad` (`A`, `B`, `C`, `D`, `F`). Materializa la base de la state machine y los catálogos fijos.
- **Criterios de aceptación:**
  - [ ] ENUMs definidos en `schema.prisma` con sus valores.
  - [ ] Migración aplicada.
  - [ ] `solicitud_estado` tiene los 7 valores en el orden lógico del flujo.
  - [ ] `solicitud_prioridad` tiene los 5 valores (A, B, C, D, F).
  - [ ] Test: intentar insertar un valor inválido en cualquier campo ENUM falla con error de BD.
- **Dependencias:** T-074.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** Enums creados en la migración del módulo: `solicitud_estado` con **8 valores** (⚠️ T-V03 añade `asignado`), `solicitud_tipo`, `solicitud_historial_evento`, `comentario_tipo`. ⚠️ `solicitud_prioridad` se creó en el módulo 05 (lo necesitaba `subcategoria.prioridad`). Insert con valor inválido falla por el enum PG.

### T-079 — Definir Zod schemas para campos_extra por tipo en @app/contracts

- **Descripción:** Definir los schemas Zod para los `campos_extra` JSONB por cada tipo de solicitud. Materializa S-SO-A y S-CamposTipo. Campos:
- `mantenimiento`: `area_afectada` (texto), `requiere_ingreso_a_local` (bool).
- `evento`: `asistentes_estimados` (int 1-10000), `asistentes` (array de {nombre, documento}).
- `remodelacion`: `fecha_inicio_estimada` (date), `duracion_dias` (int 1-365), `empresa_constructora` (texto), `monto_presupuesto` (decimal ≥ 0).
- `otro`: `categoria_libre` (texto), `descripcion_larga` (texto ≤ 4000).
- **Criterios de aceptación:**
  - [ ] `packages/contracts/src/solicitudes.ts` con `CamposExtraMantenimientoSchema`, `CamposExtraEventoSchema`, `CamposExtraRemodelacionSchema`, `CamposExtraOtroSchema`, y un discriminated union `CamposExtraSchema = z.discriminatedUnion('tipo', ...)`.
  - [ ] Validaciones de rango (asistentes_estimados ≥ 1, duracion_dias 1-365, etc.).
  - [ ] Para `evento`: si `asistentes_estimados > 200` añadir flag `requiere_aprobacion_especial` (configurable).
  - [ ] Schemas exportan tipos inferidos.
  - [ ] El paquete compila sin errores.
- **Dependencias:** T-005 (en `01-setup-base.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** Schemas ya existían en `packages/contracts/src/solicitudes/index.ts` (discriminated union por tipo); se añadieron `SolicitudHistorialEventoSchema`, `SlaStatusSchema`, outputs de listado/detalle/comentario/historial, `DuplicadosQuerySchema` y `UsuarioRefSchema`. Flag `requiere_aprobacion_especial` se calcula server-side contra `configuracion.aprobacion_especial_asistentes_min` (verificado: 500 asistentes con umbral 200 → true). Sin referencias a recurrencia (T-V05). Compila sin errores.

### T-080 — Implementar CRUD solicitudes (POST/GET/PATCH /api/v1/solicitudes)

- **Descripción:** Implementar el CRUD de solicitudes. `POST` solo lo puede hacer `inquilino` y crea siempre en `estado: 'borrador'`. `GET` con paginación y filtros (`?estado=&tipo=&localId=&categoriaId=&subcategoriaId=&prioridad=&fechaDesde=&fechaHasta=`). `inquilino` solo ve las suyas; `admin_plaza` ve las de su plaza. `PATCH` solo permitido en `borrador` y `requerida_subsanacion`. Materializa CU-SO-1, CU-SO-2, CU-SO-5, CU-SO-6, RN-SO-1 a RN-SO-11.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/solicitudes` con `@Roles('inquilino')`. Crea en `borrador` con `usuario_creador_id = user.sub`, `prioridad` heredada de subcategoría, `codigo` autogenerado.
  - [ ] Valida `local_id` pertenece al inquilino (`local.inquilino_id` vía contrato vigente).
  - [ ] Local no debe estar `fuera_de_servicio` (RN-SO-1).
  - [ ] `categoria_id` y `subcategoria_id` requeridos salvo `tipo=otro` con `categoria_libre`. Si subcategoría inactiva → `404 SUBCATEGORIA_INACTIVA` o `400 SUBCATEGORIA_REQUERIDA`.
  - [ ] `campos_extra` validado con el schema Zod según `tipo` (T-079).
  - [ ] `titulo` 1-120, `descripcion` 1-4000 (Zod).
  - [ ] `GET /api/v1/solicitudes` paginado y filtrado. Filtros validados con Zod.
  - [ ] `GET /api/v1/solicitudes/:id` con detalle + adjuntos + comentarios + historial.
  - [ ] `PATCH /api/v1/solicitudes/:id` solo permitido en `borrador` o `requerida_subsanacion`. Inquilino solo edita los suyos. Valida cambios de local solo en esos estados.
  - [ ] RLS probado.
  - [ ] Errores con códigos: `LOCAL_NO_DISPONIBLE`, `SUBCATEGORIA_INACTIVA`, `SUBCATEGORIA_REQUERIDA`, `SOLICITUD_NOT_FOUND`, `INVALID_STATE_FOR_EDIT`.
- **Dependencias:** T-074, T-077, T-078, T-079, T-047, T-048, T-063, T-022.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** CRUD completo verificado con curl: POST solo inquilino crea `borrador` con prioridad heredada (subcategoría A → solicitud A) y código autogenerado; local validado vía contrato VIGENTE (`LOCAL_NO_DEL_INQUILINO`) y no `fuera_de_servicio`; `SUBCATEGORIA_REQUERIDA` salvo tipo=otro (verificado 400); campos_extra validados (400 con payload de otro tipo); PATCH solo borrador/requerida_subsanacion → `INVALID_STATE_FOR_EDIT` (verificado en `enviada`); detalle con adjuntos+comentarios+historial; RLS verificado con plaza acme (404 / total 0).

### T-081 — Implementar POST /api/v1/solicitudes/:id/enviar (T2 auto-asignación)

- **Descripción:** Implementar la transición T2 (`borrador → en_revision`) con auto-asignación al responsable de la subcategoría + lock 30 min. Dispara emails al responsable y supervisores. Inserta historial `tomada`. Materializa S-AutoAsignacion y T-2 de `docs/05` §2.2.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/solicitudes/:id/enviar` con `@Roles('inquilino')` (solo dueño).
  - [ ] Solo permitido en `borrador` → `400 INVALID_STATE_TRANSITION` si no.
  - [ ] Valida: `titulo` y `descripcion` no vacíos, subcategoría activa y con responsable, responsable es `admin_plaza` con `rol_staff` activo (SC-6), local no `fuera_de_servicio`.
  - [ ] Si la plaza exige adjuntos (config `requiere_adjuntos`, SUPUESTO S-FS-G extender) → `400 ADJUNTO_REQUERIDO`.
  - [ ] En una transacción:
    - `estado = 'en_revision'`, `enviada_at = now()`, `admin_asignado_id = subcategoria.responsable_id`, `asignada_at = now()`, `lock_expira_at = now() + 30 min`.
    - Insert en `solicitud_historial` con `evento: 'tomada'`, `estado_anterior: 'borrador'`, `estado_nuevo: 'en_revision'`, `usuario_id = user.sub`.
    - Insert en `email_log` con plantilla `solicitud-asignada-responsable.html` para el responsable.
    - Insert en `email_log` con plantilla `solicitud-nueva-supervisor.html` para cada supervisor (deduplicado: si responsable es también supervisor, solo una notificación).
  - [ ] Retorna la solicitud actualizada.
  - [ ] RLS probado.
- **Dependencias:** T-080, T-075, T-118 (en `09-notificaciones-email.md`), T-091 (en `07-aprobaciones.md`, state service).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** ⚠️ REDEFINIDA por T-V03: `enviar` ahora transiciona `borrador → enviada` (NO a en_revision), `enviada_at=now()`, sin asignación, sin lock y sin emails — la auto-asignación + emails los hace el cron T-091b a los 15 min. Sí valida: local no fuera_de_servicio, subcategoría activa y su responsable cumple SC-6 (para que la cola no quede huérfana). Implementada en `SolicitudStateService.enviar` (state service MÍNIMO adelantado de T-091; el resto de transiciones llega en módulo 07). El requisito "adjuntos obligatorios por plaza" NO se implementó: `configuracion` no tiene campo `requiere_adjuntos` (SUPUESTO sin validar; anotar para v1.1). Verificado con curl.

### T-082 — Implementar POST /api/v1/solicitudes/:id/cancelar

- **Descripción:** Implementar la cancelación de solicitudes en `borrador` (T3) o `en_revision` (T5). Libera el lock. Materializa T-3 y T-5 de `docs/05` §2.2.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/solicitudes/:id/cancelar` con body opcional `{ motivo }`.
  - [ ] `inquilino` solo puede cancelar las suyas. `admin_plaza` puede cancelar cualquiera de su plaza.
  - [ ] Solo permitido en `borrador` o `en_revision` → `400 INVALID_STATE_TRANSITION`.
  - [ ] En una transacción:
    - `estado = 'cancelada'`, libera `lock_expira_at` (NULL).
    - Insert en `solicitud_historial` con `evento: 'cancelada'`, `comentario: motivo?`.
  - [ ] No dispara emails (cancelación silenciosa).
  - [ ] RLS probado.
- **Dependencias:** T-080, T-075, T-091.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** Implementada vía `SolicitudStateService.cancelar`. ⚠️ Ajuste T-V03: se permite cancelar desde CUALQUIER estado no terminal (borrador/enviada/asignado/en_revision/requerida_subsanacion) — el plan original solo listaba borrador y en_revision porque no existían los estados de espera del flujo nuevo. Inquilino solo las suyas; admin cualquiera de su plaza. Sin email. Verificado (cancelación desde enviada).

### T-083 — Implementar POST /api/v1/solicitudes/:id/subsanar

- **Descripción:** Implementar la transición T9 (`requerida_subsanacion → en_revision`). Re-asigna al mismo responsable (o al `subcategoria.responsable_id` actual si cambió) con lock fresco de 30 min. Dispara email. Materializa S-FS-E y T-9 de `docs/05` §2.2.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/solicitudes/:id/subsanar` con `@Roles('inquilino')` (dueño).
  - [ ] Solo permitido en `requerida_subsanacion` → `400 INVALID_STATE_TRANSITION`.
  - [ ] El cuerpo del request es opcional (puede subir adjuntos y/o cambiar campos).
  - [ ] En una transacción:
    - `estado = 'en_revision'`, `enviada_at = now()`, `asignada_at = now()`, `lock_expira_at = now() + 30 min`.
    - Si `subcategoria.responsable_id` cambió desde el envío original, usar el nuevo; si no, mantener el actual.
    - Insert en `solicitud_historial` con `evento: 'enviada'`, `estado_anterior: 'requerida_subsanacion'`, `estado_nuevo: 'en_revision'`.
    - Insert en `email_log` con plantilla `solicitud-recibida.html` o `solicitud-asignada-responsable.html`.
  - [ ] NO exige marcar items atendidos (S-FS-E).
  - [ ] RLS probado.
- **Dependencias:** T-080, T-081, T-075, T-118.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** ⚠️ REDEFINIDA por T-V03: el reenvío transiciona `requerida_subsanacion → enviada` (NO a en_revision) y limpia `admin_asignado_id`; el cron T-091b re-asigna al responsable ACTUAL de la subcategoría a los 15 min. Historial `evento=enviada` con comentario "Reenviada tras subsanación". Sin email inmediato (lo dispara la auto-asignación). No exige marcado de items (S-FS-E). ⚠️ `POST /solicitudes/:id/subsanar` queda para el INQUILINO; la petición de subsanación del admin será `POST /solicitudes/:id/pedir-subsanacion` (T-096) para resolver la colisión de rutas del plan original.

### T-084 — Implementar POST /api/v1/solicitudes/:id/duplicar

- **Descripción:** Implementar la duplicación de solicitudes: crea un nuevo `borrador` copiando los campos editables (titulo, descripción, tipo, local, categoría, subcategoría, campos_extra, adjuntos) pero no los inmutables (estado, fechas, admin_asignado, historial). El inquilino puede revisar antes de enviar. Materializa S-Duplicar.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/solicitudes/:id/duplicar` con `@Roles('inquilino')`.
  - [ ] Solo permitido si la solicitud original es del mismo inquilino (`inquilino_id`).
  - [ ] Crea una nueva solicitud en `borrador` con `titulo` prefijado con "Copia de ", `codigo` nuevo, fechas reseteadas, `prioridad` heredada de la subcategoría actual.
  - [ ] `campos_extra` copiados.
  - [ ] Adjuntos: NO se copian automáticamente (decisión de UX, para evitar fugas entre solicitudes). El inquilino puede resubir.
  - [ ] Retorna la nueva solicitud.
  - [ ] Inserta `solicitud_historial` con `evento: 'creada'`, `comentario: 'Duplicada de SOL-{codigo_original}'`.
- **Dependencias:** T-080, T-075.
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** Verificado: copia campos editables, `titulo` "Copia de …" (truncado a 120), código nuevo, fechas reseteadas, prioridad de la subcategoría ACTUAL, adjuntos NO copiados, historial `creada` con "Duplicada de SOL-…".

### T-085 — Implementar PATCH /api/v1/solicitudes/:id/prioridad

- **Descripción:** Endpoint para que el `admin_plaza` cambie la prioridad de cualquier solicitud de su plaza. Inquilino NO puede (S-SO-Prioridad-2). Materializa S-Prioridad y `docs/06` matriz de permisos.
- **Criterios de aceptación:**
  - [ ] `PATCH /api/v1/solicitudes/:id/prioridad` con body `{ prioridad: 'A'|'B'|'C'|'D'|'F' }` y `@Roles('admin_plaza', 'superadmin')`.
  - [ ] No permitido en `borrador` (es la prioridad heredada de la subcategoría, el inquilino aún no la ha "activado"). Permitido en `en_revision` y `requerida_subsanacion`.
  - [ ] En una transacción:
    - Update `solicitud.prioridad`.
    - Insert en `solicitud_historial` con `evento: 'prioridad_cambiada'`, `comentario: '<anterior> → <nueva>'`.
  - [ ] Recalcula la SLA visual (vista materializada `solicitud_sla_view`, T-101 en `07-aprobaciones.md`).
  - [ ] RLS probado.
- **Dependencias:** T-080, T-075, T-101 (en `07-aprobaciones.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** Verificado: admin cambia prioridad en `enviada` (B→C) con historial `prioridad_cambiada` "B → C"; bloqueado en `borrador` y terminales. ⚠️ Ajuste T-V03: permitido en enviada/asignado/en_revision/requerida_subsanacion (la prioridad ordena la cola de la bandeja). El recálculo de la matview SLA ocurre con el cron diario (T-101, módulo 07); no se refresca sincrónicamente.

### T-086 — Implementar endpoints de comentarios e historial

- **Descripción:** Endpoints para agregar y listar comentarios, y para consultar el historial de la solicitud.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/solicitudes/:id/comentarios` con body `{ cuerpo, tipo }` y autenticado. Crea el comentario. Si `tipo=decision` o `tipo=subsanacion`, debe ser un `admin_plaza`.
  - [ ] `GET /api/v1/solicitudes/:id/comentarios` retorna el thread ordenado por `created_at ASC`.
  - [ ] `GET /api/v1/solicitudes/:id/historial` retorna el historial ordenado por `created_at ASC`. Append-only, no se puede escribir desde este endpoint (lo hacen T-081, T-082, T-094, T-095, T-096).
  - [ ] RLS probado.
- **Dependencias:** T-077, T-075, T-080.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** Verificado: `tipo=decision|subsanacion` exige admin (403 `COMENTARIO_TIPO_FORBIDDEN` como inquilino); thread ASC; el historial solo se escribe desde las transiciones (endpoint de lectura). Cada comentario también inserta historial `evento=comentario` para el timeline.

### T-087 — Implementar pantalla /solicitudes (listado)

- **Descripción:** Pantalla principal del inquilino para listar sus solicitudes con filtros y orden.
- **Criterios de aceptación:**
  - [ ] `/solicitudes` con tabla shadcn DataTable.
  - [ ] Columnas: código, tipo, título, local, estado (badge con color), prioridad (badge), fecha de envío, fecha de decisión (si aplica), acciones.
  - [ ] Filtros: estado, tipo, prioridad, fecha desde/hasta.
  - [ ] Botón "Nueva solicitud" (link a T-088).
  - [ ] Click en fila → `/solicitudes/[id]`.
  - [ ] Si `admin_plaza` accede a esta ruta (no debería), se redirige a `/admin/solicitudes`.
  - [ ] Paginación server-side.
- **Dependencias:** T-080, T-043.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** `/inquilino/solicitudes` (los route groups montan al inquilino bajo `/inquilino/...`): tabla con código/tipo/título/local/estado/prioridad/fechas, filtros (estado/tipo/prioridad/fechas) y paginación server-side. La redirección de roles la hace el layout del route group (rol distinto de inquilino → `/`). Build y lint en verde.

### T-088 — Implementar pantalla /solicitudes/nueva con formulario dinámico por tipo

- **Descripción:** Formulario multi-step que adapta los campos según el tipo seleccionado. Crea el `borrador` y opcionalmente permite enviar.
- **Criterios de aceptación:**
  - [ ] `/solicitudes/nueva` con wizard de 3 pasos:
    1. **Tipo y categoría**: select de tipo → carga subcategorías según categoría.
    2. **Detalles comunes**: select de local (filtrado por contratos vigentes del inquilino), título, descripción, fecha/hora si `tipo=evento` o `remodelacion`, campos_extra dinámicos según tipo.
    3. **Adjuntos y revisión**: upload de hasta 10 adjuntos, preview, "Guardar borrador" o "Enviar ahora".
  - [ ] Validación Zod por paso. El paso 2 no avanza si hay errores.
  - [ ] Si elige "Enviar ahora", se hace POST `/solicitudes` + POST `/solicitudes/:id/enviar` en una Server Action.
  - [ ] Si elige "Guardar borrador", solo POST `/solicitudes` y redirige a `/solicitudes/[id]`.
  - [ ] Los campos_extra se renderizan con componentes shadcn (input, date-picker, switch, etc.).
  - [ ] Recurrencia: si `tipo=evento`, pregunta "¿Es recurrente?" → muestra sub-form para `solicitud_evento_recurrente`.
- **Dependencias:** T-080, T-081, T-079, T-112 (en `08-adjuntos.md`, upload).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** Wizard de 3 pasos en `/inquilino/solicitudes/nueva` (⚠️ SIN paso de recurrencia, T-V05): tipo+categoría/subcategoría (omitidos para tipo=otro), detalles con campos_extra dinámicos por tipo, adjuntos (máx 10) + revisión con "Guardar borrador"/"Enviar ahora". Banner amarillo de duplicados (T-090) al elegir local. El mismo wizard sirve para editar (`/[id]/editar`, PATCH). Validación por paso en cliente + Zod en la Server Action + Zod en backend.

### T-089 — Implementar pantalla /solicitudes/[id]

- **Descripción:** Pantalla de detalle de la solicitud con tabs: Detalle, Comentarios, Historial, Adjuntos.
- **Criterios de aceptación:**
  - [ ] `/solicitudes/[id]` con header que muestra código, tipo, estado (badge grande con color), prioridad, local, fechas, asignado a (avatar + nombre).
  - [ ] Tab "Detalle": muestra todos los campos de la solicitud, incluidos los `campos_extra` formateados según tipo.
  - [ ] Tab "Comentarios": thread de comentarios con formulario para agregar.
  - [ ] Tab "Historial": timeline con todas las transiciones (evento, fecha, usuario, comentario).
  - [ ] Tab "Adjuntos": lista de adjuntos con preview y download.
  - [ ] Acciones contextuales según estado y rol:
    - `borrador`: "Editar", "Enviar", "Cancelar", "Duplicar".
    - `en_revision`: "Cancelar", "Comentar".
    - `requerida_subsanacion`: "Subsanar" (link al formulario), "Cancelar".
    - Terminales: solo lectura.
  - [ ] SLA visual: barra de progreso con color (verde/amarillo/rojo) calculada según T-100.
- **Dependencias:** T-080, T-086, T-112 (en `08-adjuntos.md`), T-100 (en `07-aprobaciones.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** `/inquilino/solicitudes/[id]` con header (código + badges estado/prioridad + asignado) y tabs Detalle (campos_extra formateados)/Comentarios (thread+form)/Historial (timeline)/Adjuntos (upload si borrador|requerida_subsanacion, descarga pre-firmada, eliminar). Acciones por estado: borrador→Editar/Enviar/Cancelar/Duplicar; requerida_subsanacion→Editar/Reenviar/Cancelar; no terminal→Cancelar; siempre Duplicar. ⚠️ La barra SLA visual llega con T-100 (módulo 07); el campo `slaStatus` ya viaja en el contrato.

### T-090 — Implementar heurística de duplicados y límite de 10 adjuntos

- **Descripción:** Implementar la heurística de detección de duplicados (mismo `local_id` y `tipo` en últimos 30 días) que muestra un aviso en el formulario de nueva solicitud, y validar el límite de 10 adjuntos por solicitud (S-FS-G).
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/solicitudes/duplicados?localId=&tipo=` retorna las solicitudes del mismo local y tipo en los últimos 30 días, en estado no terminal.
  - [ ] El frontend (T-088) muestra un banner amarillo "Ya existe una solicitud reciente similar: SOL-{codigo}" si hay resultados.
  - [ ] El aviso es NO bloqueante (el inquilino puede continuar).
  - [ ] `POST /api/v1/solicitudes/:id/adjuntos` valida que el conteo actual < 10. Si excede → `400 MAX_ADJUNTOS_EXCEDIDO`.
  - [ ] El conteo excluye adjuntos soft-deleted.
  - [ ] RLS probado.
- **Dependencias:** T-080, T-112.
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-06-solicitudes`):** `GET /solicitudes/duplicados` (ruta estática declarada antes de `:id`): mismo local+tipo, 30 días, estados no terminales, máx 5; inquilino solo ve los suyos. Banner NO bloqueante en el wizard. Límite de 10 adjuntos en `AdjuntosService.uploadSolicitudAdjunto` (excluye soft-deleted) → 400 `MAX_ADJUNTOS_EXCEDIDO`. ⚠️ T-112 (módulo 08) se adelantó aquí: MIME contra `configuracion.mime_types_permitidos` (verificado txt→400), tamaño por plaza, bucket `solicitudes-adjuntos-{plaza_id}`, historial `adjunto_agregado`, permisos (inquilino solo borrador/requerida_subsanacion → 403 en cancelada, verificado). RLS verificado.
