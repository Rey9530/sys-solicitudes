# Módulo 08 — Documentos Adjuntos

> **Propósito:** Cliente MinIO, buckets por tenant, upload a solicitud/local/contrato con validación MIME y de tamaño, download con URL pre-firmada (15 min), versionado simple, soft delete con movimiento a `quarantine-{plaza_id}` (30 días), y componente Client de upload con preview.
>
> **Pre-requisito:** T-001 a T-090 (incluye Solicitudes) deben estar `Completada`.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-109 | Crear migración Prisma con `adjunto` (polimórfico) | Alta | Pendiente |
| T-110 | Configurar cliente MinIO en NestJS | Alta | Pendiente |
| T-111 | Crear buckets por tenant (solicitudes-adjuntos-{plaza_id}, locales-planos-{plaza_id}, quarantine-{plaza_id}) | Alta | Pendiente |
| T-112 | Implementar POST /api/v1/solicitudes/:id/adjuntos (upload) | Alta | Pendiente |
| T-113 | Implementar GET /api/v1/adjuntos/:id/download con URL pre-firmada 15 min | Alta | Pendiente |
| T-114 | Implementar DELETE /api/v1/adjuntos/:id con soft delete + movimiento a quarantine | Alta | Pendiente |
| T-115 | Validar MIME cerrado (PDF/JPEG/PNG/WEBP/XLSX/DOCX/DWG) y 25 MB máx | Alta | Pendiente |
| T-116 | Implementar endpoints análogos para locales y contratos | Media | Pendiente |
| T-117 | Implementar componente Client de upload y preview en frontend | Alta | Pendiente |

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
- **Bitácora de cambios:** *(vacía)*

### T-110 — Configurar cliente MinIO en NestJS

- **Descripción:** Crear un servicio `MinioService` que envuelve el SDK de MinIO (compatible con S3). Configura el cliente con las credenciales del `.env` y expone métodos para `upload`, `download`, `getPresignedUrl`, `delete`, `moveTo`. Materializa S-MinIO.
- **Criterios de aceptación:**
  - [ ] `backend/src/common/minio/minio.service.ts` con `@Injectable()` y la lógica.
  - [ ] Configurado con `endPoint`, `port`, `useSSL`, `accessKey`, `secretKey` desde env.
  - [ ] Singleton (un cliente por proceso).
  - [ ] Métodos: `upload(bucket, key, buffer, mimeType)`, `getPresignedUrl(bucket, key, expiresInSeconds)`, `delete(bucket, key)`, `move(bucket, sourceKey, destBucket, destKey)`, `bucketExists(bucket)`, `createBucketIfNotExists(bucket)`.
  - [ ] Logger `pino` para cada operación.
  - [ ] Manejo de errores: traduce errores de MinIO a excepciones NestJS.
  - [ ] Test local: subir un PDF de prueba al bucket `test-{plaza_id}` y descargarlo.
- **Dependencias:** T-006, T-009, T-013.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Bitácora de cambios:** *(vacía)*

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
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
  - [ ] El `GET /solicitudes/:id/adjuntos` excluye soft-deleted por defecto.
  - [ ] RLS probado.
- **Dependencias:** T-109, T-110, T-111, T-098 (cron pattern).
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-115 — Validar MIME cerrado (PDF/JPEG/PNG/WEBP/XLSX/DOCX/DWG) y 25 MB máx

- **Descripción:** Implementar el validador `AdjuntoValidator` reutilizable que valida MIME y tamaño contra la `configuracion` de la plaza. La lista de MIME permitidos por defecto se configura en T-037, pero el admin puede ajustarla. Materializa S-TamañoMax, S-MimeTypes.
- **Criterios de aceptación:**
  - [ ] `backend/src/modules/adjuntos/validators/adjunto.validator.ts` con métodos `validateMime(buffer, mimeType, allowed)` y `validateSize(buffer, maxMb)`.
  - [ ] Validación por magic bytes (no solo por extensión del filename):
    - PDF: `%PDF-`
    - JPEG: `FF D8 FF`
    - PNG: `89 50 4E 47`
    - WEBP: `RIFF...WEBP`
    - XLSX/DOCX: `PK` (ZIP)
    - DWG: `AC10` (primer 4 bytes)
  - [ ] Si MIME no está en la lista permitida → `400 ADJUNTO_MIME_INVALIDO`.
  - [ ] Si tamaño > `tamanio_max_archivo_mb` → `413 ADJUNTO_TAMANO_EXCEDIDO`.
  - [ ] Lista cerrada de MIME (configuración por defecto): `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/dwg`, `application/acad` (alternativa para DWG).
  - [ ] Rechaza ejecutables: `.exe`, `.bat`, `.sh`, `.msi`, `.com` → `400 EJECUTABLE_NO_PERMITIDO`.
  - [ ] Test con archivo mal nombrado (e.g. `virus.pdf.exe`) → rechazado.
- **Dependencias:** T-044 (en `03-plazas-multitenant.md`).
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-117 — Implementar componente Client de upload y preview en frontend

- **Descripción:** Implementar el componente Client `<AdjuntoUploader>` con drag-and-drop, validación previa (tamaño, MIME por extensión), preview de imagen/PDF, lista de adjuntos subidos con acciones, y manejo de errores. Materializa S-Preview.
- **Criterios de aceptación:**
  - [ ] `frontend/components/client/adjunto-uploader.tsx` (`"use client"`).
  - [ ] Props: `entidadTipo`, `entidadId`, `maxFiles` (default 10), `onUploadComplete?`.
  - [ ] Drag-and-drop o click para seleccionar. Acepta múltiples archivos.
  - [ ] Validación cliente: tamaño (con `configuracion.tamanio_max_archivo_mb`) y MIME (lista visual).
  - [ ] Preview inline:
    - Imágenes: thumbnail.
    - PDF: icono + primera página renderizada con `<canvas>` o `react-pdf`.
    - Otros: icono genérico.
  - [ ] Cada adjunto muestra: nombre, tamaño, fecha, acciones (descargar, eliminar).
  - [ ] Indicador de progreso durante upload.
  - [ ] Al cerrar, llama a `onUploadComplete(listaAdjuntos)`.
  - [ ] Accesibilidad: soporte de teclado, `aria-label` en los botones.
  - [ ] Reutilizado por T-088 (solicitudes), T-057 (locales), T-060 (contratos).
- **Dependencias:** T-112, T-113, T-114.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*
