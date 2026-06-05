# Módulo 04 — Locales, Inquilinos y Contratos

> **Propósito:** CRUD de locales (con estados `disponible`/`alquilado`/`en_mantenimiento`/`fuera_de_servicio`), importación CSV de locales, CRUD de inquilinos, CRUD de contratos con trigger anti-solapamiento, alertas de vencimiento T-30 y T-7, contrato indefinido (`fecha_fin` NULL), y todas las pantallas asociadas del admin de plaza e inquilino.
>
> **Pre-requisito:** T-001 a T-046 (setup, auth, plazas) deben estar `Completada`.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-047 | Crear migración Prisma con `local` | Alta | Pendiente |
| T-048 | Crear migración Prisma con `inquilino` | Alta | Pendiente |
| T-049 | Crear migración Prisma con `contrato` + CHECK de fechas | Alta | Pendiente |
| T-050 | Crear trigger PL/pgSQL para anti-solapamiento de contratos vigentes | Alta | Pendiente |
| T-051 | Implementar CRUD locales (POST/GET/PATCH /api/v1/locales) | Alta | Pendiente |
| T-052 | Implementar importación CSV de locales | Media | Pendiente |
| T-053 | Implementar CRUD inquilinos (POST/GET/PATCH /api/v1/inquilinos) | Alta | Pendiente |
| T-054 | Implementar CRUD contratos (POST/GET/PATCH /api/v1/contratos) | Alta | Pendiente |
| T-055 | Implementar cierre/renovación de contrato | Alta | Pendiente |
| T-056 | Implementar alertas de vencimiento T-30 y T-7 con @nestjs/schedule | Media | Pendiente |
| T-057 | Implementar pantallas /admin/locales y /admin/locales/[id] | Alta | Pendiente |
| T-058 | Implementar pantalla /admin/locales/importar | Media | Pendiente |
| T-059 | Implementar pantallas /admin/inquilinos y /admin/inquilinos/[id] | Alta | Pendiente |
| T-060 | Implementar pantallas /admin/contratos y /admin/contratos/[id] | Alta | Pendiente |
| T-061 | Implementar historial de contratos por local y por inquilino | Media | Pendiente |
| T-062 | Implementar upload de contrato firmado (PDF) con MinIO | Media | Pendiente |

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*
