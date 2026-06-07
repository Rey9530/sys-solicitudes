# Módulo 09 — Notificaciones por Email

> **Propósito:** SMTP con Nodemailer, 8+ plantillas HTML por evento, cola en `email_log`, worker con `@nestjs/schedule` cada 1 min con reintentos exponenciales 1m/5m/30m, deduplicación `(solicitud_id, destinatario, evento)`, manejo de hard bounce (marca `usuario.email_invalido`), link unsubscribe en emails no críticos, log visible al admin, reintento manual.
>
> **Pre-requisito:** T-001 a T-108 (incluye state machine de solicitudes) deben estar `Completada`.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-118 | Crear migración Prisma con `email_log` | Alta | Completada |
| T-119 | Configurar Nodemailer con SMTP en NestJS | Alta | Completada |
| T-120 | Crear 8+ plantillas HTML por evento en backend/src/templates/ | Alta | Completada |
| T-121 | Implementar servicio de envío con cola en email_log | Alta | Pendiente |
| T-122 | Implementar worker con @nestjs/schedule cada 1 min + reintentos 1m/5m/30m | Alta | Pendiente |
| T-123 | Implementar deduplicación (solicitud_id, destinatario, evento) | Alta | Pendiente |
| T-124 | Implementar manejo de hard bounce → email_invalido=true en usuario | Media | Pendiente |
| T-125 | Implementar link unsubscribe en emails no críticos | Media | Pendiente |
| T-126 | Disparar emails en cada transición de solicitud (T1–T12) | Alta | Pendiente |
| T-127 | Implementar pantalla /admin/notificaciones (log + reintento manual) | Media | Pendiente |

---

### T-118 — Crear migración Prisma con `email_log`

- **Descripción:** Crear el modelo `email_log`: `id` (UUID), `plaza_id` (FK), `destinatario` (TEXT, email), `plantilla` (TEXT, nombre del template), `variables` (JSONB, render final), `estado` (ENUM: `pendiente`, `enviado`, `fallido`), `reintentos` (INT default 0), `last_error` (TEXT), `sent_at` (TIMESTAMPTZ nullable), `created_at`. Materializa `docs/04` §1.1.
- **Criterios de aceptación:**
  - [ ] Modelo `email_log` con todos los campos.
  - [ ] ENUM `email_log_estado` (pendiente, enviado, fallido).
  - [ ] Índices: `INDEX(plaza_id, estado, created_at)`, `INDEX(destinatario)`, `INDEX(estado, reintentos)` (para worker).
  - [ ] Migración aplicada.
  - [ ] CHECK constraint: `estado = 'enviado' IMPLIES sent_at IS NOT NULL` (RI-4).
  - [ ] RLS habilitado.
- **Dependencias:** T-018, T-036, T-038.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — Completada sobre la versión MÍNIMA que ya existía de T-056 (modelo creado en la migración del módulo 04 con RLS habilitado). La migración `20260607211520_modulo_09_email_log_v2` AGREGA lo faltante en vez de crear la tabla: ENUM `email_log_estado` (conversión `TEXT → ENUM` con `USING`, sin pérdida de datos), columnas `solicitud_id` (FK a solicitud, `ON DELETE SET NULL`) y `next_retry_at` (TIMESTAMPTZ, para backoff del worker), índices `(plaza_id, estado, created_at)`, `(destinatario)` y CHECK RI-4 (`estado <> 'enviado' OR sent_at IS NOT NULL`).
  - ⚠️ Desviación: se añadió un índice extra `(solicitud_id, destinatario, plantilla)` no pedido en el plan — soporta la query de deduplicación de T-123 (el plan solo pedía índices para el worker).
  - ⚠️ Desviación: el plan pedía `solicitud_id` implícito (lo usa T-123) pero el modelo del plan en T-118 no lo listaba como campo; se agregó aquí porque la dedup lo requiere a nivel de columna indexable.
  - Migración creada A MANO (carpeta con timestamp UTC) porque `prisma migrate dev` en modo no interactivo aborta ante el warning de conversión de `estado`; aplicada con `prisma migrate deploy` y verificada con `prisma migrate diff --exit-code` (sin drift) + `\d email_log`.

### T-119 — Configurar Nodemailer con SMTP en NestJS

- **Descripción:** Configurar Nodemailer como transporter SMTP. Usa las variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_SECURE` del `.env`. En dev usa MailHog (`localhost:1025`). Materializa S-NE-C.
- **Criterios de aceptación:**
  - [ ] `backend/src/common/mailer/mailer.service.ts` con `@Injectable()`.
  - [ ] Configurado vía `MailerModule.forRootAsync` en `app.module.ts`.
  - [ ] `transporter` con `host`, `port`, `secure`, `auth` (cuando aplica).
  - [ ] `defaultFrom` = `SMTP_FROM` (e.g. "Plazapp <noreply@plazapp.com>").
  - [ ] Test: enviar un email de prueba en dev y verificar en MailHog UI (`http://localhost:8025`).
  - [ ] Test: en prod (variable `NODE_ENV=production`), se conecta al SMTP real (e.g. SendGrid) con TLS.
  - [ ] Logger `pino` con el subject y destinatario (NO con el body).
  - [ ] Manejo de errores: `InvalidAuth`, `ConnectionTimeout`, `RecipientsRefused`.
- **Dependencias:** T-006, T-009, T-013.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — `backend/src/common/mailer/` con `mailer.module.ts` (dinámico, `@Global()`), `mailer.service.ts` y `mailer.types.ts`. Registrado vía `MailerModule.forRootAsync({ inject: [ConfigService], useFactory })` en `app.module.ts` leyendo `SMTP_HOST/PORT/SECURE/USER/PASSWORD/FROM` (ya existían en `.env.example` desde T-V14).
  - ⚠️ Decisión: MailerModule PROPIO en vez del paquete `@nestjs-modules/mailer` (v2.3.6 verificada en npm). Motivos: (1) el plan solo exige Nodemailer; (2) T-124 necesita el error crudo del transporter (`responseCode` 550/551/553) para clasificar hard bounces, que el wrapper oculta; (3) cero dependencias nuevas — `nodemailer@8.0.10` ya estaba instalada. El criterio "MailerModule.forRootAsync" se cumple literalmente con el módulo propio.
  - `MailerService.send(to, subject, html)` lanza `MailerSendError` clasificado: `invalid_auth` (EAUTH), `connection_timeout` (ETIMEDOUT/ECONNECTION/ESOCKET), `recipients_refused` (EENVELOPE), `hard_bounce` (responseCode 550/551/553), `unknown`. Logging con subject+destinatario, nunca el body.
  - Test dev: envío de prueba contra MailHog OK (`250 Ok: queued`) y verificado en `http://localhost:8025` (API v2). El test contra SMTP real de producción queda pendiente de S-Deploy (no hay proveedor SMTP confirmado — supuesto del kickoff).
  - El `MailerService` provisional de `auth/services/` se reemplaza en T-126 (migración híbrida).

### T-120 — Crear 8+ plantillas HTML por evento en backend/src/templates/

- **Descripción:** Crear las plantillas HTML de email para cada evento. Usar un motor de plantillas simple (Handlebars o Mustache) para inyectar variables. Cada plantilla incluye el header con branding de la plaza (logo, color). Materializa S-NE-A.
- **Criterios de aceptación:**
  - [ ] `backend/src/modules/notificaciones/templates/` con 9+ archivos `.html`:
    - `solicitud-asignada-responsable.html` (T-081)
    - `solicitud-nueva-supervisor.html` (T-081, supervisores)
    - `solicitud-recibida.html` (T-092, T-104, bandeja de admin)
    - `solicitud-aprobada.html` (T-094, al inquilino)
    - `solicitud-rechazada.html` (T-095, al inquilino)
    - `solicitud-subsanacion.html` (T-096, al inquilino)
    - `solicitud-reasignada.html` (T-097, al nuevo responsable)
    - `reset-password.html` (T-029, al usuario)
    - `bienvenida.html` (al crear usuario, T-034)
    - `contrato-por-vencer.html` (T-056, al admin_plaza)
  - [ ] Cada plantilla tiene header con `{{plaza.nombreComercial}}`, `{{plaza.logoUrl}}`, color primario como variable CSS.
  - [ ] Cada plantilla tiene footer con link de unsubscribe (excepto reset-password, solicitud-aprobada, solicitud-rechazada, solicitud-subsanacion).
  - [ ] Helper `TemplateRendererService` que recibe `(plantilla, variables)` y retorna HTML.
  - [ ] Test: renderizar cada plantilla con datos de prueba y verificar el output (puede ser snapshot test).
  - [ ] Tamaño máx de cada plantilla renderizada: 100 KB.
- **Dependencias:** T-041, T-042, T-043.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — Motor elegido: **Handlebars 4.7.9** (verificada como latest en npm; decisión confirmada por el owner — vs Mustache 4.2.0 — por helpers/parciales para el branding compartido). 10 plantillas en `backend/src/modules/notificaciones/templates/` + 2 parciales (`_header.html` con `{{plaza.nombreComercial}}`/`{{plaza.logoUrl}}`/`{{plaza.colorPrimario}}`, `_footer.html` con `{{#if unsubscribeUrl}}`).
  - ⚠️ Desviación menor: el plan ubicaba las plantillas en `backend/src/templates/` (título) pero los criterios dicen `backend/src/modules/notificaciones/templates/` — se usó esta última (consistente con la estructura de módulos).
  - Nuevo `email-templates.registry.ts`: fuente única de verdad por plantilla (`subject` Handlebars, `critico`, `unsubscribe`) — lo consumen T-121 (esCritico default), T-122 (subject del worker) y T-125 (footer).
  - `TemplateRendererService.render(plantilla, variables)` → `{ subject, html }`, cache de compilación, parciales auto-registrados (archivos `_*.html`), warning si el render supera 100 KB.
  - ⚠️ `tsc` no copia `.html` al `dist/`: se añadió `scripts/copy-templates.mjs` al script `build` del backend, con fallback del renderer a `src/` para watch/ts-node.
  - Verificación: render de las 10 plantillas con datos de prueba — todas < 2.5 KB, subjects correctos, HTML inyectado en variables queda escapado (Handlebars `{{}}`).

### T-121 — Implementar servicio de envío con cola en email_log

- **Descripción:** Implementar `EmailService.sendEmail(plantilla, destinatario, variables, opts?)` que encola el email en `email_log` con `estado: 'pendiente'`. NO envía directamente; el worker (T-122) lo procesa.
- **Criterios de aceptación:**
  - [ ] `backend/src/modules/notificaciones/email.service.ts` con método `sendEmail(plantilla, destinatario, variables, opts?)`.
  - [ ] `opts` puede tener `solicitudId`, `esCritico` (bool), `deduplicable` (bool, default true).
  - [ ] Inserta en `email_log` con `estado: 'pendiente'`, `reintentos: 0`.
  - [ ] Si `deduplicable` y ya existe un `email_log` con `(solicitudId, destinatario, plantilla, estado IN ('pendiente', 'enviado'))` en las últimas 24h, no inserta (T-123).
  - [ ] Si `destinatario` es un usuario con `email_invalido = true` y `esCritico = false`, NO encola.
  - [ ] Si `esCritico = true`, encola aunque `email_invalido = true` (esenciales: reset, aprobada, rechazada, subsanacion).
  - [ ] Retorna el ID del `email_log` insertado.
- **Dependencias:** T-118, T-119, T-120.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — `backend/src/modules/notificaciones/email.service.ts` con `sendEmail(plantilla, destinatario, variables, opts)`. `opts = { plazaId, solicitudId?, esCritico?, deduplicable?, tx? }`.
  - ⚠️ Desviación de firma: se añadió `opts.plazaId` (obligatorio — `email_log.plaza_id` es NOT NULL y el plan no decía de dónde salía) y `opts.tx` para unirse a la transacción del caller (regla del módulo 06/07: estado + historial + email atómicos). Sin `tx` usa `PrismaAdminService` (flujos pre-sesión/cron).
  - `esCritico` default viene del registro de plantillas (T-120) en vez de ser solo un boolean del caller — los 4 críticos del plan (reset, aprobada, rechazada, subsanacion) están marcados en el registro; el caller puede hacer override.
  - Bloqueos antes de insertar: `email_invalido` (no críticos), desuscripción T-125 (no críticos), dedup T-123. Retorna el ID insertado, el ID existente (dedup) o `null` (bloqueado).
  - `SolicitudStateService.enqueueEmail` ahora DELEGA en `EmailService` (firma extendida con `solicitudId/esCritico/deduplicable`): los 6 call sites de los módulos 04-07 heredan dedup y bloqueos sin cambios. `SolicitudStateModule` importa `NotificacionesModule` (sin ciclos: EmailService es hoja).

### T-122 — Implementar worker con @nestjs/schedule cada 1 min + reintentos 1m/5m/30m

- **Descripción:** Implementar un cron worker que cada 1 min procese los `email_log` con `estado: 'pendiente'` o `estado: 'fallido'`. Renderiza la plantilla, envía vía SMTP, y actualiza el estado. Implementa reintentos con backoff exponencial: 1m, 5m, 30m. Después de 3 reintentos, marca como `fallido` permanente. Materializa S-NE-B y `docs/03` §3.8.
- **Criterios de aceptación:**
  - [ ] `backend/src/modules/notificaciones/cron/email-worker.cron.ts` con `@Cron('*/1 * * * *')`.
  - [ ] Query: `SELECT id, destinatario, plantilla, variables, reintentos, plaza_id FROM email_log WHERE estado = 'pendiente' OR (estado = 'fallido' AND reintentos < 3 AND next_retry_at < now()) LIMIT 50`.
  - [ ] Para cada uno:
    1. Renderizar plantilla.
    2. Enviar vía SMTP.
    3. Si 250 OK: `estado = 'enviado'`, `sent_at = now()`.
    4. Si error: `reintentos = reintentos + 1`, `last_error = <msg>`, `next_retry_at = now() + INTERVAL '<X>'` (1m, 5m, 30m según reintentos). Si `reintentos >= 3`, `estado = 'fallido'`.
  - [ ] Si el error es hard bounce (e.g. `550 User unknown`), marca `usuario.email_invalido = true` (T-124).
  - [ ] Lock por ID para evitar procesamiento concurrente (en multi-instancia).
  - [ ] Logging con `pino`: cantidad enviados, fallidos, rate.
  - [ ] El worker es idempotente: si se interrumpe a mitad, los pendientes se reprocesan.
- **Dependencias:** T-118, T-119, T-120, T-121, T-123.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-123 — Implementar deduplicación (solicitud_id, destinatario, evento)

- **Descripción:** Implementar la deduplicación para evitar emails duplicados por la misma transición, destinatario y evento. Por ejemplo, no enviar 5 emails al responsable si la solicitud se reasigna 5 veces en 1 min. Materializa RN-NE-6.
- **Criterios de aceptación:**
  - [ ] En `EmailService.sendEmail`, si `opts.solicitudId` y `opts.deduplicable !== false`:
    - Query: `SELECT id FROM email_log WHERE solicitud_id = ? AND destinatario = ? AND plantilla = ? AND estado IN ('pendiente', 'enviado') AND created_at > now() - INTERVAL '24 hours'`.
    - Si existe, retornar el ID existente (no insertar).
  - [ ] Si `deduplicable = false` (e.g. recordatorio de contraseña), siempre inserta.
  - [ ] Test: enviar 3 veces el mismo email en 1 min → solo 1 fila en `email_log`, 2 son deduped.
  - [ ] El segundo y tercer envío retornan el ID del primero (con log `deduplicated`).
- **Dependencias:** T-121.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — Implementada dentro de `EmailService.sendEmail` (T-121): query `findFirst` sobre `email_log` por `(solicitud_id, destinatario, plantilla, estado IN (pendiente, enviado), created_at > now()-24h)`; si existe retorna el ID con log `deduplicated`, si no inserta. `deduplicable=false` salta el check. Índice de soporte `(solicitud_id, destinatario, plantilla)` creado en T-118.
  - La dedup solo aplica cuando hay `solicitudId` (igual que el plan): emails sin solicitud (bienvenida, reset) no se deduplican por esta vía.

### T-124 — Implementar manejo de hard bounce → email_invalido=true en usuario

- **Descripción:** Cuando el SMTP retorna un error de hard bounce (e.g. `550 User unknown`, `551 User not local`, `553 Mailbox name not allowed`), marcar `usuario.email_invalido = true` para no enviar más emails no críticos a esa dirección. Materializa S-Bounce y RN-NE-2.
- **Criterios de aceptación:**
  - [ ] En el worker (T-122), clasificar el error de SMTP.
  - [ ] Si el código es hard bounce (550, 551, 553), hacer `UPDATE usuario SET email_invalido = true WHERE email = ?` en una transacción separada.
  - [ ] Emails críticos (reset, aprobada, rechazada, subsanacion) SÍ se envían aunque `email_invalido = true`.
  - [ ] Emails no críticos (resto) NO se encolan si `email_invalido = true` (T-121 lo bloquea).
  - [ ] El admin puede ver `email_invalido` en la lista de usuarios y resetearlo manualmente si corrige la dirección.
  - [ ] Logging: cada hard bounce se registra con el código SMTP y el `usuario_id`.
- **Dependencias:** T-122, T-018.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-125 — Implementar link unsubscribe en emails no críticos

- **Descripción:** En cada email no crítico, incluir un link de desuscripción. El link apunta a una URL del backend que marca al usuario como "no recibir más emails de tipo X". Materializa S-Unsubscribe y RN-NE-4.
- **Criterios de aceptación:**
  - [ ] Helper en el renderer (T-120) que inyecta el link `{{unsubscribeUrl}}` en el footer de las plantillas que lo incluyan.
  - [ ] `GET /api/v1/notificaciones/unsubscribe?token=<jwt>` que valida el token (HMAC del email + tipo), marca en una tabla `unsubscribe` (o columna JSONB en `usuario`) y retorna una página HTML de confirmación.
  - [ ] `EmailService.sendEmail` consulta la tabla antes de encolar y, si el usuario está desuscrito, no encola.
  - [ ] Emails críticos (reset-password, solicitud-aprobada, solicitud-rechazada, solicitud-subsanacion) NO tienen link de unsubscribe.
  - [ ] El admin puede ver y resetear las desuscripciones desde `/admin/notificaciones` (T-127).
- **Dependencias:** T-121, T-120.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-126 — Disparar emails en cada transición de solicitud (T1–T12)

- **Descripción:** Integrar `EmailService.sendEmail` con `SolicitudStateService` (T-091) para que cada transición dispare los emails correspondientes. Materializa `docs/05` §2.3.
- **Criterios de aceptación:**
  - [ ] Tabla interna de emails por transición:
    - T-081 (enviar): responsable (`asignada-responsable`) + supervisores (`nueva-supervisor`, deduplicado).
    - T-092 (tomar): admin que tomó (`recibida`).
    - T-094 (aprobar): inquilino (`aprobada`).
    - T-095 (rechazar): inquilino (`rechazada`).
    - T-096 (subsanar): inquilino (`subsanacion`).
    - T-097 (reasignar): nuevo responsable (`reasignada`).
    - T-104 (subsanar): responsable (`recibida` o `asignada-responsable`).
  - [ ] Cada email se encola (no se envía) en la misma transacción que el cambio de estado.
  - [ ] Variables de la plantilla pobladas con datos de la solicitud.
  - [ ] Test: enviar 1 solicitud completa y verificar que se encolan los emails correctos.
- **Dependencias:** T-091, T-121, T-123.
- **Prioridad:** Alta.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

### T-127 — Implementar pantalla /admin/notificaciones (log + reintento manual)

- **Descripción:** Pantalla del admin para ver el log de emails enviados, fallidos y pendientes, con filtros y acción de reintento manual. Materializa CU-NE-6.
- **Criterios de aceptación:**
  - [ ] `/admin/notificaciones` con tabla shadcn DataTable.
  - [ ] Columnas: destinatario, plantilla (con icono), estado (badge), reintentos, error (tooltip), created_at, sent_at.
  - [ ] Filtros: estado (pendiente/enviado/fallido), plantilla, destinatario, fecha desde/hasta.
  - [ ] Acción "Reintentar" en filas con `estado = 'fallido'`: `POST /api/v1/notificaciones/:id/reintentar` que resetea `reintentos = 0` y `next_retry_at = now()` para que el worker lo reprocese.
  - [ ] Acción "Ver contenido" abre modal con el HTML renderizado.
  - [ ] Solo `admin_plaza` (de su plaza) y `superadmin` (todas) pueden acceder.
  - [ ] RLS probado.
- **Dependencias:** T-118, T-122.
- **Prioridad:** Media.
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*
