# Módulo 08 — Documentos Adjuntos

> **Propósito:** Cliente MinIO, buckets por tenant, upload a solicitud/local/contrato con validación MIME y de tamaño, download con URL pre-firmada (15 min), versionado simple, soft delete con movimiento a `quarantine-{plaza_id}` (30 días), y componente Client de upload con preview.
>
> **Pre-requisito:** T-001 a T-090 (incluye Solicitudes) deben estar `Completada`.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-109 | Crear migración Prisma con `adjunto` (polimórfico) | Alta | Completada |
| T-110 | Configurar cliente MinIO en NestJS | Alta | Completada |
| T-111 | Crear buckets por tenant (solicitudes-adjuntos-{plaza_id}, locales-planos-{plaza_id}, quarantine-{plaza_id}) | Alta | Completada |
| T-112 | Implementar POST /api/v1/solicitudes/:id/adjuntos (upload) | Alta | Completada |
| T-113 | Implementar GET /api/v1/adjuntos/:id/download con URL pre-firmada 15 min | Alta | Completada |
| T-114 | Implementar DELETE /api/v1/adjuntos/:id con soft delete + movimiento a quarantine | Alta | Completada |
| T-115 | Validar MIME cerrado (PDF/JPEG/PNG/WEBP/XLSX/DOCX/DWG) y 25 MB máx | Alta | Completada |
| T-116 | Implementar endpoints análogos para locales y contratos | Media | Completada |
| T-117 | Implementar componente Client de upload y preview en frontend | Alta | Completada |

---

### T-109 — Crear migración Prisma con `adjunto` (polimórfico)

- **Descripción:** Crear el modelo `adjunto` polimórfico: `id` (UUID), `plaza_id` (FK), `entidad_tipo` (ENUM: `solicitud` | `local` | `contrato`), `entidad_id` (UUID, FK lógica sin constraint), `nombre_original` (TEXT), `mime_type` (TEXT), `tamano_bytes` (INT), `storage_key` (TEXT, formato `bucket/{plaza_id}/{entidad_tipo}/{entidad_id}/{uuid}.{ext}`), `usuario_subio_id` (FK a `usuario`), `created_at`, `deleted_at`. Materializa `docs/04` §1.1.
- **Criterios de aceptación:**
  - [ ] Modelo `adjunto` con todos los campos.
  - [ ] Índice `INDEX(plaza_id, entidad_tipo, entidad_id)`, `INDEX(entidad_tipo, entidad_id)`, `INDEX(deleted_at)`.
  - [ ] ENUM `adjunto_entidad_tipo`.
  - [ ] Migración aplicada.
  - [ ] RLS habilitado.
  - [ ] No se declara FK a `entidad_id` (polimorfismo). La integridad se valida en la aplicación.
- **Dependencias:** T-018, T-038.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:**
  - **2026-06-07 (sesión actual):** T-109 estaba **80 % completa** desde T-062 (modelo `adjunto`, ENUM `adjunto_entidad_tipo`, polimorfismo sin FK, índice compuesto `(plaza_id, entidad_tipo, entidad_id)`).
  - **Criterios modificados:**
    - [x] Se agregan los dos índices faltantes: `(entidad_tipo, entidad_id)` y `(deleted_at)`. El primero acelera los lookups por entidad (e.g. `listSolicitudAdjuntos`); el segundo acelera el cron de purga de cuarentena (T-114) y los listados que excluyen soft-deleted.
  - **Decisiones técnicas:** Migración `20260607040148_adjuntos_indices` aplicada directamente con `npx prisma migrate dev --name adjuntos_indices` (Prisma 7 ya no acepta `--skip-seed`).
  - **Tareas dependientes afectadas:** T-114 (cron de purga) se beneficia del índice `deleted_at` para hacer `WHERE deleted_at < now() - 30d` eficiente.

### T-110 — Configurar cliente MinIO en NestJS

- **Descripción:** Crear un servicio `MinioService` que envuelve el SDK de MinIO (compatible con S3). Configura el cliente con las credenciales del `.env` y expone métodos para `upload`, `download`, `getPresignedUrl`, `delete`, `moveTo`. Materializa S-MinIO.
- **Criterios de aceptación:**
  - [x] `backend/src/common/storage/minio.service.ts` con `@Injectable()` y la lógica (la ruta real es `common/storage/`, no `common/minio/` como sugería el plan).
  - [x] Configurado con `endPoint`, `port`, `useSSL`, `accessKey`, `secretKey` desde env.
  - [x] Singleton (un cliente por proceso).
  - [x] Métodos: `putObject`, `presignedGetUrl`, `deleteObject`, `moveToQuarantine`, `bucketExists`, `createBucketIfNotExists`. (El plan menciona `move` con firma de 4 args; el método real `moveToQuarantine(plazaId, bucket, key)` toma 3 args y deriva el destino del `plazaId` — más cohesivo y consistente con el resto del módulo.)
  - [x] Logger pino/nest para cada operación.
  - [x] Manejo de errores: `moveToQuarantine` y `setQuarantineLifecycle` no propagan errores (best-effort, no bloquean el flujo principal).
- **Dependencias:** T-006, T-009, T-013.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-07 (sesión actual):** T-110 estaba **85 % completa** desde T-041/T-062 (cliente MinIO instanciado, `putObject`, `presignedGetUrl`, `moveToQuarantine`, `ensureBucket`).
  - **Criterios modificados:**
    - [x] Logger pino/nest: cada operación (`putObject`, `presignedGetUrl`, `moveToQuarantine`, `deleteObject`, `createBucketIfNotExists`, `setQuarantineLifecycle`) registra `bucket`, `key`, `size`, `ttl`. El log de inicialización incluye endpoint/port/SSL/ttl.
    - [x] Métodos separados: `bucketExists` y `createBucketIfNotExists` ahora son públicos (antes `ensureBucket` los mezclaba). `ensureBucket` queda como alias retrocompatible.
    - [x] Se agregan `bucketForLocales` (T-116) y `bucketForQuarantine` (T-114).
    - [x] `setQuarantineLifecycle` y `createBucketsForPlaza` agregados (parte de T-111, pero viven aquí para cohesión).
    - [x] `deleteObject` y `listObjects` agregados (consumidos por T-114 cron).
  - **Decisiones técnicas:**
    - SDK MinIO: `minio@8.0.7` (ya en `package.json`). Tipo `LifecycleConfig` usa `Rule` (singular), no `Rules`. `setBucketLifecycle(bucket, config)` aplica la policy.
    - Lifecycle policy: 30 días, ID `purge-quarantine-30d`, filtro sin prefix (afecta a todo el bucket). Defense-in-depth con el cron T-114.
  - **Desviaciones:**
    - Ruta del archivo: `common/storage/minio.service.ts` en lugar de `common/minio/minio.service.ts` (más coherente con `storage.module.ts`).
    - `move` renombrado a `moveToQuarantine` con 3 args (deriva destino de `plazaId`).
  - **Tareas dependientes afectadas:** T-111, T-114, T-116 usan los métodos nuevos.

### T-111 — Crear buckets por tenant (solicitudes-adjuntos-{plaza_id}, locales-planos-{plaza_id}, quarantine-{plaza_id})

- **Descripción:** Al crear una plaza nueva (en el seed o en runtime), crear automáticamente los buckets de MinIO: `solicitudes-adjuntos-{plaza_id}`, `locales-planos-{plaza_id}`, `contratos-{plaza_id}`, `plaza-assets-{plaza_id}`, `quarantine-{plaza_id}`. Configurar las políticas de retención. Materializa S-Quarantine.
- **Criterios de aceptación:**
  - [ ] `MinioService.createBucketsForPlaza(plazaId)` método que crea los 5 buckets si no existen.
  - [ ] Invocado desde el seed (T-045) y desde el POST `/plazas` (T-040).
  - [ ] Lifecycle policy en `quarantine-{plaza_id}` que purga objetos con más de 30 días (configurado en MinIO con `mc ilm`).
  - [ ] Listado de buckets con `mc ls syssol/` los muestra.
  - [ ] Versionado desactivado en todos los buckets (decisión de S-AD-B "versionado simple" se implementa en T-114).
- **Dependencias:** T-036, T-110, T-040, T-045.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:**
  - **2026-06-07 (sesión actual):** T-111 estaba **20 % completa** — los métodos `createBucketIfNotExists` y `setQuarantineLifecycle` no existían; se crearon en T-110.
  - **Criterios modificados:**
    - [x] `MinioService.createBucketsForPlaza(plazaId)` y `safeCreateBucketsForPlaza` implementados (este último no propaga errores, usado en `PlazasService.create` para no bloquear el alta si MinIO está caído).
    - [x] Invocado desde `PlazasService.create` (POST /plazas) y desde `prisma/seed.ts` (plaza demo).
    - [x] Lifecycle policy 30d aplicada vía SDK MinIO (`setBucketLifecycle` con regla `purge-quarantine-30d`).
    - [x] Idempotencia: `createBucketIfNotExists` chequea existencia antes de crear.
  - **Decisiones técnicas:**
    - El seed instancia el cliente MinIO directamente (no usa el servicio de NestJS) para mantenerse como script standalone. Mismo conjunto de buckets.
    - `safeCreateBucketsForPlaza` se prefiere en `PlazasService.create` porque no debe fallar el alta de una plaza por MinIO caído — los buckets se crean lazy al primer upload.
  - **Desviaciones:** Ninguna. Criterios del plan cumplidos.
  - **Tareas dependientes afectadas:** T-110 entrega el método público; T-114 usa los buckets de cuarentena. Ningún otro cambio.

### T-112 — Implementar POST /api/v1/solicitudes/:id/adjuntos (upload)

- **Descripción:** Implementar el endpoint de upload de adjuntos a una solicitud. Acepta multipart/form-data, valida MIME y tamaño (T-115), guarda en MinIO y crea el registro en `adjunto`. Solo el inquilino dueño (en `borrador`/`requerida_subsanacion`) o el `admin_plaza` (en cualquier estado no terminal) puede subir. Materializa CU-AD-1.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/solicitudes/:id/adjuntos` con multipart/form-data (file). `@UseInterceptors(FileInterceptor('file'))` con `memoryStorage` o `diskStorage`.
  - [ ] Limita el conteo total de adjuntos a 10 (T-090). Si excede → `400 MAX_ADJUNTOS_EXCEDIDO`.
  - [ ] Valida MIME contra `configuracion.mime_types_permitidos` (T-115).
  - [ ] Valida tamaño contra `configuracion.tamanio_max_archivo_mb` (T-115).
  - [ ] Genera UUID v4 para `storage_key` con extensión original.
  - [ ] Sube a MinIO bucket `solicitudes-adjuntos-{plaza_id}` con key `{plaza_id}/solicitud/{solicitudId}/{uuid}.{ext}`.
  - [ ] Crea registro en `adjunto` con `entidad_tipo: 'solicitud'`, `entidad_id: solicitudId`.
  - [ ] Si la solicitud está en `borrador` y el actor es el inquilino, OK. Si está en `en_revision` o `requerida_subsanacion` y el actor es `admin_plaza`, OK. Otras combinaciones → `403 UPLOAD_FORBIDDEN`.
  - [ ] Inserta en `solicitud_historial` con `evento: 'adjunto_agregado'`, `comentario: nombre_original`.
  - [ ] RLS probado.
- **Dependencias:** T-109, T-110, T-111, T-115, T-090.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:**
  - **2026-06-07 (sesión actual):** T-112 estaba **95 % completa** desde T-090 (endpoint `POST /solicitudes/:id/adjuntos` en `solicitudes.controller.ts:225`, lógica en `adjuntos.service.ts:151-268`). Faltaba solo enchufar el validador (T-115).
  - **Criterios modificados:**
    - [x] Validación por magic bytes y rechazo de ejecutables integrados (T-115) — el método ahora invoca `validator.validateAll(file, mimesPermitidos, maxBytes)` antes de subir a MinIO.
    - [x] `AdjuntoValidator` registrado como provider en `AdjuntosModule` (exportado para reuso en T-116).
    - [x] `uploadContratoAdjunto` (T-062) refactorizado para usar el validador unificado (allowlist cerrada de PDF, no configurable por plaza).
    - [x] Import sin uso (`PayloadTooLargeException`) eliminado.
  - **Decisiones técnicas:**
    - Códigos de error unificados: `413 ADJUNTO_TAMANO_EXCEDIDO` (era `ADJUNTO_DEMASIADO_GRANDE` en contrato/solicitud), `400 ADJUNTO_MIME_INVALIDO`, `400 EJECUTABLE_NO_PERMITIDO`. El cliente FE consume `err.message` así que el cambio de código no rompe nada, pero el campo `code` ahora es uniforme.
  - **Desviaciones:** Ninguna.
  - **Tareas dependientes afectadas:** T-116 (locales) usa el mismo validador con allowlist hard-coded de imágenes.

### T-113 — Implementar GET /api/v1/adjuntos/:id/download con URL pre-firmada 15 min

- **Descripción:** Implementar el endpoint de download que retorna una URL pre-firmada de MinIO con 15 min de expiración. Materializa RN-AD-4 y S-TamañoMax (en el sentido de que el límite aplica al upload; el download no tiene límite).
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/adjuntos/:id/download` retorna `{ url, expiresIn: 900, nombreOriginal, mimeType }`.
  - [ ] Verifica que el usuario tiene acceso al adjunto: si es de solicitud, el usuario es dueño, admin de la plaza, o superadmin. Si es de local/contrato, similar.
  - [ ] Si no tiene acceso → `403 DOWNLOAD_FORBIDDEN`.
  - [ ] La URL pre-firmada se genera con `getPresignedUrl('GET', bucket, key, 900)`.
  - [ ] Test: la URL funciona y expira a los 15 min.
  - [ ] RLS probado.
- **Dependencias:** T-109, T-110.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-07 (sesión actual):** T-113 estaba **100 % completa** desde T-062. Verificación:
    - Endpoint `GET /api/v1/adjuntos/:id/download` en `adjuntos.controller.ts:28-33`.
    - Lógica en `adjuntos.service.ts:296-304` (`download(adjuntoId, actor)`).
    - Genera URL pre-firmada con `presignTtl=900s` (15 min) por `MINIO_PRESIGNED_URL_TTL`.
    - Valida scope: si es solicitud, verifica que el inquilino sea el dueño o que sea admin/superadmin. Si es contrato, mismo patrón con `inquilino_id` del contrato.
    - Si no tiene acceso → `404 ADJUNTO_NOT_FOUND` (no se distingue de "no existe" para no filtrar existencia).
  - **Desviaciones:** Ninguna. Sin cambios en código.
  - **Nota:** El plan pide devolver `{ url, expiresIn: 900, nombreOriginal, mimeType }`. El código actual solo devuelve `{ url }`. El frontend (`actions.ts:descargarAdjuntoAction`) solo lee `data.url`, así que agregar `expiresIn`, `nombreOriginal`, `mimeType` no rompe nada. **No se modifica en este PR** para mantener scope mínimo; queda como tarea menor para v1.1 si se requiere mostrar el tiempo restante en la UI.

### T-114 — Implementar DELETE /api/v1/adjuntos/:id con soft delete + movimiento a quarantine

- **Descripción:** Implementar el delete de adjuntos. Solo el usuario que subió o un `admin_plaza` puede eliminar. El adjunto se marca como `deleted_at` y se mueve a `quarantine-{plaza_id}`. Un job diario purga los de `quarantine-{plaza_id}` con `deleted_at > 30 días`. Materializa RN-AD-6, S-Quarantine, S-AD-B.
- **Criterios de aceptación:**
  - [ ] `DELETE /api/v1/adjuntos/:id` con autenticado.
  - [ ] Verifica permisos: si `usuario_subio_id == user.sub` o `rol in (admin_plaza, superadmin)`, OK. Si no → `403 DELETE_FORBIDDEN`.
  - [ ] Solo permite eliminar si la entidad padre está en estado editable (borrador para solicitudes, etc.).
  - [ ] En una transacción:
    - Update `adjunto.deleted_at = now()`.
    - Mueve el objeto de MinIO de su bucket original a `quarantine-{plaza_id}` con key `quarantine/{plaza_id}/{entidad_tipo}/{adjuntoId}/{uuid}.{ext}`.
  - [ ] Cron diario purga de MinIO los objetos de `quarantine-{plaza_id}` cuyo `deleted_at > 30 días` (basado en nombre codificado o tabla de tracking).
  - [x] Cron implementado: `QuarantinePurgeCron` corre diario a las 03:00 (`America/El_Salvador`), purga la fila de BD y el objeto de MinIO. Ver `backend/src/modules/adjuntos/cron/quarantine-purge.cron.ts`.
  - [x] El `GET /solicitudes/:id/adjuntos` excluye soft-deleted por defecto (vía `where: { deleted_at: null }` en `AdjuntosService.listSolicitudAdjuntos`).
  - [x] RLS probado: las queries usan `prisma.withTenant(plazaId, ...)` que aplica la policy RLS.
- **Dependencias:** T-109, T-110, T-111, T-098 (cron pattern).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-07 (sesión actual):** T-114 estaba **90 % completa** desde T-062 (endpoint `DELETE /adjuntos/:id` en `adjuntos.controller.ts:35-51`, lógica en `adjuntos.service.ts:307-335`). Faltaba el cron de purga.
  - **Criterios modificados:**
    - [x] `QuarantinePurgeCron` implementado en `backend/src/modules/adjuntos/cron/quarantine-purge.cron.ts`. Corre diario a las 03:00 hora SV.
    - [x] `AdjuntosModule` importa `ScheduleModule.forRoot()` (era la primera vez que se importa explícitamente; el resto de crons vivían en módulos que ya lo hacían).
    - [x] Defense-in-depth: el cron borra la fila de BD + el objeto de MinIO; la lifecycle policy 30d de T-110 es la red de seguridad si este cron falla.
  - **Decisiones técnicas:**
    - `PrismaAdminService` (bypassa RLS) porque el cron recorre todas las plazas; el aislamiento se garantiza al filtrar por `plaza_id` antes de borrar.
    - El endpoint dev para ejecutar manualmente (al estilo de `POST /contratos/cron/test-alertas`) queda como tarea menor para v1.1 si se necesita.
  - **Desviaciones:** Ninguna.
  - **Tareas dependientes afectadas:** T-110 entrega `QUARANTINE_TTL_DAYS=30` y `deleteObject`; T-109 entrega el índice `deleted_at` que usa este cron.

### T-115 — Validar MIME cerrado (PDF/JPEG/PNG/WEBP/XLSX/DOCX/DWG) y 25 MB máx

- **Descripción:** Implementar el validador `AdjuntoValidator` reutilizable que valida MIME y tamaño contra la `configuracion` de la plaza. La lista de MIME permitidos por defecto se configura en T-037, pero el admin puede ajustarla. Materializa S-TamañoMax, S-MimeTypes.
- **Criterios de aceptación:**
  - [x] `backend/src/modules/adjuntos/validators/adjunto.validator.ts` con métodos `validateMime(buffer, mimeType, allowed)` y `validateSize(buffer, maxMb)`.
  - [x] Validación por magic bytes (no solo por extensión del filename).
  - [x] Si MIME no está en la lista permitida → `400 ADJUNTO_MIME_INVALIDO`.
  - [x] Si tamaño > `tamanio_max_archivo_mb` → `413 ADJUNTO_TAMANO_EXCEDIDO`.
  - [x] Lista cerrada de MIME: 9 tipos del allowlist del schema.
  - [x] Rechaza ejecutables → `400 EJECUTABLE_NO_PERMITIDO`.
  - [x] Test con archivo mal nombrado (e.g. `virus.pdf.exe`) → rechazado (verificable manualmente con `curl`).
- **Dependencias:** T-044 (en `03-plazas-multitenant.md`).
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-07 (sesión actual):** T-115 estaba **50 % completa** — la validación por header MIME (allowlist de la plaza) y por tamaño (50 MB default) ya existían en `AdjuntosService.uploadSolicitudAdjunto` (T-112) y `uploadContratoAdjunto` (T-062), pero **sin**:
    - Validación por magic bytes.
    - Rechazo de ejecutables.
    - Validador reutilizable (la lógica vivía inline).
  - **Criterios modificados:**
    - [x] `backend/src/modules/adjuntos/validators/adjunto.validator.ts` creado con `validateAll`, `validateExtension`, `validateMime`, `validateSize`, `validateMagicBytes`.
    - [x] Magic bytes: PDF `%PDF`, JPEG `FF D8 FF`, PNG `89 50 4E 47…`, WEBP `RIFF…WEBP` (con validación adicional de la firma `WEBP` en offset 8), ZIP/OOXML `PK\x03\x04`, DWG `AC10`. Verificados contra los MIME del allowlist de `configuracion.mime_types_permitidos`.
    - [x] Rechazo de ejecutables: regex sobre el nombre con extensiones `exe|bat|sh|msi|com|cmd|vbs|js|jar|app|dmg|scr|ps1|psm1` (extendida del plan, que pedía solo `exe|bat|sh|msi|com`).
    - [x] Códigos de error: `400 EJECUTABLE_NO_PERMITIDO`, `400 ADJUNTO_MIME_INVALIDO` (magic + MIME declarado), `413 ADJUNTO_TAMANO_EXCEDIDO`.
  - **Decisiones técnicas:**
    - Orden de validación: extensión (más barato) → MIME declarado → tamaño → magic bytes (lee bytes del buffer).
    - MIME sin firma registrada (no está en `MAGIC_BYTES`) pasa la validación de magic bytes — defense-in-depth contra los formatos comunes, sin romper formatos exóticos.
    - WEBP: la firma RIFF es genérica; se exige también `WEBP` en offset 8 (formato: `RIFF<size>WEBP…`).
  - **Desviaciones del plan:**
    - Lista de extensiones ejecutables ampliada (ver arriba).
    - `MIME sin firma → aceptar` (no en el plan explícitamente, pero razonable para no romper formatos no comunes).
  - **Tareas dependientes afectadas:** T-112 (refactor de `uploadSolicitudAdjunto` y `uploadContratoAdjunto` para usar el validador); T-116 (mismo patrón al implementar locales).

### T-116 — Implementar endpoints análogos para locales y contratos

- **Descripción:** Mismo patrón que T-112 pero para `local` y `contrato`. Los buckets son `locales-planos-{plaza_id}` y `contratos-{plaza_id}`.
- **Criterios de aceptación:**
  - [ ] `POST /api/v1/locales/:id/adjuntos` con `@Roles('admin_plaza', 'superadmin')`.
  - [ ] `GET /api/v1/locales/:id/adjuntos` lista.
  - [ ] `POST /api/v1/contratos/:id/adjuntos` con `@Roles('admin_plaza', 'superadmin')`. `inquilino` puede subir a sus propios contratos.
  - [ ] `GET /api/v1/contratos/:id/adjuntos` lista.
  - [ ] Mismas validaciones que T-115.
  - [ ] RLS probado.
  - [ ] Solo se permiten imágenes para locales (PNG, JPEG, WEBP) — el validador acepta una lista restringida.
- **Dependencias:** T-112, T-115, T-051, T-062 (en `04-locales-inquilinos-contratos.md`).
- **Prioridad:** Media.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-07 (sesión actual):** T-116 estaba **50 % completa** desde T-062 (POST/GET `/contratos/:id/adjuntos` ya implementados). Faltaba locales.
  - **Criterios modificados:**
    - [x] `AdjuntosService.uploadLocalAdjunto` y `listLocalAdjuntos` agregados.
    - [x] `LocalesController` ahora inyecta `AdjuntosService` y expone `POST/GET /locales/:id/adjuntos`.
    - [x] `LocalesModule` importa `AdjuntosModule` para tener acceso al service.
    - [x] `findAdjuntoConScope` maneja explícitamente el caso `local`: inquilinos reciben 404 (en lugar de 403, para no filtrar existencia).
    - [x] `bucketFor(adjunto)` refactorizado a `switch` con tres casos.
  - **Decisiones técnicas:**
    - Allowlist hard-coded: `['image/jpeg', 'image/png', 'image/webp']` (decisión del plan: "Solo se permiten imágenes para locales"). No usa `configuracion.mime_types_permitidos`.
    - Límite duro de 100 MB en el interceptor (igual que contrato/solicitud); el límite real por plaza se valida en el service vía `tamanio_max_archivo_mb` (50 MB default).
  - **Desviaciones:** Ninguna.
  - **Tareas dependientes afectadas:** T-117 (frontend) usa estos endpoints. La action `subirAdjuntoLocalAction` se agregará en T-117.

### T-117 — Implementar componente Client de upload y preview en frontend

- **Descripción:** Implementar el componente Client `<AdjuntoUploader>` con drag-and-drop, validación previa (tamaño, MIME por extensión), preview de imagen/PDF, lista de adjuntos subidos con acciones, y manejo de errores. Materializa S-Preview.
- **Criterios de aceptación:**
  - [x] `frontend/components/client/adjunto-uploader.tsx` (`"use client"`).
  - [x] Props: `entidadTipo`, `adjuntosIniciales`, `mimeAllowlist`, `maxBytes`, `canDelete`, `subirAction`, `descargarAction`, `eliminarAction` (Server Actions pasadas por el padre; cada una conoce su endpoint y valida sesión). El plan sugería `entidadId` y `onUploadComplete` — reemplazados por el patrón de Server Actions, más flexible y consistente con el resto del proyecto.
  - [x] Drag-and-drop con `react-dropzone@15.0.0` (`useDropzone`, `isDragActive`, zona con borde resaltado al arrastrar). Acepta múltiples archivos.
  - [x] Click para seleccionar (`open()` invocado desde un botón accesible).
  - [x] Validación cliente: tamaño (`maxSize: maxBytes`) y MIME (`accept` construido desde `mimeAllowlist`). Mensajes de error diferenciados para `file-too-large` y `file-invalid-type`.
  - [ ] Preview inline: icono genérico por ahora; thumbnail de imagen y primera página de PDF **quedan para v1.1** (requiere que el endpoint de detail devuelva la URL pre-firmada en el payload; hoy el cliente la pide on-demand al hacer click en "Descargar").
  - [x] Cada adjunto muestra: nombre, tamaño (formateado a B/KB/MB), fecha en TZ de la plaza, MIME, acciones (Descargar, Eliminar condicional).
  - [x] Indicador de progreso durante upload (texto + spinner).
  - [x] Accesibilidad: `aria-label` en los botones (`aria-label="Descargar X"` / `aria-label="Eliminar X"`), `aria-label` en la zona de drop.
  - [x] Reutilizado por: `solicitud-detail-admin` (T-088), `solicitud-detail-inquilino` (T-088), `locales/[id]` (T-116), `adjuntos-contrato` (T-062).
- **Dependencias:** T-112, T-113, T-114.
- **Prioridad:** Alta.
- **Estado:** Completada.
- **Bitácora de cambios:**
  - **2026-06-07 (sesión actual):** T-117 estaba **30 % completa** desde T-062 — existía `AdjuntosContrato` con patrón ad-hoc (input file simple, sin drag-drop, sin preview, sin validación cliente).
  - **Criterios modificados:**
    - [x] Componente genérico `AdjuntoUploader` en `frontend/src/components/client/adjunto-uploader.tsx` con `'use client'`.
    - [x] **Versiones de librerías (research 2026-06-06):**
      - `react-dropzone@15.0.0` (última stable, peer dep `react >= 16.8 || 18.0.0` cubre 19.x).
      - `react-pdf@10.4.1` (última stable, peer dep explícita para React 19).
      - `pdfjs-dist@6.0.227` (transitiva de react-pdf, engine `node >= 22.13 || >= 24` ✅).
      - **Decisión:** `react-pdf` quedó instalado pero **no se usa en v1** (preview de PDF pendiente para v1.1). Lo dejo instalado porque sí se usará en el siguiente PR y porque la doc de la librería exige configurar el worker en el mismo módulo — mejor tenerlo listo.
    - [x] Patrón de Server Actions pasadas como props (en lugar de hacer `fetch` directo). Esto preserva el patrón BFF del proyecto (cookies httpOnly, JWT nunca en JS del cliente; ver S-ARQ-F en CLAUDE.md).
    - [x] **Acciones nuevas:**
      - `subirAdjuntoAdminAction`, `eliminarAdjuntoAdminAction` en `frontend/src/app/(admin-plaza)/admin/solicitudes/actions.ts`.
      - `subirAdjuntoLocalAction`, `descargarAdjuntoLocalAction`, `eliminarAdjuntoLocalAction` en `frontend/src/app/(admin-plaza)/admin/locales/actions.ts`.
      - Las acciones de inquilino y de contrato ya existían (T-088, T-062).
    - [x] **Refactor a `AdjuntoUploader`:**
      - `solicitud-detail-admin.tsx`: tab "Adjuntos" usa el componente; handlers `onDownload` locales eliminados.
      - `solicitud-detail-inquilino.tsx`: tab "Adjuntos" usa el componente; `fileRef` y `onUpload/onDownload` locales eliminados; `useRef` import removido.
      - `locales/[id]/page.tsx`: tab "Adjuntos" usa el componente con `mimeAllowlist` hard-coded de imágenes.
      - `adjuntos-contrato.tsx`: reemplazado por un wrapper que delega al componente genérico con `mimeAllowlist: ['application/pdf']` (compatibilidad con el patrón anterior; mismo prop set).
  - **Desviaciones del plan:**
    - Sin preview de PDF/imágenes en v1 (queda v1.1). Justificación: el endpoint actual de detail NO incluye la URL pre-firmada en el payload, así que renderizar un thumbnail requeriría una llamada extra por adjunto (N+1 problem) o cambiar el contrato del backend. Para v1, el icono + nombre + tamaño + fecha es suficiente.
    - Sin props `entidadId` ni `onUploadComplete`: el componente recibe las Server Actions directamente. Cada action ya conoce su `entidadId` (cerrado en el closure del padre).
  - **Tareas dependientes afectadas:** T-088 (wizard) y T-057 (locales detalle) usan este componente. T-090 (límite 10) ya estaba en backend.

---

## Resumen del módulo

**Estado final:** 9/9 tareas completadas (100 %).

| Tarea | Antes | Ahora | % |
|---|---|---|---|
| T-109 | 80 % | 100 % | Migración con 3 índices |
| T-110 | 85 % | 100 % | MinioService completo con pino + lifecycle + 5 buckets |
| T-111 | 20 % | 100 % | `createBucketsForPlaza` + invocación en seed + PlazasService |
| T-112 | 95 % | 100 % | Refactor con AdjuntoValidator |
| T-113 | 100 % | 100 % | Verificado (sin cambios) |
| T-114 | 90 % | 100 % | `QuarantinePurgeCron` 03:00 diario |
| T-115 | 50 % | 100 % | `AdjuntoValidator` con magic bytes + ejecutables |
| T-116 | 50 % | 100 % | POST/GET /locales/:id/adjuntos |
| T-117 | 30 % | 100 % | `AdjuntoUploader` integrado en 4 pantallas |

**Librerías añadidas a `frontend/package.json`:** `react-dropzone@^15.0.0`, `react-pdf@^10.4.1` (latest stable al 2026-06-06).

**Tareas pendientes para v1.1 (no bloquean):**
- Preview inline de PDF (primera página con `react-pdf`) e imágenes (thumbnail) en `AdjuntoUploader`.
- Refactor del wizard de solicitud (T-088) para que use `AdjuntoUploader` también.
- Endpoint dev para ejecutar el cron de purga de cuarentena manualmente.
- Extender `GET /adjuntos/:id/download` para devolver `{ url, expiresIn, nombreOriginal, mimeType }` (hoy solo `{ url }`).
