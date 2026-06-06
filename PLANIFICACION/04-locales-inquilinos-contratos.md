# Módulo 04 — Locales, Inquilinos y Contratos

> **Propósito:** CRUD de locales (con estados `disponible`/`alquilado`/`en_mantenimiento`/`fuera_de_servicio`), importación CSV de locales, CRUD de inquilinos, CRUD de contratos con trigger anti-solapamiento, alertas de vencimiento T-30 y T-7, contrato indefinido (`fecha_fin` NULL), y todas las pantallas asociadas del admin de plaza e inquilino.
>
> **Pre-requisito:** T-001 a T-046 (setup, auth, plazas) deben estar `Completada`.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-047 | Crear migración Prisma con `local` | Alta | Completada |
| T-048 | Crear migración Prisma con `inquilino` | Alta | Completada |
| T-049 | Crear migración Prisma con `contrato` + CHECK de fechas | Alta | Completada |
| T-050 | Crear trigger PL/pgSQL para anti-solapamiento de contratos vigentes | Alta | Completada |
| T-051 | Implementar CRUD locales (POST/GET/PATCH /api/v1/locales) | Alta | Completada |
| T-052 | Implementar importación CSV de locales | Media | Descartada (T-V07) |
| T-053 | Implementar CRUD inquilinos (POST/GET/PATCH /api/v1/inquilinos) | Alta | Completada |
| T-054 | Implementar CRUD contratos (POST/GET/PATCH /api/v1/contratos) | Alta | Completada |
| T-055 | Implementar cierre/renovación de contrato | Alta | Completada |
| T-056 | Implementar alertas de vencimiento T-30 y T-7 con @nestjs/schedule | Media | Completada |
| T-057 | Implementar pantallas /admin/locales y /admin/locales/[id] | Alta | Completada |
| T-058 | Implementar pantalla /admin/locales/importar | Media | Descartada (T-V07) |
| T-059 | Implementar pantallas /admin/inquilinos y /admin/inquilinos/[id] | Alta | Completada |
| T-060 | Implementar pantallas /admin/contratos y /admin/contratos/[id] | Alta | Completada |
| T-061 | Implementar historial de contratos por local y por inquilino | Media | Completada |
| T-062 | Implementar upload de contrato firmado (PDF) con MinIO | Media | Completada |

---

### T-047 — Crear migración Prisma con `local`

- **Descripción:** Crear el modelo `local`: `id` (UUID), `plaza_id` (FK), `codigo` (UNIQUE por plaza), `nombre`, `metraje_m2` (DECIMAL), `piso`, `sector`, `descripcion`, `estado` (ENUM `disponible`/`alquilado`/`en_mantenimiento`/`fuera_de_servicio`), `created_at`, `updated_at`, `deleted_at`. Materializa RN-LO-1 a RN-LO-6 y S-EstadosLocal.
- **Criterios de aceptación:**
  - [ ] Modelo `local` con todos los campos.
  - [ ] Índice `UNIQUE(plaza_id, codigo)`, `INDEX(plaza_id, estado)`, `INDEX(deleted_at)`.
  - [ ] ENUM `local_estado` definido en `schema.prisma`.
  - [ ] Migración aplicada.
  - [ ] Validación Zod: `codigo` regex `^[A-Z0-9-]{1,16}$`, `metraje_m2 > 0`.
  - [ ] RLS habilitado por T-038.
- **Dependencias:** T-036 (en `03-plazas-multitenant.md`, plaza), T-038.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: Modelo `local` en `schema.prisma` con enum `local_estado` (4 estados, S-EstadosLocal/T-V07) y todos los índices del criterio. Migración `20260606220306_modulo_04_locales_contratos` aplicada (incluye también T-048/T-049/adjunto/email_log).
  - **RLS añadida en la propia migración** (patrón T-038): `GRANT` a `syssol_app` + `ENABLE`+`FORCE ROW LEVEL SECURITY` + policy `USING/WITH CHECK (plaza_id = current_setting('app.plaza_id', true)::uuid)` para `local`, `inquilino`, `contrato`, `adjunto` y `email_log`. Verificado fail-closed (0 filas sin contexto) y aislamiento entre 2 plazas.
  - Validación Zod (`codigo` regex `^[A-Z0-9-]+$` máx 16, `metrajeM2 > 0`) ya existía en `packages/contracts/src/locales` (T-022); se reutilizó sin cambios.

### T-048 — Crear migración Prisma con `inquilino`

- **Descripción:** Crear el modelo `inquilino`: `id` (UUID), `plaza_id` (FK), `razon_social`, `identificacion` (RUC/ID, UNIQUE por plaza si no es NULL), `direccion`, `contacto_nombre`, `contacto_email`, `contacto_telefono`, `created_at`, `updated_at`, `deleted_at`. Materializa CU-LO-10 a CU-LO-13.
- **Criterios de aceptación:**
  - [ ] Modelo `inquilino` con todos los campos.
  - [ ] Índice `INDEX(plaza_id)`, `UNIQUE(plaza_id, identificacion)` (parcial, solo cuando `identificacion` no es NULL).
  - [ ] Migración aplicada.
  - [ ] Validación Zod: `contacto_email` formato email válido.
  - [ ] RLS habilitado.
- **Dependencias:** T-036, T-038.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: Modelo `inquilino` migrado (misma migración que T-047). ⚠️ El UNIQUE parcial `(plaza_id, identificacion) WHERE identificacion IS NOT NULL` no es expresable en Prisma → `CREATE UNIQUE INDEX inquilino_plaza_identificacion_uniq ...` como SQL manual al final de la migración (NO declarar `@@unique` en el schema, generaría un índice no-parcial).
  - Además se añadió la **FK real `usuario.inquilino_id → inquilino.id`** (estaba pendiente desde T-018 como columna sin relación). Prisma ordenó correctamente el `ALTER TABLE usuario` después del `CREATE TABLE inquilino`.

### T-049 — Crear migración Prisma con `contrato` + CHECK de fechas

- **Descripción:** Crear el modelo `contrato`: `id`, `plaza_id` (FK), `local_id` (FK), `inquilino_id` (FK), `fecha_inicio` (DATE NOT NULL), `fecha_fin` (DATE NULLABLE para indefinido), `monto_mensual` (DECIMAL), `moneda` (CHAR(3) default 'USD'), `condiciones` (TEXT), `estado` (ENUM `vigente`/`finalizado`/`cancelado`), `fecha_fin_efectiva` (DATE), `motivo_fin` (TEXT), `created_at`, `updated_at`. Restricción CHECK: `fecha_fin IS NULL OR fecha_fin >= fecha_inicio`. Materializa S-ContratoIndefinido.
- **Criterios de aceptación:**
  - [ ] Modelo `contrato` con todos los campos.
  - [ ] CHECK constraint `fecha_fin IS NULL OR fecha_fin >= fecha_inicio` en la migración.
  - [ ] ENUM `contrato_estado`.
  - [ ] Índices: `INDEX(plaza_id, local_id, estado)`, `INDEX(plaza_id, inquilino_id, estado)`, `INDEX(fecha_fin)` (para alertas).
  - [ ] Migración aplicada.
  - [ ] Validación Zod: `monto_mensual >= 0`, `moneda` ∈ ISO 4217.
  - [ ] RLS habilitado.
- **Dependencias:** T-047, T-048, T-038.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: Modelo `contrato` migrado con enum `contrato_estado`, fechas `@db.Date`, `monto_mensual DECIMAL(12,2)`, `moneda CHAR(3) default 'USD'` y los 3 índices. ⚠️ Prisma 7 no soporta CHECK declarativo → `ALTER TABLE contrato ADD CONSTRAINT contrato_fechas_chk CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)` como SQL manual en la migración. El `refine` de Zod en `CreateContratoSchema` cubre la misma regla en la capa de validación.
  - Zod (`montoMensual >= 0`, `moneda` regex `^[A-Z]{3}$` ISO 4217) ya existía en contracts; sin cambios.

### T-050 — Crear trigger PL/pgSQL para anti-solapamiento de contratos vigentes

- **Descripción:** Crear un trigger `tg_contrato_no_overlap` que rechace cualquier INSERT o UPDATE que cree un `contrato.vigente` solapado (en fechas) para el mismo `local_id`. El solapamiento se considera cuando `[fecha_inicio, fecha_fin)` (con `fecha_fin` NULL = +infinito) intersecta con otro contrato vigente del mismo local. Materializa RN-CO-3 y la regla de integridad de `docs/04` §1.1.
- **Criterios de aceptación:**
  - [ ] Migración `00X_contrato_no_overlap_trigger/migration.sql` con el trigger.
  - [ ] Trigger BEFORE INSERT OR UPDATE que verifica con `EXISTS` si hay solapamiento.
  - [ ] Lanza excepción con código `CONTRATO_OVERLAP` si hay solapamiento.
  - [ ] Test: contrato A del 1-ene al 31-dic, intentar crear B del 1-jul al 31-dic → `CONTRATO_OVERLAP`.
  - [ ] Test: contrato A con `fecha_fin = NULL`, intentar crear B desde 1-ene → `CONTRATO_OVERLAP`.
  - [ ] Test: contrato A finalizado el 1-ene, crear B del 1-feb al 31-dic → OK.
  - [ ] El trigger maneja correctamente el caso de UPDATE del propio registro (no se auto-bloquea).
- **Dependencias:** T-049.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: Migración `20260606220340_contrato_no_overlap_trigger` con `fn_contrato_no_overlap()` + trigger BEFORE INSERT OR UPDATE. Implementado con `daterange(fecha_inicio, fecha_fin, '[)') && daterange(...)` — `fecha_fin NULL` = +infinito (cubre S-ContratoIndefinido) — en lugar del `EXISTS` con comparaciones manuales del enunciado (mismo resultado, menos casos borde). Solo valida cuando `NEW.estado = 'vigente'` y excluye `c.id <> NEW.id` (no se auto-bloquea en UPDATE).
  - El `RAISE EXCEPTION` empieza con `CONTRATO_OVERLAP` y el backend lo mapea por substring del `message` (llega como `PrismaClientUnknownRequestError` vía `@prisma/adapter-pg`) → `409` RFC 7807 con código `CONTRATO_OVERLAP`.
  - **Guard de fechas invertidas:** si `fecha_fin < fecha_inicio` el trigger deja pasar la fila para que el CHECK `contrato_fechas_chk` la rechace con su propio error (sin él, `daterange()` lanzaba un error confuso de bounds). `actualización:` este guard se añadió tras la primera verificación; la función se re-aplicó con `CREATE OR REPLACE` y se sincronizó el checksum de la migración (BD dev, migración aún no compartida).
  - **Verificado en psql:** A ene–dic vs B jul–dic → `CONTRATO_OVERLAP`; A indefinido vs B futuro → `CONTRATO_OVERLAP`; A finalizado + B posterior → OK; UPDATE del propio registro → OK; fechas invertidas → CHECK violation limpia.

### T-051 — Implementar CRUD locales (POST/GET/PATCH /api/v1/locales)

- **Descripción:** Implementar el CRUD de locales con `@Roles('admin_plaza', 'superadmin')`. El cambio de estado está restringido: `alquilado` solo se setea automáticamente cuando hay contrato vigente (T-054); `disponible` no se puede si hay contrato vigente. `inquilino` solo ve los locales con contrato vigente que le pertenecen (filtrado en el query). Materializa S-LO-B.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/locales` con `@Roles('admin_plaza', 'superadmin')`. Crea local con `estado: 'disponible'` por defecto.
  - [ ] `GET /api/v1/locales` con paginación y filtros `?estado=&piso=&sector=`. `inquilino` solo ve los suyos.
  - [ ] `GET /api/v1/locales/:id` con detalle + contrato vigente + histórico de contratos.
  - [ ] `PATCH /api/v1/locales/:id` solo permite cambiar `nombre`, `metraje_m2`, `piso`, `sector`, `descripcion`, y `estado` (con reglas).
  - [ ] `DELETE /api/v1/locales/:id` con `@Roles('admin_plaza', 'superadmin')` hace soft delete. Si tiene contrato vigente → `409 LOCAL_HAS_ACTIVE_CONTRACT`.
  - [ ] Cambio de estado: si se intenta `estado: 'disponible'` y hay contrato vigente → `400 INVALID_STATE_TRANSITION`.
  - [ ] Si se aprueba una solicitud de tipo `remodelacion` (T-103 en `07-aprobaciones.md`), el estado cambia a `en_mantenimiento` durante el rango de fechas.
  - [ ] RLS probado con dos plazas.
  - [ ] Errores con códigos de dominio RFC 7807 (`LOCAL_HAS_ACTIVE_CONTRACT`, `INVALID_STATE_TRANSITION`, `LOCAL_NOT_FOUND`).
- **Dependencias:** T-047, T-022 (en `02-autenticacion-usuarios.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `LocalesService`/`LocalesController` implementados sobre los stubs (patrón de `plazas`): triple guard + `withTenant(actor.plazaId)` en todas las queries (`plaza_id` SIEMPRE del JWT). `POST` crea con `estado: 'disponible'`; código duplicado (P2002 del `@@unique`) → `409 LOCAL_CODIGO_DUPLICADO`.
  - Rol `inquilino` en `GET /locales`: filtro `contratos.some({ inquilino_id: actor.inquilinoId, estado: 'vigente' })` (S-LO-B); en `GET /:id` → 404 si el local no es suyo.
  - Reglas de estado (RI-2): `estado:'disponible'` con contrato vigente → `400 INVALID_STATE_TRANSITION`; además `estado:'alquilado'` manual también se rechaza (solo lo setea T-054). `DELETE` con vigente → `409 LOCAL_HAS_ACTIVE_CONTRACT` (soft delete si no).
  - El criterio de `remodelacion`→`en_mantenimiento` queda para **T-103** (módulo 07), como indica el propio criterio.
  - ⚠️ `Decimal` de Prisma se convierte a `number` en los outputs (`metraje_m2`).
  - **Verificado funcionalmente con 2 plazas:** plaza B no ve ni accede a locales de A (lista vacía y 404); códigos de dominio confirmados con curl.

### T-052 — Implementar importación CSV de locales

- **Descripción:** Implementar un endpoint que reciba un CSV y cree múltiples locales en una sola transacción. Reporta errores por fila (no aborta toda la importación). Materializa S-CSV.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/locales/import-csv` con multipart/form-data (file).
  - [ ] Formato CSV esperado: `codigo,nombre,metraje_m2,piso,sector,descripcion` con separador `,` y UTF-8 con BOM opcional.
  - [ ] Validación por fila: schema Zod. Errores se acumulan y se retornan en el response.
  - [ ] Si una fila tiene `codigo` duplicado dentro del CSV o con un local existente → se reporta por fila, no aborta.
  - [ ] Si NO hay errores: crea todos los locales en una transacción. Retorna `{ created: N, failed: [] }`.
  - [ ] Si TODAS las filas fallan: retorna `400 CSV_INVALID` con el detalle.
  - [ ] Si algunas fallan: retorna `207 Multi-Status` con `{ created: [...], failed: [{row: 5, errors: [...]}] }`.
  - [ ] Auditoría: registra la importación con `cantidad_creados`, `cantidad_fallidos` en `auditoria`.
- **Dependencias:** T-051.
- **Prioridad:** Media.
- **Estado:** Descartada.
- **Bitácora de cambios:**
  - 2026-06-06: ⚠️ **Descartada por decisión vinculante T-V07** (2026-06-05): «SIN importador CSV en v1; el alta de locales es uno por uno desde el panel admin». Confirmado con el owner antes de iniciar el módulo. CSV puede reconsiderarse en v1.1. No se instala `papaparse`.

### T-053 — Implementar CRUD inquilinos (POST/GET/PATCH /api/v1/inquilinos)

- **Descripción:** Implementar el CRUD de inquilinos con `@Roles('admin_plaza', 'superadmin')` para escritura. `inquilino` solo ve su propio registro. La baja lógica solo permitida si no tiene contratos vigentes.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/inquilinos` con `@Roles('admin_plaza', 'superadmin')`.
  - [ ] `GET /api/v1/inquilinos` paginado y con filtros `?razonSocial=&identificacion=`. `inquilino` ve solo el suyo.
  - [ ] `GET /api/v1/inquilinos/:id` con detalle + contratos activos + histórico.
  - [ ] `PATCH /api/v1/inquilinos/:id` solo permite cambiar contacto y dirección (no `razon_social` ni `identificacion` una vez creado, decisión de UX).
  - [ ] `DELETE /api/v1/inquilinos/:id` con `@Roles('admin_plaza', 'superadmin')` hace soft delete. Si tiene contrato vigente → `409 INQUILINO_HAS_ACTIVE_CONTRACT`.
  - [ ] Opcional: alta rápida de inquilino + usuario asociado desde el panel admin (CU-PA-6).
  - [ ] RLS probado.
- **Dependencias:** T-048, T-022.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: Módulo `inquilinos` creado desde cero (no había stub) y registrado en `app.module.ts`. CRUD completo con `withTenant`; `PATCH` solo contacto/dirección (razón social e identificación inmutables, decisión de UX del enunciado); `DELETE` con contrato vigente → `409 INQUILINO_HAS_ACTIVE_CONTRACT`.
  - Violación del UNIQUE parcial → `409 INQUILINO_IDENTIFICACION_DUPLICADA` (match por P2002 o por nombre del índice en el mensaje, ya que el índice manual no está en el schema de Prisma).
  - Se añadió `ListInquilinosQuerySchema` (filtros `razonSocial`, `identificacion`) a `packages/contracts/src/locales` (no existía).
  - El opcional «alta rápida de inquilino + usuario» se implementó en **T-059** (vía `POST /usuarios` mínimo).
  - **Verificado:** identificación duplicada → 409; inquilino solo ve su propio registro; RLS probado con 2 plazas.

### T-054 — Implementar CRUD contratos (POST/GET/PATCH /api/v1/contratos)

- **Descripción:** Implementar el CRUD de contratos. La creación dispara el trigger anti-solapamiento (T-050). El cambio de estado se valida: `vigente → finalizado` (con `fecha_fin_efectiva`), `vigente → cancelado` (con `motivo_fin`). Al crear un contrato `vigente`, el `local.estado` cambia automáticamente a `alquilado`. Al finalizar, vuelve a `disponible` (si no hay otros vigentes). Materializa RN-CO-1 a RN-CO-5.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/contratos` con `@Roles('admin_plaza', 'superadmin')`. Body: `{ localId, inquilinoId, fechaInicio, fechaFin?, montoMensual, moneda, condiciones? }`.
  - [ ] Estado inicial siempre `vigente`. Validación CHECK de fechas. Trigger anti-solapamiento.
  - [ ] Si OK: crea contrato y actualiza `local.estado = 'alquilado'`. Todo en una transacción.
  - [ ] `GET /api/v1/contratos` paginado y con filtros `?localId=&inquilinoId=&estado=`. `inquilino` ve solo los suyos.
  - [ ] `GET /api/v1/contratos/:id` con detalle + adjuntos + alertas de vencimiento.
  - [ ] `PATCH /api/v1/contratos/:id` permite cambiar condiciones y monto_mensual, NO fechas ni local ni inquilino (decisión de UX, para esos casos se cierra y se crea uno nuevo).
  - [ ] Cambio de local: no se permite; hay que cerrar y abrir uno nuevo.
  - [ ] RLS probado.
- **Dependencias:** T-049, T-050, T-051, T-053.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `ContratosService`/`ContratosController` implementados. `POST` valida local+inquilino de la plaza dentro de la transacción `withTenant`, crea `vigente` (trigger T-050 → catch → `409 CONTRATO_OVERLAP`) y actualiza `local.estado='alquilado'` **en la misma transacción**.
  - `GET /:id` incluye adjuntos (vía endpoints de T-062) y flags `enVentanaT30`/`enVentanaT7` calculados contra la fecha actual; el listado (`ContratoListItem`) incluye `localCodigo` e `inquilinoRazonSocial` para las tablas del frontend.
  - Rol `inquilino`: `GET /contratos` fuerza `inquilino_id = actor.inquilinoId` ignorando cualquier `inquilinoId` del query (nunca confiar en input del cliente); `GET /:id` → 404 si no es suyo.
  - `PATCH` solo `montoMensual`/`condiciones` (cambiar fechas/local/inquilino = cerrar y crear, decisión de UX del enunciado).
  - Mapper compartido `contrato.mapper.ts`: `Decimal`→`number`, `DATE`→`'YYYY-MM-DD'`, orden de historial.
  - **Verificado con 2 plazas:** creación→`alquilado`, solapado→409, B no ve contratos de A.

### T-055 — Implementar cierre/renovación de contrato

- **Descripción:** Implementar el endpoint para cerrar un contrato (`vigente → finalizado` o `cancelado`) y para "renovar" (cerrar el actual y crear uno nuevo en la misma transacción). Materializa CU-CO-4.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/contratos/:id/cerrar` con body `{ motivoFin, fechaFinEfectiva? }`. Estado pasa a `finalizado` o `cancelado`. Si era el último `vigente` del local, vuelve a `disponible`.
  - [ ] `POST /api/v1/contratos/:id/renovar` con body `{ nuevaFechaInicio, nuevaFechaFin, nuevoMontoMensual? }`. Cierra el actual con `motivo_fin: 'renovado'` y crea uno nuevo `vigente` en la misma transacción.
  - [ ] No se permite cerrar un contrato ya finalizado o cancelado → `400 INVALID_STATE_TRANSITION`.
  - [ ] Si se intenta cerrar y se pasa una `fechaFinEfectiva` < `fechaInicio` → `400 INVALID_DATE`.
  - [ ] Auditoría: cada cierre/renovación registrada con `antes`/`después`.
- **Dependencias:** T-054.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `POST /:id/cerrar` y `POST /:id/renovar` implementados. ⚠️ **Decisión de sesión:** `CerrarContratoSchema` ganó el campo opcional `estado: 'finalizado' | 'cancelado'` (default `finalizado`) porque el criterio dice «pasa a finalizado o cancelado» pero el schema original no permitía elegir.
  - Cerrar: no-vigente → `400 INVALID_STATE_TRANSITION`; `fechaFinEfectiva < fecha_inicio` → `400 INVALID_DATE`; default de `fecha_fin_efectiva` = hoy; si era el último vigente del local → `local.estado='disponible'` en la misma tx.
  - Renovar: **cierra PRIMERO** (`finalizado`, `motivo_fin:'renovado'`) y luego inserta el nuevo vigente — el orden importa: insertar antes de cerrar dispararía un falso `CONTRATO_OVERLAP` del trigger. Devuelve `{ cerrado, nuevo }`.
  - Auditoría con `antes`/`después` en ambas operaciones.
  - **Verificado:** renovar → viejo `finalizado` + nuevo `vigente` + local sigue `alquilado`; cerrar → local `disponible`; cerrar dos veces → 400.

### T-056 — Implementar alertas de vencimiento T-30 y T-7 con @nestjs/schedule

- **Descripción:** Implementar un cron con `@nestjs/schedule` que cada día a las 09:00 (hora de la plaza) busque contratos con `fecha_fin` entre hoy+30 y hoy+29, y entre hoy+7 y hoy+6, y envíe un email a `admin_plaza` con la lista. Materializa S-AlertaVencimiento.
- **Criterios de aceptación:**
  - [ ] `backend/src/modules/contratos/cron/vencimiento-alert.cron.ts` con `@Cron('0 9 * * *', { timeZone: 'America/Costa_Rica' })`.
  - [ ] Query: contratos con `estado = 'vigente'`, `fecha_fin IS NOT NULL`, y `fecha_fin` en la ventana objetivo.
  - [ ] Para T-30: contratos con `fecha_fin = CURRENT_DATE + 30`.
  - [ ] Para T-7: contratos con `fecha_fin = CURRENT_DATE + 7`.
  - [ ] Email plantilla `contrato-por-vencer.html` con la lista agrupada por alerta (T-30 / T-7).
  - [ ] Deduplicación: no enviar dos alertas el mismo día (registrar en `email_log` con `evento: 'contrato_vencimiento_alert'`).
  - [ ] Cron testeable manualmente con endpoint `POST /api/v1/contratos/cron/test-alertas` (solo en dev).
- **Dependencias:** T-054, T-118 (en `09-notificaciones-email.md`, plantillas).
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `backend/src/modules/contratos/cron/vencimiento-alert.cron.ts` con `@Cron('0 9 * * *')`. ⚠️ **Desviación (T-V08):** timeZone `America/El_Salvador`, NO `America/Costa_Rica` como dice el enunciado — la TZ de la plataforma es fija por decisión vinculante.
  - ⚠️ **Adelanto de T-118:** como las plantillas/cola aún no existen, se creó la tabla `email_log` mínima (misma migración de T-047) y `MailerService.sendContratoPorVencer()` con plantilla HTML inline provisional. T-118 debe migrar esto a `contrato-por-vencer.html` + cola con reintentos. La dedup usa `plantilla='contrato_vencimiento_alert'` y `variables.ventana` ('T-30'/'T-7') por plaza y día de El Salvador.
  - **El cron usa `PrismaAdminService`** (bypassa RLS): corre sin contexto de tenant y recorre todas las plazas; el aislamiento se garantiza agrupando explícitamente por `plaza_id`. NO usar `withTenant` aquí.
  - `ScheduleModule.forRoot()` ya estaba registrado vía `NotificacionesModule`; el descubrimiento de `@Cron` es global, no hubo que importarlo en `ContratosModule`.
  - Endpoint dev-only `POST /contratos/cron/test-alertas` (404 si `NODE_ENV==='production'`).
  - **Verificado:** contrato T-30 en plaza A y T-7 en plaza B → 2 emails en MailHog (cada plaza solo con sus contratos), filas en `email_log`, segunda ejecución el mismo día → 0 enviadas (dedup).

### T-057 — Implementar pantallas /admin/locales y /admin/locales/[id]

- **Descripción:** Implementar las pantallas del admin para gestión de locales: listado con filtros, alta, edición, vista de detalle con contrato vigente y tabs (Información, Contratos, Adjuntos, Solicitudes relacionadas).
- **Criterios de aceptación:**
  - [ ] `/admin/locales` con tabla shadcn DataTable paginada, filtros por estado/piso/sector, botón "Nuevo local" y "Importar CSV".
  - [ ] `/admin/locales/nuevo` con formulario RHF + Zod.
  - [ ] `/admin/locales/[id]` con tabs: Datos, Contratos (lista con vigente destacado), Adjuntos, Solicitudes.
  - [ ] Cambio de estado con select que muestra solo transiciones válidas.
  - [ ] Si tiene contrato vigente, el campo `estado` está deshabilitado (solo lectura).
  - [ ] Si intenta desactivar y tiene contrato vigente: mensaje de error.
  - [ ] Acciones con React Query (useSWR o tanstack-query) para refresh optimista.
- **Dependencias:** T-051, T-053, T-054, T-058.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: Route group nuevo `(admin-plaza)` con layout que verifica rol `admin_plaza`/`superadmin` server-side (patrón de `(admin-plataform)`). Pantallas: `/admin/locales` (tabla paginada + filtros estado/piso/sector por query params), `/admin/locales/nuevo` (RHF + Zod) y `/admin/locales/[id]` con tabs Datos/Contratos/Adjuntos/Solicitudes (las dos últimas como placeholder hasta módulos 08/06).
  - ⚠️ **Sin botón «Importar CSV»** (T-V07, T-052/T-058 descartadas).
  - ⚠️ **Desviación del criterio «React Query»:** se mantiene el patrón arquitectónico existente — Server Components + Server Actions + `revalidatePath`/`router.refresh` (S-ARQ-E/F). Introducir react-query habría requerido exponer la API al cliente. Confirmado con el owner antes de implementar.
  - Select de estado: solo transiciones válidas (`disponible`/`en_mantenimiento`/`fuera_de_servicio`); con contrato vigente queda deshabilitado mostrando `alquilado`. Desactivar con vigente → toast con el error 409 del backend.
  - Tablas simples estilo `PlazasTable` (sin DataTable de tanstack-table por ahora; el paquete está instalado para cuando se necesite ordenamiento/column-pinning).
  - **Verificado:** rutas protegidas (307 → /login sin sesión) y render autenticado con datos reales (login programático NextAuth + curl).

### T-058 — Implementar pantalla /admin/locales/importar

- **Descripción:** Implementar la pantalla de importación CSV con drag-and-drop, vista previa de las primeras filas, y resumen del resultado tras la importación.
- **Criterios de aceptación:**
  - [ ] `/admin/locales/importar` con zona de drag-and-drop (componente shadcn).
  - [ ] Acepta solo `.csv`. Tamaño máx 5 MB.
  - [ ] Vista previa: parsea las primeras 5 filas con `papaparse` y muestra tabla.
  - [ ] Botón "Importar" que sube el archivo al backend.
  - [ ] Muestra el resultado: `created: N` y `failed: [...]` con detalle por fila.
  - [ ] Link a plantilla CSV de ejemplo para descargar.
  - [ ] Indicador de progreso durante el upload.
- **Dependencias:** T-052.
- **Prioridad:** Media.
- **Estado:** Descartada.
- **Bitácora de cambios:**
  - 2026-06-06: ⚠️ **Descartada por decisión vinculante T-V07** (sin importador CSV en v1). Ver bitácora de T-052.

### T-059 — Implementar pantallas /admin/inquilinos y /admin/inquilinos/[id]

- **Descripción:** Pantallas del admin para gestión de inquilinos.
- **Criterios de aceptación:**
  - [ ] `/admin/inquilinos` con tabla paginada, filtros por razón social / identificación, botón "Nuevo inquilino".
  - [ ] `/admin/inquilinos/nuevo` con formulario RHF + Zod.
  - [ ] `/admin/inquilinos/[id]` con tabs: Datos, Contratos, Solicitudes.
  - [ ] Acción "Alta rápida de usuario asociado" (modal que crea `usuario.rol=inquilino` con `inquilino_id` prellenado y genera password temporal enviado por email).
  - [ ] Si tiene contrato vigente, el botón "Desactivar" está deshabilitado.
- **Dependencias:** T-053, T-054, T-034 (en `02-autenticacion-usuarios.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `/admin/inquilinos` (tabla + filtros razón social/identificación), `/admin/inquilinos/nuevo` y `/admin/inquilinos/[id]` con tabs Datos/Contratos/Solicitudes (placeholder módulo 06). «Desactivar» deshabilitado con contrato vigente (y el backend lo bloquea con 409 igualmente).
  - ⚠️ **Adelanto parcial de T-034:** la «alta rápida de usuario asociado» necesitaba `POST /usuarios`, que era un stub. Se implementó la **versión mínima** en backend (`UsuariosService.create`): rol `inquilino` exige `inquilinoId` válido de la plaza, rol `admin_plaza` exige `rolStaffId` activo, `superadmin` no se crea por API, email duplicado → `409 USUARIO_EMAIL_DUPLICADO`. **El CRUD completo de usuarios sigue pendiente en T-034.**
  - La contraseña temporal se genera en el Server Action (cumple política T-V13) y se muestra **una sola vez** en el modal; el backend envía el email de bienvenida (mailer provisional — T-118 podrá incluir flujo de set-password en vez de password por pantalla).
  - **Verificado:** usuario inquilino creado vía modal → login OK → ve SOLO sus contratos/locales/registro (aislamiento por rol confirmado con curl); 403 al intentar crear locales.

### T-060 — Implementar pantallas /admin/contratos y /admin/contratos/[id]

- **Descripción:** Pantallas del admin para gestión de contratos.
- **Criterios de aceptación:**
  - [ ] `/admin/contratos` con tabla paginada, filtros por local/inquilino/estado, botón "Nuevo contrato".
  - [ ] `/admin/contratos/nuevo` con formulario con selects de local (solo `disponible`) e inquilino, fechas, monto.
  - [ ] `/admin/contratos/[id]` con detalle + adjuntos + historial de cambios.
  - [ ] Acciones: Cerrar contrato, Renovar contrato (modal con preview del nuevo).
  - [ ] Banner de alerta si está en ventana T-30 o T-7.
  - [ ] Si es `inquilino`, ve `/inquilino/contratos` con los suyos.
- **Dependencias:** T-054, T-055, T-056.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `/admin/contratos` (tabla + filtros local/inquilino/estado con selects precargados server-side), `/admin/contratos/nuevo` (select solo de locales `disponible` + inquilinos + fechas + monto; vacío = indefinido) y `/admin/contratos/[id]` con detalle + adjuntos + acciones.
  - Banner de alerta T-30 (ámbar) / T-7 (rojo) usando los flags `enVentanaT30/T7` del backend.
  - Cerrar contrato: modal con tipo de cierre (finalizado/cancelado), motivo obligatorio y fecha efectiva. Renovar: modal con preview del nuevo contrato antes de confirmar.
  - **Portal del inquilino incluido:** route group `(inquilino)` con `/inquilino/contratos` (read-only, el backend filtra por el JWT) y `/inquilino/contratos/[id]` con descarga/subida de su PDF firmado (T-062).
  - ⚠️ Ajuste único a `frontend/src/lib/api.ts`: con `FormData` ya no se fija `Content-Type: application/json` (deja que fetch ponga el boundary multipart). Sin esto la subida de adjuntos fallaba.
  - **Verificado:** render autenticado de todas las pantallas (200 + datos), redirecciones 307 sin sesión.

### T-061 — Implementar historial de contratos por local y por inquilino

- **Descripción:** Endpoint que retorna el histórico de contratos (vigentes, finalizados, cancelados) para un local o un inquilino, ordenados por fecha de inicio descendente.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/locales/:id/contratos?estado=&page=&pageSize=` retorna los contratos del local.
  - [ ] `GET /api/v1/inquilinos/:id/contratos?estado=&page=&pageSize=` retorna los contratos del inquilino.
  - [ ] Orden por `fecha_inicio DESC`.
  - [ ] Solo los vigentes primero, luego finalizados, luego cancelados.
  - [ ] RLS probado.
  - [ ] Consumido por las pantallas T-057 y T-059.
- **Dependencias:** T-054.
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: `GET /locales/:id/contratos` y `GET /inquilinos/:id/contratos` con filtro `?estado=` y paginación. Rol inquilino solo sobre su propio id (404 en otro caso).
  - ⚠️ **Orden de negocio (vigente → finalizado → cancelado):** el `orderBy` de Prisma sobre el enum es alfabético (cancelado < finalizado < vigente), así que se ordena **en memoria** con un mapa de prioridad + `fecha_inicio DESC` dentro de cada grupo (`contrato.mapper.ordenarHistorial`). Volúmenes por local/inquilino son bajos; si crecieran, migrar a `ORDER BY CASE` con `$queryRaw`.
  - Consumido por las tabs «Contratos» de `/admin/locales/[id]` y `/admin/inquilinos/[id]` (el detalle embebe el histórico; los endpoints quedan para listados paginados).
  - **Verificado:** orden correcto tras crear/renovar/cerrar (vigente primero), RLS con 2 plazas.

### T-062 — Implementar upload de contrato firmado (PDF) con MinIO

- **Descripción:** Permitir subir el PDF del contrato firmado como adjunto. Solo `admin_plaza` puede subir a cualquier contrato; `inquilino` puede subir a sus propios contratos. Materializa RN-CO-5.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/contratos/:id/adjuntos` con multipart/form-data.
  - [ ] Solo `application/pdf`. Tamaño máx `configuracion.tamanio_max_archivo_mb`.
  - [ ] Guarda en MinIO bucket `contratos-{plaza_id}` con key `{plaza_id}/contrato/{contratoId}/{uuid}.pdf`.
  - [ ] Crea registro en `adjunto` con `entidad_tipo: 'contrato'`, `entidad_id: contratoId`.
  - [ ] `GET /api/v1/contratos/:id/adjuntos` lista los adjuntos.
  - [ ] `GET /api/v1/adjuntos/:id/download` retorna URL pre-firmada (15 min).
  - [ ] `DELETE /api/v1/adjuntos/:id` mueve a `quarantine-{plaza_id}` y soft delete.
  - [ ] Solo el usuario que subió o un `admin_plaza` puede eliminar.
- **Dependencias:** T-054, T-110 (en `08-adjuntos.md`, MinIO client).
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - 2026-06-06: ⚠️ **Adelanto parcial de T-110:** se usó/extendió el `MinioService` mínimo del módulo 03 (`bucketForContratos()` nuevo; `putObject`/`presignedGetUrl`/`moveToQuarantine` reutilizados) en lugar de esperar el cliente completo. T-110 lo ampliará sin romper estas rutas. La tabla `adjunto` polimórfica se creó en la migración de T-047 (la reutilizarán solicitudes/locales en módulo 08).
  - Endpoints: `POST/GET /contratos/:id/adjuntos` en `ContratosController` (cohesión con el recurso); `GET /adjuntos/:id/download` y `DELETE /adjuntos/:id` en el módulo `adjuntos` (polimórficos, se expanden en T-112..T-117). Lógica compartida en `AdjuntosService`.
  - ⚠️ **Límite 50 MB** (default de `configuracion.tamanio_max_archivo_mb`, T-V06 — no 25 MB del plan original); se lee la config de la plaza en cada subida → `413 ADJUNTO_DEMASIADO_GRANDE`. Solo `application/pdf` → `400 ADJUNTO_MIME_INVALIDO`.
  - Permisos (docs/06 §6.2.9): admin_plaza sube/borra cualquiera de su plaza; inquilino solo en SUS contratos y solo borra lo que subió (`403 ADJUNTO_DELETE_FORBIDDEN`).
  - `DELETE` → `moveToQuarantine` (bucket `quarantine-{plaza_id}`) + soft delete.
  - **Verificado:** subida 201 (admin e inquilino), no-PDF → 400, download pre-firmado 200, delete → objeto en cuarentena + `deleted_at`, todo con MinIO real.
