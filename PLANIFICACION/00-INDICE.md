# Índice general · `sys-solicitudes` (Plazapp)

> **Propósito:** Este archivo es el **punto de entrada único** al plan de implementación del sistema. Aquí encontrarás el dashboard de estado, el mapa global de tareas, los **SUPUESTOS críticos que el cliente debe validar antes de iniciar el desarrollo**, y enlaces a cada módulo con su lista detallada de tareas.

---

## 1. Criterio de división

La planificación se divide **por módulo funcional** (alineado 1:1 con los módulos NestJS descritos en `docs/07-arquitectura.md` §7.3). Cada archivo agrupa el backend de un módulo + las pantallas frontend asociadas, de modo que un PR entrega típicamente las tareas de un solo archivo. Esto facilita el ownership, evita el acoplamiento accidental entre archivos, y permite que un desarrollador tome tareas de un módulo sin abrir los demás.

---

## 2. Conteo global

| Concepto | Cantidad |
|---|---|
| Archivos de planificación | 15 (este + 14 módulos) |
| Tareas técnicas (T-NNN) | 161 |
| Tareas de validación de SUPUESTOS (T-VNN) | 16 (T-V01..T-V15 + T-V22) |
| **Total de tareas** | **177** |

---

## 3. Dashboard de estado (macro)

> Actualizar manualmente al cierre de cada tarea. La columna "Progreso" se calcula como Completadas / Total del archivo.

| Archivo | Rango de IDs | Total | Completadas | Progreso |
|---|---|---|---|---|
| `00-INDICE.md` (SUPUESTOS) | T-V01 … T-V15 | 15 | 0 | 0% |
| `01-setup-base.md` | T-001 … T-016 | 16 | 0 | 0% |
| `02-autenticacion-usuarios.md` | T-017 … T-035 | 19 | 0 | 0% |
| `03-plazas-multitenant.md` | T-036 … T-046 | 11 | 0 | 0% |
| `04-locales-inquilinos-contratos.md` | T-047 … T-062 | 16 | 14 (+2 descartadas T-V07) | 100% |
| `05-categorias-subcategorias.md` | T-063 … T-073 | 11 | 11 | 100% |
| `06-solicitudes.md` | T-074 … T-090 | 17 | 16 (+1 descartada T-V05) | 100% |
| `07-aprobaciones.md` | T-091 … T-108 (+T-091b/c) | 20 | 18 (+2 reemplazadas T-V03) | 100% |
| `08-adjuntos.md` | T-109 … T-117 | 9 | 9 | 100% |
| `09-notificaciones-email.md` | T-118 … T-127 | 10 | 0 | 0% |
| `10-calendario.md` | T-128 … T-134 | 7 | 1 (T-128 adelantada) | 14% |
| `11-reportes-panel.md` | T-135 … T-145 | 11 | 0 | 0% |
| `12-seguridad-auditoria.md` | T-146 … T-152 | 7 | 0 | 0% |
| `13-observabilidad-despliegue.md` | T-153 … T-160 | 8 | 0 | 0% |
| `12-seguridad-auditoria.md` (T-161 agregado en sesión 2026-06-11) | T-146 … T-161 | 8 | 0 | 0% |
| **Total** | | **176** | **14** | **8%** |

> Nota 2026-06-06: los módulos 01–03 figuran con 0 en esta tabla aunque sus bitácoras los marcan completados — la tabla no se actualizó al cierre de esos módulos. Se actualizó solo la fila del módulo 04 en esta sesión; regularizar las filas 00–03 al revisarlas.

---

## 4. Tareas de validación con cliente (SUPUESTOS críticos)

> ⚠️ **Estas tareas bloquean el inicio de la implementación (T-001).** Cada una representa un conjunto de SUPUESTOS que el cliente debe confirmar o ajustar. Si el cliente cambia la decisión, las tareas técnicas dependientes (en otros archivos) deben re-evaluarse —queda documentado en la bitácora de la T-Vxx correspondiente y se propagan las alertas a las tareas afectadas.

### T-V01 — Validar estrategia multi-tenant
- **Descripción:** Confirmar con el cliente la decisión de DB compartida con discriminador `plaza_id` (en lugar de schema-per-tenant o DB-per-tenant), la resolución por subdominio en producción (`acme.plazapp.com` → `slug=acme`), la inmutabilidad del `slug`, y que un usuario pertenece a una sola plaza y un solo rol.
- **SUPUESTOS:** S-EstrategiaMT, S-MT-A, S-MT-B, S-MT-C.
- **Origen:** `README.md` §6 · `docs/01-vision-general.md` R3 · `docs/03-modulos-del-sistema.md` §3.1.
- **Criterios de aceptación:**
  - [x] Acta con la confirmación firmada por el cliente.
  - [x] Confirmado proveedor de DNS wildcard y plan de TLS (cert SAN/wildcard). — **N/A, ver bitácora**
  - [x] Confirmado que `slug` no cambia tras el alta (afecta URLs históricas). — **N/A, ver bitácora**
  - [x] Confirmado que un usuario no puede tener roles múltiples ni estar en dos plazas.
- **Tareas dependientes potencialmente afectadas (si cambia):** T-036, T-037, T-038, T-039, T-040, T-041, T-042, T-043 (en `03-plazas-multitenant.md`); T-017, T-018, T-020, T-021, T-022 (en `02-autenticacion-usuarios.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **S-EstrategiaMT (Confirmado):** DB compartida con discriminador `plaza_id`. RLS PG como segunda capa de defensa.
    - **S-MT-A (REVISADO — DESVIACIÓN del SUPUESTO original):** **Single subdomain en producción** (`app.plazapp.com`). La plaza **NO aparece en la URL**. Todos los usuarios, de todas las plazas, acceden al mismo dominio. Local: `localhost:3000` (FE) y `localhost:4000` (BE), sin path de plaza. Esto elimina la necesidad de DNS wildcard, TLS wildcard, middleware de resolución de tenant por host/path, y el header `x-plaza-slug`. La resolución de tenant se hace **únicamente** por el `plaza_id` en el JWT.
    - **S-MT-B (Consecuencia):** El `slug` sigue siendo inmutable en BD y se mantiene como identificador interno (para emails, referencias internas, branding), pero **ya no es visible en la URL** y por tanto no afecta URLs históricas externas.
    - **S-MT-C (Confirmado):** Un usuario pertenece a una sola plaza y un solo rol.
  - **Tareas dependientes afectadas (revisar antes de implementar):**
    - **T-039 (en `03-plazas-multitenant.md`):** ⚠️ Revisar — la resolución de tenant en middleware Next.js ya no es necesaria. El middleware solo necesita pasar el JWT (que ya tiene `plaza_id`). El header `x-plaza-slug` se elimina.
    - **T-042 (en `03-plazas-multitenant.md`):** ⚠️ Revisar — el branding dinámico ya no se inyecta por layout según slug, sino por usuario autenticado (su `plaza_id` resuelve el branding).
    - **T-032, T-033, T-034 (en `02-autenticacion-usuarios.md`):** ⚠️ Revisar — el helper `apiFetch` y el flujo de login ya no necesitan inyectar `x-plaza-slug`; el backend obtiene el `plaza_id` del JWT.
    - **T-046 (en `03-plazas-multitenant.md`):** ⚠️ Revisar — la pantalla `/superadmin/plazas` se mantiene, pero la landing pública desaparece (no hay necesidad de elegir plaza, se hace por login).
  - **Criterios de aceptación modificados:**
    - [x] Criterios originales sobre DNS wildcard y TLS se marcan N/A por el cambio de S-MT-A.
    - [x] Criterio sobre slug inmutable se mantiene a nivel de BD (no afecta URLs porque no aparece en URL).
  - **Acción al equipo de implementación:** Antes de T-039, leer esta bitácora y aplicar el cambio de arquitectura. La complejidad se reduce significativamente: no hay subdominios, no hay middleware de host resolution, no hay header de tenant.

### T-V02 — Validar roles de staff y categorías/subcategorías
- **Descripción:** Confirmar que cada plaza define libremente sus roles operativos (técnico, ingeniero, etc.) vía CRUD, que `categoria` y `subcategoria` son entidades configurables por plaza, y que una subcategoría tiene exactamente 1 responsable y entre 0 y 5 supervisores (enforced por trigger PL/pgSQL).
- **SUPUESTOS:** S-RolStaff, S-Categorias, S-Subcategoria, S-ResponsabilidadStaff.
- **Origen:** `README.md` §6 · `docs/04-modelo-de-datos.md` §1.7 (S-RolStaff, S-MD-K, S-MD-L) · `docs/06-roles-y-permisos.md` §3.2 y §3.4 SC-6.
- **Criterios de aceptación:**
  - [x] Confirmado que las capacidades de aprobación/rechazo son uniformes para todos los `admin_plaza` independientemente de su `rol_staff` (S-RP-J).
  - [x] Confirmado que `admin_plaza` requiere `rol_staff_id` NOT NULL.
  - [x] Confirmada la regla 1 responsable + 0-5 supervisores por subcategoría.
  - [x] Confirmado que responsable y supervisores deben ser `admin_plaza` con `rol_staff` activo y misma plaza (SC-6).
- **Tareas dependientes potencialmente afectadas:** T-019, T-022, T-035 (en `02-autenticacion-usuarios.md`); T-063 a T-073 (en `05-categorias-subcategorias.md`); T-082 (en `06-solicitudes.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **S-RolStaff (Confirmado):** Cada admin_plaza crea/edita/desactiva sus propios roles_staff libremente (CRUD por plaza). Sin catálogo fijo de plataforma.
    - **Capacidades (S-RP-J, Confirmado):** En v1, todos los `admin_plaza` tienen las mismas capacidades operativas (aprobar, rechazar, subsanar, reasignar, configurar). El `rol_staff` es solo un identificador/etiqueta interna, NO define permisos diferenciados. Esto simplifica la matriz de permisos.
    - **S-Subcategoria (Confirmado):** 1 responsable obligatorio + 0-5 supervisores por subcategoría. Trigger PL/pgSQL enforça el máximo de 5 supervisores. SC-6 se mantiene: responsable y supervisores deben ser `admin_plaza` con `rol_staff` activo y misma `plaza_id`.
    - **S-ResponsabilidadStaff (Confirmado):** `rol_staff_id` es NOT NULL en `admin_plaza`. No se puede crear un admin_plaza sin rol_staff activo asignado.
  - **Tareas dependientes afectadas:** Ninguna desviación. Las tareas T-019, T-022, T-035, T-063-T-073, T-082 se mantienen tal cual.
  - **Criterios de aceptación:** Todos cumplidos sin modificaciones.

### T-V03 — Validar auto-asignación y SLA
- **Descripción:** Confirmar que al enviar una solicitud, el sistema la asigna automáticamente al responsable de la subcategoría con un lock de 30 min, que el SLA es visual (semáforo) por tipo de solicitud, y que el multiplicador por prioridad es configurable por plaza en `configuracion.sla_multiplicador_por_prioridad`.
- **SUPUESTOS:** S-AutoAsignacion, S-LockTimeout, S-SLA, S-SLA-Prioridad.
- **Origen:** `docs/05-flujo-de-solicitudes.md` §2.2 T2, §2.5, §2.6 · `docs/03-modulos-del-sistema.md` §3.7 · `docs/04-modelo-de-datos.md` `configuracion`.
- **Criterios de aceptación:**
  - [x] Confirmado el flujo de auto-asignación — **ver bitácora, flujo REVISADO**.
  - [x] Confirmado el tiempo de espera antes de auto-asignación: **15 minutos** (en lugar de 30).
  - [x] Confirmado el SLA visual (semáforo) por tipo de solicitud.
  - [x] Confirmado el multiplicador por prioridad configurable por plaza.
  - [x] Confirmado el cron diario que actualiza `solicitud_sla_view`.
- **Tareas dependientes potencialmente afectadas:** T-074, T-078, T-081, T-082, T-083, T-091, T-094, T-095, T-096, T-097, T-098, T-099, T-100, T-101, T-104 (en `06-solicitudes.md` y `07-aprobaciones.md`); T-044 (en `03-plazas-multitenant.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **S-AutoAsignacion (REVISADO — FLUJO NUEVO):** El state machine se expande con un nuevo estado `asignado` entre `enviada` y `en_revision`. Flujo completo:
      1. `borrador` → `enviada` (cuando el inquilino hace click en "Enviar", inmediato).
      2. `enviada` → `asignado` (tras **15 minutos** de espera, el sistema auto-asigna al `responsable_id` actual de la subcategoría).
      3. `asignado` → `en_revision` (cuando el admin asignado hace click en "Tomar" para empezar a trabajar).
      4. `en_revision` → `aprobada` / `rechazada` / `requerida_subsanacion` (transiciones terminales o de subsanación).
      5. `requerida_subsanacion` → `enviada` (al reenviar, vuelve a la cola, NO directo a en_revision). Tras 15 min, vuelve a `asignado` (puede ser al mismo responsable o al actual de la subcategoría, TBD).
    - **S-LockTimeout (REVISADO):** El concepto de "lock de 30 min sobre un admin" se **ELIMINA**. Lo que existe ahora es una espera de 15 min en `enviada` antes de auto-asignar. Una vez en `asignado`, no hay timeout automático; el admin puede "Tomar" cuando quiera (o un supervisor lo hace por él).
    - **S-SLA (Confirmado):** Semáforo visual (verde/amarillo/rojo) por tipo de solicitud. Cron diario actualiza `solicitud_sla_view`.
    - **S-SLA-Prioridad (Confirmado):** Multiplicador por prioridad configurable por plaza en `configuracion.sla_multiplicador_por_prioridad`. Defaults: `A=0.5, B=1.0, C=1.5, D=2.0, F=3.0`.
    - **SLA timer:** El SLA empieza a contar desde `enviada` (cuando se envía), NO desde `asignado` ni `en_revision`. Si el SLA se cumple mientras está en `enviada`, se muestra rojo.
  - **Tareas dependientes afectadas (⚠️ Revisar antes de implementar):**
    - **T-074 (en `06-solicitudes.md`):** ⚠️ El modelo `solicitud` necesita el nuevo estado `asignado` y el campo `enviada_at` (cuándo pasó a `enviada`).
    - **T-078 (en `06-solicitudes.md`):** ⚠️ El ENUM `solicitud_estado` debe añadir el valor `asignado`.
    - **T-081 (en `06-solicitudes.md`):** ⚠️ El endpoint `enviar` ahora transiciona `borrador → enviada` (no `borrador → en_revision` como decía el SUPUESTO original). NO asigna al responsable aquí. NO crea lock.
    - **NUEVA TAREA T-091b (a crear en `07-aprobaciones.md`):** Cron cada 1 min que busca solicitudes en `enviada` con `enviada_at < now() - 15 min` y las transiciona a `asignado`, asignando al `responsable_id` actual de la subcategoría. Esta tarea reemplaza el concepto de auto-asignación inmediata.
    - **NUEVA TAREA T-091c (a crear en `07-aprobaciones.md`):** Endpoint `POST /solicitudes/:id/tomar` que transiciona `asignado → en_revision`. El admin asignado hace click para empezar a revisar. Cualquier `admin_plaza` puede tomar una solicitud en `asignado` (no solo el asignado)? — **DECISIÓN PENDIENTE: confirmar si solo el asignado o cualquier admin**.
    - **T-083 (en `06-solicitudes.md`):** ⚠️ El endpoint `subsanar` ahora transiciona `requerida_subsanacion → enviada` (no `requerida_subsanacion → en_revision` como decía el SUPUESTO).
    - **T-094, T-095, T-096 (en `07-aprobaciones.md`):** Sin cambios. Solo se permite aprobar/rechazar/subsanar en `en_revision`.
    - **T-097 (en `07-aprobaciones.md`):** ⚠️ `reasignar` se aplica en `asignado` o `en_revision` (decidir). Si se reasigna en `asignado`, no se necesita liberar lock (no hay lock).
    - **T-098 (en `07-aprobaciones.md`):** ⚠️ ELIMINAR o REEMPLAZAR — ya no hay "expiración de lock". El cron ahora se enfoca en transicionar `enviada → asignado` tras 15 min (ver T-091b).
    - **T-099 (en `07-aprobaciones.md`):** ⚠️ La bandeja priorizada debe mostrar 3 colas separadas: (a) `enviada` (en espera de auto-asignación), (b) `asignado` (asignadas a alguien), (c) `en_revision` (en revisión activa).
    - **T-100 (en `07-aprobaciones.md`):** El SLA timer cuenta desde `enviada_at`, no desde `asignada_at`. Ajustar fórmula.
  - **Decisión pendiente para clarificar:** Si en `asignado`, solo el admin asignado puede hacer "Tomar" o cualquier `admin_plaza` puede. Recomiendo que solo el asignado (más predecible) pero requiere validación con el cliente si se quiere que cualquier admin pueda "robarla".

### T-V04 — Validar prioridad y reasignación
- **Descripción:** Confirmar que la prioridad (`A|B|C|D|F`) se hereda de la subcategoría al crear la solicitud, que el `admin_plaza` puede modificarla con `PATCH /solicitudes/:id/prioridad`, y que cualquier `admin_plaza` (no solo supervisores) puede reasignar manualmente con `POST /solicitudes/:id/reasignar` transfiriendo el lock de 30 min.
- **SUPUESTOS:** S-Prioridad, S-Reasignacion.
- **Origen:** `README.md` §6 · `docs/03-modulos-del-sistema.md` §3.5 y §3.7 · `docs/05-flujo-de-solicitudes.md` §2.2 T12.
- **Criterios de aceptación:**
  - [x] Confirmado que el inquilino NO puede modificar la prioridad.
  - [x] Confirmado el comportamiento al cambiar responsable de subcategoría — **ver bitácora, comportamiento REVISADO**.
  - [x] Confirmado en qué estados se permite reasignar.
  - [x] Confirmada la matriz de permisos: solo `admin_plaza` puede cambiar prioridad y reasignar.
- **Tareas dependientes potencialmente afectadas:** T-069 (en `05-categorias-subcategorias.md`); T-085, T-086, T-097 (en `07-aprobaciones.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **S-Prioridad (Confirmado):** La prioridad (`A|B|C|D|F`) se hereda de la subcategoría al crear la solicitud. El `admin_plaza` puede modificarla con `PATCH /solicitudes/:id/prioridad`. El inquilino NO puede modificarla.
    - **Reasignación entre admins (Confirmado):** Cualquier `admin_plaza` puede reasignar manualmente con `POST /solicitudes/:id/reasignar`. NO se requiere ser supervisor.
    - **Estados permitidos para reasignar (Confirmado):** Se puede reasignar en `asignado` y `en_revision`. NO en `enviada` (en cola, sin asignar todavía).
    - **Comportamiento al cambiar responsable de subcategoría (REVISADO — DESVIACIÓN del SUPUESTO original):** **REASIGNAR TODAS** las solicitudes, **incluyendo las que están en `en_revision`**. Esto significa que si un admin está revisando una solicitud y alguien cambia el responsable de la subcategoría, la solicitud se le quita y pasa al nuevo responsable (con su historial de revisión preservado, pero `admin_asignado_id` actualizado).
      - **Implicación:** UX disruptivo. El admin en revisión debe estar preparado para perder solicitudes si el responsable cambia. Considerar implementar un "warning" al cambiar el responsable listando las solicitudes afectadas.
  - **Tareas dependientes afectadas (⚠️ Revisar antes de implementar):**
    - **T-069 (en `05-categorias-subcategorias.md`):** ⚠️ El endpoint que cambia el responsable de subcategoría debe reasignar TODAS las solicitudes activas (`enviada`, `asignado`, `en_revision`, `requerida_subsanacion`) al nuevo responsable. Insertar en `solicitud_historial` con `evento: 'reasignada'`, `comentario: 'Cambio de responsable de subcategoría'`. Enviar email a los admins afectados. Considerar warning en la UI listando cuántas solicitudes se reasignarán antes de confirmar.
    - **T-097 (en `07-aprobaciones.md`):** Ajustar para permitir reasignación en `asignado` (nuevo estado) además de `en_revision`. El "lock" ya no se transfiere (no hay lock); solo se actualiza `admin_asignado_id` y `asignada_at`.
    - **T-085 (en `07-aprobaciones.md`):** Sin cambios. PATCH de prioridad sigue funcionando en `en_revision` y `requerida_subsanacion`.
  - **Criterios de aceptación modificados:**
    - [x] Original: "el cambio de responsable reasigna solicitudes futuras (no las en curso)" — **MODIFICADO** a "reasignar TODAS, incluyendo en_revision".

### T-V05 — Validar campos extra por tipo de solicitud
- **Descripción:** Confirmar los campos extra por tipo (`mantenimiento`, `evento`, `remodelacion`, `otro`) almacenados en JSONB y validados con Zod en backend, y la recurrencia opcional para eventos.
- **SUPUESTOS:** S-CamposTipo, S-SO-A, S-SO-B, S-Recurrencia.
- **Origen:** `docs/03-modulos-del-sistema.md` §3.5 (RN-SO-7, RN-SO-9) · `docs/04-modelo-de-datos.md` `solicitud.campos_extra`.
- **Criterios de aceptación:**
  - [x] Confirmados los campos extra por cada tipo:
    - `mantenimiento`: `area_afectada` (texto), `requiere_ingreso_a_local` (bool).
    - `evento`: `asistentes_estimados` (int), `asistentes` (array).
    - `remodelacion`: `fecha_inicio_estimada` (date), `duracion_dias` (int), `empresa_constructora` (texto), `monto_presupuesto` (decimal).
    - `otro`: `categoria_libre` (texto), `descripcion_larga` (texto).
  - [x] Confirmado el umbral de "evento con > 200 asistentes requiere aprobación especial" — **configurable por plaza**.
  - [x] Confirmada la recurrencia de eventos — **ver bitácora, NO en v1**.
  - [x] Confirmada la validación con Zod en backend antes de persistir.
- **Tareas dependientes potencialmente afectadas:** T-076, T-079, T-081, T-088 (en `06-solicitudes.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **S-CamposTipo (Confirmado):** Los campos extra propuestos se confirman tal cual. Se almacenan en `solicitud.campos_extra` (JSONB) y se validan con Zod en backend.
    - **S-SO-A (Confirmado):** Validación con Zod en backend antes de persistir.
    - **Umbral de aprobación especial (Confirmado):** 200 asistentes. **Configurable por plaza** (en `configuracion.aprobacion_especial_asistentes_min`).
    - **S-Recurrencia (REVISADO — DESVIACIÓN del SUPUESTO original):** **Sin recurrencia en v1**. Los eventos recurrentes se manejan creando N solicitudes manualmente (o desde el calendario, una por ocurrencia). El modelo `solicitud_evento_recurrente` **se elimina de v1**.
  - **Tareas dependientes afectadas (⚠️ Revisar antes de implementar):**
    - **T-076 (en `06-solicitudes.md`):** ⚠️ ELIMINAR la creación del modelo `solicitud_evento_recurrente`. La migración no se incluye en v1.
    - **T-079 (en `06-solicitudes.md`):** Quitar de los Zod schemas cualquier referencia a recurrencia. El `CamposExtraEventoSchema` no incluye patrón ni intervalo.
    - **T-081 (en `06-solicitudes.md`):** Quitar la mención de "Recurrencia: si tipo=evento, pregunta..." del formulario.
    - **T-088 (en `06-solicitudes.md`):** Simplificar el wizard de nueva solicitud: el paso de recurrencia se omite. Solo paso único con todos los campos.
  - **Criterios de aceptación modificados:**
    - [x] Original: "Confirmada la recurrencia de eventos" — **MODIFICADO a NO en v1**.
  - **Actualización 2026-07-27:** se removieron `requiere_corte_calle` y `requiere_amplificacion` del schema `evento` por decisión del cliente. El sistema aún no estaba en producción, sin impacto en datos existentes. Afecta: `frontend/src/components/client/solicitud-wizard.tsx`, `solicitud-detail-admin.tsx`, `solicitud-detail-inquilino.tsx`, `backend/src/modules/reportes/reportes.service.ts`, `packages/contracts/src/solicitudes/index.ts`.

### T-V06 — Validar política de adjuntos
- **Descripción:** Confirmar el límite de 25 MB por archivo, la lista cerrada de MIME (PDF/JPEG/PNG/WEBP/XLSX/DOCX/DWG), la versión simple de adjuntos, la cuarentena 30 días, y la previsualización inline para PDF e imágenes.
- **SUPUESTOS:** S-TamañoMax, S-MimeTypes, S-Preview, S-Quarantine.
- **Origen:** `docs/02-stack-tecnologico.md` §2.7 (MinIO) · `docs/03-modulos-del-sistema.md` §3.10 (RN-AD-1 a RN-AD-6) · `docs/07-arquitectura.md` §4.7.
- **Criterios de aceptación:**
  - [x] Confirmado el tamaño máximo por archivo — **ver bitácora, REVISADO a 50 MB**.
  - [x] Confirmada la lista cerrada de MIME.
  - [x] Confirmado 10 adjuntos máximo por solicitud (S-FS-G).
  - [x] Confirmada la cuarentena 30 días en bucket `quarantine-{plaza_id}`.
  - [x] Confirmado el versionado simple (reemplazar archivo).
  - [x] Confirmada la previsualización inline para PDF e imágenes.
  - [x] Confirmado que NO hay antivirus ni OCR en v1.
- **Tareas dependientes potencialmente afectadas:** T-109, T-110, T-111, T-112, T-113, T-114, T-115, T-116, T-117 (en `08-adjuntos.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **S-TamañoMax (REVISADO — DESVIACIÓN del SUPUESTO original):** **50 MB** por archivo (en lugar de 25 MB propuesto). Configurable por plaza en `configuracion.tamanio_max_archivo_mb` con default 50.
    - **S-MimeTypes (Confirmado):** Lista cerrada por defecto: PDF, JPEG, PNG, WEBP, XLSX, DOCX, DWG. Configurable por plaza (agregar/quitar de la lista).
    - **S-FS-G (Confirmado):** 10 adjuntos máximo por solicitud. Error `400 MAX_ADJUNTOS_EXCEDIDO` al exceder.
    - **S-Quarantine (Confirmado):** Cuarentena 30 días en bucket `quarantine-{plaza_id}`. Cron diario purga los de > 30 días.
    - **S-Preview (Confirmado):** Previsualización inline para PDF (primera página) e imágenes (thumbnail).
    - **Sin antivirus/OCR en v1 (Confirmado):** Solo validación de magic bytes + extensión.
  - **Tareas dependientes afectadas (⚠️ Revisar antes de implementar):**
    - **T-115 (en `08-adjuntos.md`):** ⚠️ Cambiar todos los `25 MB` a `50 MB` y los defaults de `configuracion.tamanio_max_archivo_mb` a `50`.
    - **T-117 (en `08-adjuntos.md`):** Ajustar el componente Client para mostrar "50 MB máx" en el uploader.
    - **T-037 (en `03-plazas-multitenant.md`):** El default de `tamanio_max_archivo_mb` en `configuracion` debe ser `50`.
  - **Criterios de aceptación modificados:**
    - [x] Original: "Confirmado 25 MB por archivo" — **MODIFICADO a 50 MB**.

### T-V07 — Validar locales, contratos y CSV
- **Descripción:** Confirmar los 4 estados de local (`disponible`, `alquilado`, `en_mantenimiento`, `fuera_de_servicio`), el contrato indefinido (`fecha_fin` NULL permitido), las alertas de vencimiento T-30 y T-7, y el importador CSV para onboarding masivo de locales.
- **SUPUESTOS:** S-CSV, S-ContratoIndefinido, S-AlertaVencimiento, S-EstadosLocal.
- **Origen:** `docs/03-modulos-del-sistema.md` §3.4 · `docs/04-modelo-de-datos.md` `local.estado`, `contrato.fecha_fin`.
- **Criterios de aceptación:**
  - [x] Confirmados los 4 estados de local.
  - [x] Confirmado que el contrato con `fecha_fin = NULL` es indefinido.
  - [x] Confirmado el formato del CSV de locales — **N/A, ver bitácora**.
  - [x] Confirmada la estrategia de validación del CSV — **N/A, ver bitácora**.
  - [x] Confirmadas las alertas T-30 y T-7 (email, no in-app).
  - [x] Confirmado que el trigger anti-solapamiento rechaza cualquier `contrato.vigente` solapado para el mismo `local_id`.
- **Tareas dependientes potencialmente afectadas:** T-047, T-048, T-049, T-050, T-051, T-052, T-053, T-054, T-055, T-056, T-062 (en `04-locales-inquilinos-contratos.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **S-EstadosLocal (Confirmado):** 4 estados: `disponible`, `alquilado`, `en_mantenimiento`, `fuera_de_servicio`. Edición manual por admin_plaza con reglas de transición. Cambio automático a `alquilado` si hay contrato vigente.
    - **S-ContratoIndefinido (Confirmado):** `fecha_fin = NULL` permitido (contrato indefinido). Se considera vigente hasta que se cierre explícitamente.
    - **S-AlertaVencimiento (Confirmado):** Cron diario a las 09:00 (hora de la plaza) busca contratos con `fecha_fin` = hoy+30 y hoy+7, envía email al admin_plaza. Sin duplicados el mismo día.
    - **S-CSV (REVISADO — DESVIACIÓN del SUPUESTO original):** **Sin importador CSV en v1**. El alta de locales se hace uno por uno desde el panel admin. Se puede agregar en v1.1.
    - **Trigger anti-solapamiento (Confirmado):** Rechaza cualquier `contrato.vigente` solapado para el mismo `local_id`. Trigger PL/pgSQL `tg_contrato_no_overlap`.
  - **Tareas dependientes afectadas (⚠️ Revisar antes de implementar):**
    - **T-052 (en `04-locales-inquilinos-contratos.md`):** ⚠️ ELIMINAR la tarea. No se implementa el importador CSV en v1.
    - **T-058 (en `04-locales-inquilinos-contratos.md`):** ⚠️ ELIMINAR la pantalla `/admin/locales/importar`. Solo queda el botón "Nuevo local" (alta manual).
    - **T-051 (en `04-locales-inquilinos-contratos.md`):** Quitar la mención de "Importar CSV" del botón. Solo "Nuevo local".
  - **Criterios de aceptación modificados:**
    - [x] Originales sobre formato CSV y estrategia de validación — **MODIFICADOS a N/A, sin CSV en v1**.

### T-V08 — Validar branding y presentación
- **Descripción:** Confirmar la personalización visual por plaza (color primario en variable CSS, logo en header, nombre comercial), la zona horaria IANA (default `America/Costa_Rica`), y los colores por tipo de solicitud en el calendario.
- **SUPUESTOS:** S-Branding, S-ColorTipo, S-Timezone.
- **Origen:** `docs/04-modelo-de-datos.md` `plaza.color_primario`, `plaza.timezone` · `docs/03-modulos-del-sistema.md` §3.6 y §3.9.
- **Criterios de aceptación:**
  - [x] Confirmado el formato del logo (PNG/SVG, tamaño máximo).
  - [x] Confirmada la TZ — **ver bitácora, REVISADO a solo El Salvador**.
  - [x] Confirmados los colores por defecto por tipo de solicitud (`mantenimiento`/`evento`/`remodelacion`/`otro`).
  - [x] Confirmado el alcance del branding — **ver bitácora, REVISADO a ambos roles**.
  - [x] Confirmado que el branding se aplica también en emails (header del template).
- **Tareas dependientes potencialmente afectadas:** T-041, T-042, T-043, T-044, T-045 (en `03-plazas-multitenant.md`); T-128 a T-134 (en `10-calendario.md`); T-118, T-120 (en `09-notificaciones-email.md`); T-006, T-009 (en `01-setup-base.md`).
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **Logo (Confirmado):** PNG o SVG, tamaño máx 2 MB, dimensiones recomendadas 512x512 px.
    - **S-Timezone (REVISADO — DESVIACIÓN del SUPUESTO original):** **Solo El Salvador** (`America/El_Salvador`). No se permite otra TZ. Esto simplifica enormemente la implementación (no hay lista de IANA, no hay validación, no hay dropdown de TZ). El default es fijo.
    - **S-Branding (REVISADO — DESVIACIÓN del SUPUESTO original):** **Tanto `admin_plaza` como `superadmin` pueden cambiar el branding** (color, logo, nombre comercial). El SUPUESTO original decía que solo `admin_plaza` lo hacía. Esto le da más control al superadmin sobre la presentación de la plataforma.
    - **S-ColorTipo (Confirmado):** Colores fijos por defecto: evento=verde `#10b981`, mantenimiento=naranja `#f59e0b`, remodelación=rojo `#ef4444`, otro=gris `#6b7280`. Configurables por plaza.
  - **Tareas dependientes afectadas (⚠️ Revisar antes de implementar):**
    - **T-043 (en `03-plazas-multitenant.md`):** ⚠️ Cambiar el default de TZ a `America/El_Salvador`. Eliminar el dropdown de TZ (es fijo). Validar que no se envíe `timezone` desde la API; el backend lo asigna siempre.
    - **T-044 (en `03-plazas-multitenant.md`):** Quitar el campo TZ de la pantalla de configuración.
    - **T-145 (en `11-reportes-panel.md`):** Quitar el tab "General" → TZ. Mantener solo nombre comercial, email, teléfono.
    - **T-006 (en `01-setup-base.md`):** Cambiar el default del seed a `America/El_Salvador`.
    - **T-009 (en `01-setup-base.md`):** Cambiar `TZ` en `.env.example` a `America/El_Salvador` o eliminar la variable.
    - **T-045 (en `03-plazas-multitenant.md`):** Cambiar el default de `plaza_demo.timezone` a `America/El_Salvador`.
    - **T-042 (en `03-plazas-multitenant.md`):** ⚠️ Ajustar permisos: tanto `admin_plaza` como `superadmin` pueden actualizar branding.
  - **Criterios de aceptación modificados:**
    - [x] Original: "Confirmada la lista de TZ soportadas o si se permite cualquier IANA" — **MODIFICADO a TZ fija `America/El_Salvador`**.

### T-V09 — Validar despliegue y CI
- **Descripción:** Confirmar el proveedor de hosting (no incluido en cotización), la topología de despliegue, y la estrategia de CI/CD (GitHub Actions propuesto).
- **SUPUESTOS:** S-Deploy, S-CI.
- **Origen:** `README.md` §6 y §7 (paso 3) · `docs/07-arquitectura.md` §4.9 y §4.10.
- **Criterios de aceptación:**
  - [ ] Confirmado el proveedor de hosting — **PENDIENTE, ver T-V15**.
  - [x] Confirmada la topología: ver decisiones de T-V01, T-V08.
  - [x] Confirmado el pipeline de CI: lint + build + verificación manual (sin tests automatizados en v1).
  - [x] Confirmado el pipeline de deploy a staging y producción.
  - [x] Confirmado el secreto compartido `JWT_SECRET` entre FE y BE (HS256).
  - [x] Confirmado el dominio base y el patrón de subdominios para producción — **ver bitácora**.
- **Tareas dependientes potencialmente afectadas:** T-006, T-007, T-008, T-009, T-010, T-011 (en `01-setup-base.md`); T-153, T-157, T-158, T-159, T-160 (en `13-observabilidad-despliegue.md`).
- **Prioridad:** Alta.
- **Estado:** Completada (con pendiente en T-V15).
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **Hosting (PENDIENTE):** El cliente aún no ha decidido el proveedor de hosting. Esto se aborda en **T-V15** (Proveedor hosting + SMTP). Por ahora, se asume genérico (compatible con AWS, DigitalOcean, Vercel, etc.).
    - **S-CI (Confirmado):** GitHub Actions. Pipeline: lint + build en cada PR; deploy a staging en merge a `develop`; deploy a producción con aprobación manual en tag `v*`.
    - **Secretos (Confirmado):** GitHub Secrets para el pipeline + `.env` cifrado en disco en el host para el runtime. NO se usa Vault ni AWS Secrets Manager en v1 (simplicidad).
    - **Estrategia de subdominios (Confirmado):** **Single subdomain `app.plazapp.com` (no wildcard)**. Esto confirma la decisión de T-V01 (no hay subdominios per-plaza). Sin DNS wildcard, sin TLS wildcard.
    - **JWT_SECRET (Confirmado):** Compartido entre FE (`AUTH_SECRET`) y BE (`JWT_SECRET`) con HS256. Generado con `openssl rand -base64 64`.
  - **Tareas dependientes afectadas (⚠️ Revisar antes de implementar):**
    - **T-157 (en `13-observabilidad-despliegue.md`):** ⚠️ Caddyfile se configura para `app.plazapp.com` (no wildcard). Sin DNS wildcard.
    - **T-159 (en `13-observabilidad-despliegue.md`):** Quitar del runbook la mención de wildcard cert. Solo cert estándar.
    - **T-009 (en `01-setup-base.md`):** Añadir `APP_BASE_URL=https://app.plazapp.com` por defecto en `.env.example`.
  - **Criterios de aceptación modificados:**
    - [x] Original sobre DNS wildcard/TLS wildcard — **N/A por T-V01**.

### T-V10 — Validar observabilidad
- **Descripción:** Confirmar el stack de observabilidad: logs estructurados `pino`, métricas Prometheus + Grafana, y Sentry para errores. Confirmar también los SLOs mínimos y los dashboards requeridos.
- **SUPUESTOS:** S-Obs.
- **Origen:** `docs/07-arquitectura.md` §4.8.
- **Criterios de aceptación:**
  - [x] Confirmado `pino` para logs estructurados.
  - [x] Confirmada la instrumentación Prometheus en NestJS.
  - [x] Confirmada la integración con Sentry (DSN, entornos, PII redactado).
  - [x] Confirmadas las métricas mínimas (HTTP + negocio).
  - [x] Confirmado el `requestId` propagado de Next.js a NestJS vía header.
- **Tareas dependientes potencialmente afectadas:** T-013 (en `01-setup-base.md`); T-153, T-155, T-156 (en `13-observabilidad-despliegue.md`).
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **S-Obs (Confirmado):** Stack completo: `pino` (logs JSON) + Prometheus (métricas) + Grafana (dashboards) + Sentry (errores).
    - **Logs (Confirmado):** A stdout en formato JSON. El agregador externo (CloudWatch, Loki, Datadog, lo que el cliente decida) los recoge. NO se escriben a disco en producción.
    - **Métricas (Confirmado):**
      - HTTP: `http_requests_total{method, route, status}`, `http_request_duration_seconds{method, route, status}`, `http_requests_in_progress`.
      - Negocio: `solicitudes_por_estado{estado, plaza_id}`, `email_log_pendientes{plaza_id}`, `lock_activos{plaza_id}` (este último puede ser N/A por T-V03 que eliminó el lock).
      - Cron: `cron_execution_duration_seconds{name}`.
    - **Sentry (Confirmado):** DSN en variable de entorno. PII redactado con `beforeSend` (passwords, tokens, cookies). Captura errores 5xx y excepciones no manejadas. Frontend y backend.
    - **requestId (Confirmado):** Header `x-request-id` propagado de Next.js a NestJS. Si no viene, se genera UUID v4.
  - **Tareas dependientes afectadas:** Ninguna desviación. Las tareas T-013, T-153, T-155, T-156 se mantienen tal cual.
  - **Nota:** T-155 (métricas) menciona `lock_activos{plaza_id}`. Por la decisión de T-V03 (sin lock), esta métrica específica deja de tener sentido. Mantener la métrica igual (siempre en 0) o quitarla — **decisión de implementación, no afecta el plan**.
  - **Criterios de aceptación:** Todos cumplidos sin modificaciones.

### T-V11 — Validar performance y arquitectura de BD
- **Descripción:** Confirmar las decisiones de rendimiento: particionamiento mensual de tablas de alto volumen (`solicitud`, `solicitud_historial`, `email_log`, `auditoria`), read replicas para reportes pesados, PgBouncer como pool, y Redis para cache de catálogos (`rol`, `plaza`, `configuracion`) con TTL 5 min.
- **SUPUESTOS:** S-Particionamiento, S-Replicas, S-Redis, S-EstrategiaMT.
- **Origen:** `docs/04-modelo-de-datos.md` §1.4, §1.5 · `docs/07-arquitectura.md` §4.1.
- **Criterios de aceptación:**
  - [x] Confirmado el particionamiento mensual — **ver bitácora, REVISADO a NO en v1**.
  - [x] Confirmada la retención online — **ver bitácora**.
  - [x] Confirmadas las read replicas — **ver bitácora, REVISADO a NO en v1**.
  - [x] Confirmado PgBouncer como pool en producción.
  - [x] Confirmado Redis para cache — **ver bitácora, REVISADO a NO en v1**.
- **Tareas dependientes potencialmente afectadas:** T-010, T-011 (en `01-setup-base.md`); T-135, T-138, T-141, T-142 (en `11-reportes-panel.md`); T-153, T-155, T-157 (en `13-observabilidad-despliegue.md`).
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **S-Particionamiento (REVISADO — DESVIACIÓN):** **Sin particionamiento en v1**. Tablas únicas, sin RANGE partitioning. Se puede agregar en v1.1 si el volumen lo justifica.
    - **S-Replicas (REVISADO — DESVIACIÓN):** **Sin read replicas en v1**. Una sola instancia de PostgreSQL. Las queries de reporte se ejecutan en la primaria. Se puede agregar en v1.1.
    - **S-Redis (REVISADO — DESVIACIÓN):** **Sin Redis en v1**. No hay cache distribuido. Cada request pega a BD. Los catálogos pequeños (`rol`, `plaza`, `configuracion`) se pueden cachear **en memoria** dentro del proceso Node si se quiere optimizar, pero NO se requiere. Decisión de implementación.
    - **PgBouncer (Confirmado):** En producción se usa PgBouncer como pool de conexiones (modo transaction). Reduce la carga en PostgreSQL. En dev, conexión directa de Prisma (sin PgBouncer).
  - **Tareas dependientes afectadas (⚠️ Revisar antes de implementar):**
    - **T-006 (en `01-setup-base.md`):** ⚠️ Quitar Redis del `docker-compose.yml`. Solo postgres, minio, mailhog, jsreport.
    - **T-009 (en `01-setup-base.md`):** Quitar `REDIS_URL` del `.env.example`.
    - **T-010 (en `01-setup-base.md`):** Sin cambios en Prisma (no afecta al ORM).
    - **T-135, T-141, T-142 (en `11-reportes-panel.md`):** Las queries de reporte se ejecutan en la primaria. Sin separación read/write. Aceptable en v1 con volumen bajo/medio.
    - **T-157 (en `13-observabilidad-despliegue.md`):** `docker-compose.prod.yml` NO incluye Redis.
    - **T-155 (en `13-observabilidad-despliegue.md`):** Métricas de cache hit/miss no aplican (no hay cache).
  - **Criterios de aceptación modificados:**
    - [x] Original sobre particionamiento, replicas y Redis — **MODIFICADOS a NO en v1**.

### T-V12 — Validar estrategia de reportes
- **Descripción:** Confirmar que jsreport 4.13 corre como contenedor Docker separado y que el backend hace de proxy HTTP (BFF) sin instalar librerías de generación de PDF/Excel. Confirmar que los inquilinos no ven reportes en v1 y que los reportes programados están fuera del alcance v1.
- **SUPUESTOS:** S-JSReport, S-RE-A, S-RE-B, S-ScheduledReports.
- **Origen:** `docs/02-stack-tecnologico.md` §2.12 · `docs/03-modulos-del-sistema.md` §3.11.
- **Criterios de aceptación:**
  - [x] Confirmado jsreport 4.13 como contenedor Docker separado (puerto 5488).
  - [x] Confirmado que el backend NO instala `@jsreport/nodejs-client`, `exceljs`, `pdfkit`, `puppeteer`.
  - [x] Confirmado que las plantillas se sirven desde `backend/src/modules/reportes/templates/`.
  - [x] Confirmado el rango máximo de 12 meses para vista rápida — **N/A, ver bitácora**.
  - [x] Confirmado que reportes > 10,000 filas se generan asíncronos — **NO en v1, ver bitácora**.
  - [x] Confirmado que inquilinos NO ven reportes en v1.
  - [x] Confirmado que `reporte_programado` queda documentado pero sin uso en v1.
- **Tareas dependientes potencialmente afectadas:** T-135, T-136, T-137, T-138, T-139, T-140, T-141, T-142, T-143, T-144, T-145 (en `11-reportes-panel.md`).
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **S-JSReport (Confirmado):** jsreport 4.13 como contenedor Docker separado (puerto 5488). Backend hace de proxy HTTP (BFF) sin instalar librerías de generación. Plantillas en `backend/src/modules/reportes/templates/`.
    - **S-RE-A (Confirmado):** Inquilinos NO ven reportes en v1. Solo `admin_plaza` y `superadmin`.
    - **S-RE-B (Confirmado):** `reporte_programado` queda documentado pero sin uso en v1. La tabla existe por completitud.
    - **S-AsyncReport (REVISADO — DESVIACIÓN del SUPUESTO original):** **Sin límite de 10,000 filas y sin lógica asíncrona**. Los reportes se generan siempre síncronos, sin importar el tamaño. Aceptable en v1 porque el volumen esperado es bajo. Si crece, se puede agregar lógica asíncrona en v1.1.
  - **Tareas dependientes afectadas (⚠️ Revisar antes de implementar):**
    - **T-138 (en `11-reportes-panel.md`):** ⚠️ Quitar la validación de "rango máximo 12 meses" (T-V12 decidió sin límite). El reporte acepta cualquier rango de fechas.
    - **T-139 (en `11-reportes-panel.md`):** ⚠️ Quitar la lógica asíncrona de > 10,000 filas. Siempre síncrono.
    - **T-140 (en `11-reportes-panel.md`):** ⚠️ Igual que T-139.
  - **Criterios de aceptación modificados:**
    - [x] Original sobre rango máximo 12 meses y reportes asíncronos > 10k — **MODIFICADOS a SIN LÍMITE en v1**.

### T-V13 — Validar autenticación y políticas de seguridad
- **Descripción:** Confirmar las políticas de autenticación: contraseña 10+ chars con mayúscula/minúscula/dígito/símbolo, bcrypt cost 12, lockout tras 5 intentos en 15 min, token de reset 30 min, JWT access 15 min + refresh 7 días, sin OAuth, sin verificación de email, sin 2FA. Confirmar también el rate limit (100 req/min global, 5 req/min login) y la política de CORS.
- **SUPUESTOS:** S-PwdPolicy, S-Lockout, S-Reset, S-AU-A, S-AU-B, S-AU-C, S-RateLimit, S-CORS.
- **Origen:** `docs/02-stack-tecnologico.md` §2.6 · `docs/03-modulos-del-sistema.md` §3.2 (RN-AU-1 a RN-AU-10) · `docs/06-roles-y-permisos.md` §3.7.
- **Criterios de aceptación:**
  - [x] Confirmada la política de contraseñas — **ver bitácora, REVISADO a 8 chars + 3 tipos**.
  - [x] Confirmado el lockout — **ver bitácora, REVISADO a 10/15 min**.
  - [x] Confirmado el TTL del token de reset (30 min) y de un solo uso.
  - [x] Confirmados los TTL de access/refresh token — **ver bitácora, REVISADO a 1h/14d**.
  - [x] Confirmado que no hay OAuth / 2FA / verificación email en v1.
  - [x] Confirmados los valores de rate limit (T-149 mantiene 100 global / 5 login).
  - [x] Confirmada la lista de orígenes permitidos en CORS (T-148: app.plazapp.com, localhost).
- **Tareas dependientes potencialmente afectadas:** T-009, T-014, T-015 (en `01-setup-base.md`); T-017 a T-035 (en `02-autenticacion-usuarios.md`); T-149 (en `12-seguridad-auditoria.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **S-PwdPolicy (REVISADO — DESVIACIÓN del SUPUESTO original):** **Mínimo 8 caracteres con mayúscula, minúscula y dígito** (3 tipos, sin símbolo obligatorio). Regex: `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$`. bcrypt cost 12 (sin cambios).
    - **S-Lockout (REVISADO — DESVIACIÓN del SUPUESTO original):** **Bloqueo tras 10 intentos fallidos en 15 minutos** (en lugar de 5/15). Más permisivo.
    - **S-Reset (Confirmado):** Token de reset de **30 minutos** de expiración, un solo uso.
    - **TTL de tokens (REVISADO — DESVIACIÓN del SUPUESTO original):** **Access token 1 hora, refresh token 14 días** (en lugar de 15 min / 7 días). Más cómodo para el usuario, menos interrupciones de sesión.
    - **S-AU-A, S-AU-B, S-AU-C (Confirmados):** Sin OAuth, sin verificación de email, sin 2FA. Solo email + password + reset.
    - **S-RateLimit (Confirmado):** 100 req/min global, 5 req/min en login (mantener T-149 tal cual).
    - **S-CORS (Confirmado):** Orígenes permitidos: `http://localhost:3000` (dev), `https://app.plazapp.com` (prod).
  - **Tareas dependientes afectadas (⚠️ Revisar antes de implementar):**
    - **T-009 (en `01-setup-base.md`):** ⚠️ Cambiar `JWT_ACCESS_TTL=3600s` (1 hora) y `JWT_REFRESH_TTL=14d` en `.env.example`.
    - **T-022 (en `02-autenticacion-usuarios.md`):** ⚠️ Cambiar el regex de validación de contraseña a `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$` y actualizar el mensaje de error.
    - **T-026 (en `02-autenticacion-usuarios.md`):** ⚠️ Cambiar el threshold de lockout de 5 a 10. Ajustar el mensaje y el tiempo de bloqueo (15 min sin cambios).
    - **T-029 (en `02-autenticacion-usuarios.md`):** Sin cambios (reset 30 min confirmado).
    - **T-027 (en `02-autenticacion-usuarios.md`):** Sin cambios estructurales, pero el refresh token dura más (14 días) — ajustar tests.
  - **Criterios de aceptación modificados:**
    - [x] Original: "contraseña 10+ chars con 4 tipos" — **MODIFICADO a 8 chars + 3 tipos**.
    - [x] Original: "lockout 5/15 min" — **MODIFICADO a 10/15 min**.
    - [x] Original: "access 15 min + refresh 7 días" — **MODIFICADO a 1h + 14 días**.

### T-V14 — Validar notificaciones por email
- **Descripción:** Confirmar las 8 plantillas de email por evento, el manejo de hard bounce (marca `usuario.email_invalido = true`), el link de desuscripción en emails no críticos, el SMTP externo (no auto-hospedado), y que el editor WYSIWYG no está disponible en v1.
- **SUPUESTOS:** S-Bounce, S-Unsubscribe, S-NE-C, S-NE-A, S-NE-B.
- **Origen:** `docs/02-stack-tecnologico.md` §2.8 (Nodemailer) · `docs/03-modulos-del-sistema.md` §3.8 (RN-NE-1 a RN-NE-6) · `docs/05-flujo-de-solicitudes.md` §2.3.
- **Criterios de aceptación:**
  - [x] Confirmado el proveedor SMTP transaccional (cliente aporta credenciales — ver T-V15).
  - [x] Confirmadas las 9 plantillas de email (solicitud-asignada-responsable, solicitud-nueva-supervisor, solicitud-recibida, solicitud-aprobada, solicitud-rechazada, solicitud-subsanacion, solicitud-reasignada, reset-password, bienvenida, contrato-por-vencer).
  - [x] Confirmado el manejo de hard bounce → `email_invalido = true`.
  - [x] Confirmado que el link de unsubscribe está solo en emails no críticos (no en reset, aprobación, rechazo, subsanacion).
  - [x] Confirmado que los emails críticos no se desactivan.
  - [x] Confirmado que el admin no edita plantillas en v1 (hard-coded en backend).
- **Tareas dependientes potencialmente afectadas:** T-118 a T-127 (en `09-notificaciones-email.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **S-NE-C (Confirmado):** SMTP externo (cliente aporta credenciales). El proveedor concreto (SendGrid, SES, Mailgun, etc.) se confirma en **T-V15**.
    - **S-Bounce (Confirmado):** Hard bounce (códigos SMTP 550, 551, 553) marca `usuario.email_invalido = true`. Emails no críticos NO se envían a emails inválidos. Emails críticos (reset, aprobada, rechazada, subsanacion) SÍ se envían aunque `email_invalido = true`.
    - **S-Unsubscribe (Confirmado):** Link de unsubscribe en emails no críticos (solicitud-asignada-responsable, solicitud-nueva-supervisor, solicitud-recibida, contrato-por-vencer). NO en críticos (reset-password, solicitud-aprobada, solicitud-rechazada, solicitud-subsanacion).
    - **S-NE-A, S-NE-B (Confirmados):** Las 9 plantillas están hard-coded en `backend/src/modules/notificaciones/templates/`. Renderizadas con Handlebars. Sin editor WYSIWYG en el panel admin.
  - **Tareas dependientes afectadas:** Ninguna desviación. Las tareas T-118 a T-127 se mantienen tal cual.
  - **Criterios de aceptación:** Todos cumplidos sin modificaciones.

### T-V15 — Confirmar proveedor de hosting y SMTP de producción
- **Descripción:** Confirmación comercial final con el cliente: proveedor de hosting definitivo, topología de despliegue, proveedor de SMTP transaccional para producción, y credenciales/secrets de acceso. Esta tarea no es estrictamente un SUPUESTO sino un entregable comercial requerido para poder salir a producción.
- **Origen:** `README.md` §7 (paso 3) · `docs/02-stack-tecnologico.md` §2.10 y §2.8.
- **Criterios de aceptación:**
  - [x] Proveedor de hosting contratado y credenciales recibidas — **PENDIENTE, ver bitácora**.
  - [x] Dominio base configurado y certificados TLS listos — **PENDIENTE, ver bitácora**.
  - [x] Proveedor SMTP contratado y credenciales recibidas — **PENDIENTE, ver bitácora**.
  - [x] DSN de Sentry creado (confirmado en T-V10).
  - [x] Acceso al repositorio de GitHub configurado para CI/CD.
- **Tareas dependientes potencialmente afectadas:** T-009, T-010, T-011 (en `01-setup-base.md`); T-119, T-158, T-159 (en `09-notificaciones-email.md` y `13-observabilidad-despliegue.md`).
- **Prioridad:** Alta.
- **Estado:** Completada (con pendientes comerciales documentados).
- **Bitácora de cambios:**
  - **Decisión final (2026-06-05, sesión actual):**
    - **Hosting (PENDIENTE — decisión comercial):** El cliente aún no ha decidido el proveedor de hosting. Esto **no bloquea** el desarrollo local ni el deploy a staging (que puede usar cualquier proveedor genérico o un VPS temporal). Se debe resolver antes del go-live a producción.
    - **SMTP (PENDIENTE — decisión comercial):** El cliente aún no ha decidido el proveedor de SMTP transaccional (SendGrid, SES, Mailgun, etc.). En dev se sigue usando MailHog (incluido en `docker-compose.yml`). Se debe resolver antes del go-live a producción.
    - **Dominio (PENDIENTE — decisión comercial):** El dominio (e.g. `plazapp.com` u otro) aún no está adquirido. Para staging se puede usar un dominio temporal o un subdominio de un proveedor de PaaS (e.g. `onrender.com`, `vercel.app`).
    - **Repositorio (Confirmado):** El repositorio está en GitHub con acceso para CI/CD. GitHub Actions listo para ejecutar lint + build en cada PR. Falta configurar los Secrets de GitHub (SMTP credentials, etc.) cuando se tengan.
  - **Tareas dependientes afectadas:** Ninguna tarea técnica cambia. Las tareas de deploy (T-157, T-158, T-159) se mantienen genéricas y compatibles con cualquier proveedor.
  - **Criterios de aceptación modificados:** Los criterios pendientes se marcan como PENDIENTE (decisión comercial). No bloquean T-001.
  - **Próximos pasos para el cliente:** Una vez tenga el primer cliente firmado, contratar hosting + SMTP + dominio. Mientras tanto, el equipo técnico puede desarrollar contra el stack local con MailHog.

### T-V22 — Bloque transversal de empresa ejecutante + modo emergencia
- **Descripción:** Cambia el modelo de `solicitud` para añadir 7 columnas nuevas (transversales a los 4 tipos): datos de la empresa ejecutante (nombre, responsable, teléfono, email), contacto de emergencia (persona y teléfono) y un flag `es_emergencia` que activa reglas dinámicas de fechas y limita a 3 permisos de emergencia por mes por inquilino. Adicionalmente, las fechas del permiso pasan a ser obligatorias para todos los tipos (antes opcionales y restringidas a `evento`), y el rango de `asistentes_estimados` se amplía de 0-10 a 1-20.
- **SUPUESTOS nuevos:** **S-SO-Emergencia** (reglas del modo emergencia), **S-SO-DatosEmpresa** (bloque transversal obligatorio), **S-SO-FechasObligatorias** (fechas requeridas para todo tipo).
- **SUPUESTOS revisados/desviaciones:**
  - **S-CamposTipo (DESVIACIÓN):** `asistentes_estimados` ahora es obligatorio con rango 1-20 para los 4 tipos. Antes era opcional en `mantenimiento/remodelacion/otro` con tope 10.
  - **T-079 (DESVIACIÓN):** `fecha_evento_inicio/fin` y `hora_inicio/fin` pasan de opcionales a obligatorios. Antes solo eran obligatorios para `evento`.
  - **T-V05 (DESVIACIÓN parcial):** `evento` mantiene el umbral de aprobación especial pero el rango cambia a 1-20 (antes 1-10_000).
- **Origen:** Sesión 2026-06-23 con el cliente.
- **Criterios de aceptación:**
  - [x] Migración `20260623000001_solicitud_datos_empresa_emergencia` aplica sin errores sobre la BD local.
  - [x] `CreateSolicitudSchema` rechaza payload sin los 7 nuevos campos o con `asistentes_estimados < 1 || > 20`.
  - [x] `SolicitudesService.create()` rechaza con 422 `PERMISO_EMERGENCIA_LIMITE` si ya hay 3 emergencias del inquilino en el mes actual.
  - [x] `SolicitudesService.update()` re-valida el límite solo si la transición activa el flag (no si ya estaba activo).
  - [x] `SolicitudesService.duplicar()` resetea `es_emergencia=false` y las fechas (pero copia el bloque empresa).
  - [x] Frontend: paso 2 muestra fechas siempre con `min`/`max` dinámicos según modo estándar/emergencia.
  - [x] Frontend: toggle "Emergencia" dispara SweetAlert con texto literal "Solamente tiene un máximo de 3 permisos de emergencia al mes." antes de activar.
  - [x] Frontend: labels renombrados ("Cantidad de Personal", "Información del personal").
  - [x] Frontend: paso 3 muestra TODA la información (identificación, empresa, emergencia, fechas, personal, campos extra específicos).
- **Tareas dependientes potencialmente afectadas:**
  - **T-080 (en `06-solicitudes.md`):** ⚠️ Revisar — el `data` de `tx.solicitud.create()` cambia para incluir 7 columnas más.
  - **T-079 (en `06-solicitudes.md`):** ⚠️ Revisar — los schemas Zod per-tipo se modificaron; `AsistentesBloqueSchema` y `CamposExtraEventoSchema` ya validan 1-20.
  - **T-088 (en `06-solicitudes.md`):** ⚠️ Revisar — el wizard del inquilino (`SolicitudWizard`) se reorganizó: fechas siempre visibles, nuevo bloque empresa, modal de emergencia, paso 3 ampliado.
  - **docs/04-modelo-de-datos.md §4.3.7 (Solicitud):** ⚠️ Actualizar la tabla con las 7 columnas nuevas.
  - **docs/05-flujo-de-solicitudes.md:** ⚠️ Actualizar para incluir las reglas de fecha dinámicas (48h lead estándar, 0h lead emergencia, 7 días tope).
  - **docs/03-modulos-del-sistema.md §3 (RN-SO-*):** ⚠️ Añadir RN-SO-Fechas (obligatorias + lead time) y RN-SO-Emergencia (3/mes).
- **Prioridad:** Alta.
- **Estado:** Implementada (2026-06-23). Pendiente validación manual con backend levantado.
- **Bitácora de cambios:**
  - **Decisiones técnicas (2026-06-23):**
    - **Columnas NOT NULL con defaults vacíos** (`''` para strings, `false` para `es_emergencia`): filas existentes quedan con placeholders; la app las sobreescribe al primer edit. Aceptable para dev/staging; en producción se necesitará una migración en 2 pasos (nullable → backfill → SET NOT NULL).
    - **Índice compuesto `(plaza_id, es_emergencia, created_at)`**: soporta la query `count({ inquilino_id, es_emergencia: true, created_at: { gte: inicioMes } })` dentro del tenant del RLS.
    - **`momentoElaboracion` congelado al montar** el wizard (`useState(() => new Date())`): evita que el "ahora + 48h" se mueva mientras el usuario completa el formulario.
    - **Modal SweetAlert2 (`confirmAction`)** para activar emergencia: respeta la regla del proyecto (`frontend/src/lib/sweetalert.ts`).
    - **`momentoElaboracion` solo se valida al guardar en backend**: el frontend espeja la lógica pero el backend es la fuente de verdad (`CreateSolicitudSchema.superRefine` + `SolicitudesService.assertLimiteEmergencia`).
    - **Reuso de `sanitizePlainText`** para todos los strings nuevos (T-151 SEC-6 XSS).
    - **Bloque transversal empresa es top-level** en `solicitud`, NO en `campos_extra` JSONB. Justificación: aplica a los 4 tipos; los tipos en JSONB son discriminados por `tipo` y este bloque no encaja en esa lógica.
  - **Próximos pasos:**
    - Verificación manual end-to-end con backend levantado (ver plan de implementación).
    - Considerar mover el límite 3/mes a `configuracion.max_emergencias_por_mes` (parametrizable por plaza) si el cliente lo pide.
  - **actualización (2026-08-16):** Nueva ventana de anticipación para `fechaInicio` (decisión del cliente).
    - Estándar: inicio ∈ [ahora+48h, ahora+5d] (antes sin tope superior; un permiso podía agendarse a meses vista).
    - Emergencia: inicio ∈ [ahora, ahora+48h] (antes sin tope; un permiso "de emergencia" podía empezar en 3 días, vaciando el cupo de 3/mes).
    - Duración máxima del permiso (fin ≤ inicio + 7d) sin cambios.
    - Implementado en `frontend/src/lib/solicitud-fechas.ts` (helper `aYMDLocal` para evitar el desfase UTC de `toISOString().slice(0,10)`; nuevas constantes `MAX_LEAD_DAYS=5` y `MAX_LEAD_HOURS_EMERGENCIA=48`; tres funciones `maxFechaInicioEstandar`/`minFechaInicioEmergencia`/`maxFechaInicioEmergencia`; rama extra en `validarRangoFechas`), en `frontend/src/components/client/solicitud-wizard.tsx` (atributos `min`/`max` del input Fecha inicio + textos de ayuda + label del toggle) y en `packages/contracts/src/solicitudes/index.ts` (espejado en el `superRefine` de `CreateSolicitudSchema` con los mismos mensajes).
    - **Tareas dependientes potencialmente afectadas:** `docs/05-flujo-de-solicitudes.md` (§3 RN-SO-Fechas) y `docs/03-modulos-del-sistema.md` (§3 RN-SO-*) deben actualizarse para reflejar la nueva ventana.
    - **Fuera de alcance:** `UpdateSolicitudSchema` sigue siendo `.partial()` sin `superRefine` (brecha preexistente; este cambio no la introduce ni la cierra). Las constantes siguen duplicadas entre `frontend/src/lib/solicitud-fechas.ts` y `packages/contracts` — un módulo compartido queda como sugerencia.

---

## 5. Mapa global de dependencias (resumen)

> Las flechas indican "bloquea a". El orden lógico de implementación es: **validación de SUPUESTOS → setup → BD base → auth → entidades de catálogo → entidades de negocio → solicitudes → aprobaciones → integraciones → reportes → seguridad → despliegue**.

```
[T-V01..T-V15 SUPUESTOS] ─── bloquea todo ───┐
                                              │
[T-001..T-016 setup] ──► [T-010 Prisma] ──► [T-017..T-035 auth/usuarios]
                                              │
                                              ▼
                                [T-036..T-046 plazas + RLS]
                                              │
                                              ▼
                                [T-047..T-062 locales/contratos]
                                              │
                                              ▼
                                [T-063..T-073 categorías/subcategorías]
                                              │
                                              ▼
                                [T-074..T-090 solicitudes]
                                              │
                                              ▼
                                [T-091..T-108 aprobaciones]
                                              │
                                ┌─────────────┼─────────────┐
                                ▼             ▼             ▼
                       [T-109..T-117   [T-118..T-127  [T-128..T-134
                         adjuntos]    notificaciones]  calendario]
                                              │
                                              ▼
                                [T-135..T-145 reportes/panel]
                                              │
                                              ▼
                                [T-146..T-152 seguridad]
                                              │
                                              ▼
                                [T-153..T-160 observabilidad/despliegue]
```

---

## 6. Cómo usar este plan

1. **Antes de empezar a codificar**, completa las 15 tareas de validación (T-V01 a T-V15) con el cliente.
2. **Empieza por T-001** (creación del monorepo). Sigue el orden numérico, respetando las dependencias de cada tarea.
3. **Para tomar una tarea**: lee su descripción y criterios de aceptación. Verifica que todas las tareas listadas en "Dependencias" estén `Completada`.
4. **Al cerrar una tarea**: rellena su bitácora con desviaciones, criterios modificados, decisiones técnicas, y **lista de tareas dependientes afectadas** (con su archivo). Marca esas tareas como `Bloqueada` con referencia a la tarea origen.
5. **Para visión global**: revisa este índice periódicamente. El dashboard de estado muestra el progreso por archivo.
6. **Si un SUPUESTO cambia**: edita la T-Vxx correspondiente con la nueva decisión, documenta en su bitácora, y revisa las tareas dependientes (muchas de ellas ya listas una `⚠️ Revisar` en su campo de bitácora).

---

## 7. Convenciones de la bitácora de cambios

Al pasar una tarea a `Completada`, su bitácora debe incluir:

- **Desviaciones** entre lo planeado y lo implementado (qué se hizo distinto y por qué).
- **Criterios modificados** (qué criterio de aceptación se ajustó durante el desarrollo).
- **Decisiones técnicas** que afecten a otras tareas (nuevas dependencias, cambios de schema, etc.).
- **Tareas dependientes afectadas** (con archivo). Formato: `T-NNN (en archivo.md) — ⚠️ Revisar`.

Si la tarea queda `Bloqueada` por una tarea previa, la entrada de la bitácora debe referenciar el ID que la bloquea.
