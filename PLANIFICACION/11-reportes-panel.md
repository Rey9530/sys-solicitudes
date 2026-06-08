# Módulo 11 — Reportes y Panel Administrativo

> **Propósito:** jsreport 4.13 como contenedor Docker separado (BFF proxy desde el backend), 6 plantillas inline (solicitudes/locales/inquilinos × PDF/XLSX), CSV generado inline, 3 KPIs principales, snapshot precalculado cada 15 min, dashboard con `recharts`, y pantalla de configuración de plaza.
>
> **Pre-requisito:** T-001 a T-134 (incluye Calendario) deben estar `Completada`.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-135 | Levantar jsreport 4.13 como contenedor Docker y verificar conexión | Alta | Completada |
| T-136 | Implementar cliente BFF HTTP a jsreport desde backend | Alta | Completada |
| T-137 | Crear 6 plantillas inline (solicitudes/locales/inquilinos × PDF/XLSX) | Alta | Completada |
| T-138 | Implementar GET /api/v1/reportes/{entidad}/export.csv (inline) | Alta | Completada |
| T-139 | Implementar GET /api/v1/reportes/{entidad}/export.xlsx | Alta | Completada |
| T-140 | Implementar GET /api/v1/reportes/{entidad}/export.pdf | Alta | Completada |
| T-141 | Implementar KPIs: pendientes, aprobadas_hoy, rechazadas_hoy, eventos_proximos, contratos_por_vencer | Alta | Completada |
| T-142 | Implementar cron de kpi_snapshot cada 15 min | Media | Completada |
| T-143 | Implementar dashboard /admin/dashboard con recharts | Alta | Completada |
| T-144 | Implementar pantalla /admin/reportes con filtros | Alta | Completada |
| T-145 | Implementar pantalla /admin/configuracion (SLA, MIME, tamaño) | Alta | Completada |

---

### T-135 — Levantar jsreport 4.13 como contenedor Docker y verificar conexión

- **Descripción:** Verificar que jsreport 4.13 está corriendo en el `docker-compose.yml` (T-006) y que el backend puede hacer requests a `http://jsreport:5488`. Configurar las recipes `chrome-pdf` y `xlsx`. Materializa S-JSReport.
- **Criterios de aceptación:**
  - [ ] `docker-compose ps` muestra `jsreport` corriendo en puerto 5488.
  - [ ] `curl http://localhost:5488/api/ping` retorna OK (jsreport 4.13 expone `/api/ping`).
  - [ ] `curl http://localhost:5488/odata/templates` lista las plantillas (vacío al inicio).
  - [ ] En `jsreport.config.json` del contenedor, configurar `recipes: { chrome-pdf: { launchOptions: { args: ['--no-sandbox'] } } }` (necesario en Docker).
  - [ ] Variable `JSREPORT_URL` en `.env` del backend.
  - [ ] Test: renderizar un HTML simple vía API devuelve PDF.
- **Dependencias:** T-006, T-009.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — Verificado: jsreport **4.13.0** sigue siendo la última versión estable (npm y Docker Hub) — la decisión S-JSReport queda sin desviación. `/api/ping` 200, `/odata/templates` accesible, render de prueba chrome-pdf → PDF válido. `JSREPORT_URL/USER/PASSWORD` ya existían en `.env` (T-006).
  - ⚠️ Fix en `docker-compose.yml`: la env `chrome_launchOptions_args_no_sandbox=true` (T-006) era INVÁLIDA para el schema de jsreport 4.13 (el contenedor quedaba en crash-loop con "rootOptions.chrome.launchOptions.args should be string/array"). Formato correcto: `chrome_launchOptions_args=--no-sandbox,--disable-dev-shm-usage`. Se añadieron además las envs de autenticación del API (`extensions_authentication_*`) para que el Basic Auth de T-136 funcione.
  - ⚠️ La config se hace por ENV del contenedor, no editando `jsreport.config.json` interno (equivalente soportado y versionable en compose).

### T-136 — Implementar cliente BFF HTTP a jsreport desde backend

- **Descripción:** Implementar un `JsreportService` que haga de proxy BFF con `fetch` nativo de Node 24. NO instala `@jsreport/nodejs-client` ni `puppeteer` ni `exceljs` ni `pdfkit`. Las plantillas se sirven desde `backend/src/modules/reportes/templates/`. Materializa S-JSReport.
- **Criterios de aceptación:**
  - [ ] `backend/src/modules/reportes/jsreport.service.ts` con `@Injectable()`.
  - [ ] Métodos: `renderPdf(template, data)`, `renderXlsx(template, data)`, `uploadTemplate(name, content)`, `ensureTemplate(name, content)`.
  - [ ] Usa `fetch` nativo (Node 24).
  - [ ] `renderPdf` hace POST a `{JSREPORT_URL}/api/report` con `{ template: { name }, data, options: { recipe: 'chrome-pdf', ... } }` y retorna el buffer del PDF.
  - [ ] `renderXlsx` similar con `recipe: 'xlsx'`.
  - [ ] `ensureTemplate` hace POST a `{JSREPORT_URL}/api/templates` con `{ name, content, engine: 'handlebars', recipe: 'chrome-pdf' }` solo si no existe. Usa Basic Auth con `JSREPORT_USER:JSREPORT_PASSWORD` (default `admin:password`).
  - [ ] Manejo de errores: traduce errores de jsreport a `502 JSREPORT_ERROR` con código de domino.
  - [ ] Test: renderizar un PDF de prueba con datos dummy.
  - [ ] No se instala ninguna lib de generación en el backend.
- **Dependencias:** T-135, T-009.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — `jsreport.service.ts` con `fetch` nativo de Node 24 y Basic Auth. Métodos `renderPdf/renderXlsx` (POST `/api/report` por NOMBRE de plantilla persistida — la recipe vive en la plantilla), `ensureTemplate`, `uploadTemplate`, `ensureTemplates` (todas las del registro). Cero librerías de generación instaladas (criterio cumplido; `@jsreport/nodejs-client` ni evaluado: el plan lo prohíbe).
  - ⚠️ Desviación de API: las plantillas se crean/actualizan vía **`/odata/templates`** — el `/api/templates` del plan no existe en jsreport 4.x. `ensureTemplate` además ACTUALIZA (PATCH) si el contenido difiere (el plan decía "solo si no existe"); mantiene dev iterable sin tocar el nombre versionado.
  - Errores de jsreport → `502 JSREPORT_ERROR` (RFC 7807) con log del detalle; si jsreport está caído al arranque, el backend inicia igual y reintenta en el primer render.
  - Plantillas chrome-pdf llevan opciones de página (márgenes + footer con paginación/fecha vía `displayHeaderFooter`).
  - ⚠️ actualización 2026-06-07 (fix licencia jsreport) — Se eliminó el render **por nombre de plantilla persistida** y se cambió a render **INLINE**: `render()` ahora envía `template: { content, engine, recipe, chrome }` (contenido leído de disco y cacheado en memoria) en cada `/api/report`. Motivo: la licencia gratuita de jsreport limita a **5 plantillas persistidas** y el registro tiene 8 → al entrar al portal mostraba "Free license is limited to maximum 5 templates" y activaba el trial de 1 mes. El render inline NO cuenta contra ese límite. Se eliminaron los métodos `ensureTemplate`/`ensureTemplates`/`uploadTemplate`/`jsreportName`, el `OnModuleInit` y el flujo `/odata/templates`. La interfaz pública (`renderPdf`/`renderXlsx`) no cambió; `reportes.service.ts` intacto. Las plantillas `.html` en `templates/` siguen siendo la única fuente de verdad (ya estaban en git).

### T-137 — Crear 6 plantillas inline (solicitudes/locales/inquilinos × PDF/XLSX)

- **Descripción:** Crear las 6 plantillas de reporte con Handlebars, en `backend/src/modules/reportes/templates/`. Cada par PDF/XLSX usa la misma fuente de datos. El template se sube a jsreport al arranque (idempotente). Materializa S-RE-D.
- **Criterios de aceptación:**
  - [ ] 6 archivos HTML en `backend/src/modules/reportes/templates/`:
    - `solicitudes-pdf.html` (chrome-pdf)
    - `solicitudes-xlsx.html` (xlsx, tabla con rows)
    - `locales-pdf.html`
    - `locales-xlsx.html`
    - `inquilinos-pdf.html`
    - `inquilinos-xlsx.html`
  - [ ] Cada plantilla usa Handlebars para iterar `{{#each items}}` y mostrar los datos.
  - [ ] Header con branding de la plaza (logo + nombre).
  - [ ] Footer con paginación y fecha de generación.
  - [ ] Al arrancar el backend (`onModuleInit`), `JsreportService.ensureTemplate` sube cada plantilla a jsreport (idempotente).
  - [ ] Las plantillas NO se persisten en jsreport entre reinicios del contenedor (porque jsreport usa un volumen, sí persisten). Decisión: usar nombres versionados (`solicitudes-pdf-v1.html`) y permitir que el backend los suba de nuevo.
- **Dependencias:** T-136, T-120, T-041.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — **8 plantillas** (no 6 — decisión owner: + `local-detalle-pdf` y `inquilino-detalle-pdf` para los reportes por :id de T-140) en `backend/src/modules/reportes/templates/`, Handlebars `{{#each items}}`, header con branding (`{{plaza.nombreComercial}}`/logo/color) y footer chrome con paginación + fecha.
  - ⚠️ Desviación de recipe: los XLSX usan **`html-to-xlsx`** (tabla HTML → xlsx), no `xlsx` como decía el plan — la recipe `xlsx` de jsreport es para plantillas .xlsx binarias con macros, incompatible con "tabla con rows" del criterio. Verificado con render real (PK zip válido). ⚠️ El `htmlEngine: cheerio` no está en la imagen oficial (error 400 al renderizar): se usa el default (chrome).
  - Subida al arranque (`JsreportService.onModuleInit`), idempotente, nombres versionados `plazapp-{key}-v1`. Verificado: las 8 aparecen en `/odata/templates` tras el boot.
  - ⚠️ actualización 2026-06-07 (fix licencia jsreport) — Las 8 plantillas YA NO se persisten en jsreport (se renderizan inline; ver T-136). Se borraron las 8 `plazapp-*-v1` del store del contenedor (`DELETE /odata/templates(...)`, 204 c/u) para que el conteo vuelva a 0 y desaparezca el aviso de trial/licencia. El criterio "subir al arranque" queda derogado por este fix.
  - `scripts/copy-templates.mjs` extendido para copiar también estas plantillas al `dist/`.

### T-138 — Implementar GET /api/v1/reportes/{entidad}/export.csv (inline)

- **Descripción:** Implementar la exportación a CSV inline (sin pasar por jsreport, generado en el backend). UTF-8 con BOM, coma como separador, headers según la entidad. Materializa RN-RE-3.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/reportes/solicitudes/export.csv?filtros` con `@Roles('admin_plaza', 'superadmin')`.
  - [ ] Similar para `/locales/export.csv` y `/inquilinos/export.csv`.
  - [ ] Content-Type: `text/csv; charset=utf-8`, Content-Disposition: `attachment; filename="{entidad}-{YYYYMMDD}.csv"`.
  - [ ] Encoding: UTF-8 con BOM (`﻿`).
  - [ ] Headers según entidad (ej. solicitudes: código, tipo, título, local, estado, prioridad, enviada_at, decision_at, asignado_a).
  - [ ] Filtros validados con Zod.
  - [ ] Streaming con `Readable` para no cargar todo en memoria si es muy grande.
  - [ ] Rango máximo: 12 meses en vista rápida (S-Exportación). Si excede, retorna `413 RANGO_EXCEDIDO`.
  - [ ] RLS probado.
- **Dependencias:** T-080, T-051, T-053.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — `GET /api/v1/reportes/{entidad}/export.csv` para solicitudes/locales/inquilinos, `@Roles('admin_plaza','superadmin')` (inquilino 403, S-RE-A verificado). Headers y filename `{entidad}-{YYYYMMDD}.csv` correctos; BOM UTF-8 verificado byte a byte (`EF BB BF`); escape RFC 4180; streaming con `Readable.from(generator)` → `stream.pipe(res)`.
  - Filtros Zod por entidad en `packages/contracts/src/reportes/` (la validación se resuelve en el controller según el param `:entidad`).
  - Rango 12 meses: verificado `413 RANGO_EXCEDIDO` con un rango de 29 meses. ⚠️ Sin fechas se asume "últimos 12 meses" (vista rápida); el límite aplica solo a solicitudes — locales/inquilinos son catálogos sin dimensión temporal.
  - Columnas de solicitudes según el plan: código, tipo, título, local, estado, prioridad, enviada_at, decision_at, asignado_a.

### T-139 — Implementar GET /api/v1/reportes/{entidad}/export.xlsx

- **Descripción:** Implementar la exportación a XLSX usando jsreport (recipe `xlsx`). Materializa RN-RE-4.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/reportes/solicitudes/export.xlsx?filtros` con `@Roles('admin_plaza', 'superadmin')`.
  - [ ] Hace query a la BD con los filtros, arma el payload `{ items: [...], plaza: {...} }` y llama a `JsreportService.renderXlsx('solicitudes-xlsx', payload)`.
  - [ ] Retorna el buffer con Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
  - [ ] Si el reporte tiene > 10,000 filas: retorna `202 Accepted` con un jobId y el cliente debe hacer polling (S-AsyncReport). En v1, si pasa el límite, retorna `413 REPORTE_DEMASIADO_GRANDE` y sugiere reducir el rango.
  - [ ] RLS probado.
- **Dependencias:** T-136, T-137.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — `GET /api/v1/reportes/{entidad}/export.xlsx`: query con filtros → payload `{ plaza, generadoEl, total, rango, items }` → `renderXlsx` → buffer con el Content-Type de openxml. Verificado con render real (zip PK válido) para solicitudes y locales.
  - Límite: > 10.000 filas → `413 REPORTE_DEMASIADO_GRANDE` con sugerencia de reducir rango (S-AsyncReport: el job asíncrono con 202+jobId queda para v1.1, como permite el plan).
  - RLS: queries bajo `withTenant`.

### T-140 — Implementar GET /api/v1/reportes/{entidad}/export.pdf

- **Descripción:** Implementar la exportación a PDF usando jsreport (recipe `chrome-pdf`). Similar a T-139 pero con PDF.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/reportes/solicitudes/export.pdf?filtros` con `@Roles('admin_plaza', 'superadmin')`.
  - [ ] Similar para `/locales/:id/export.pdf` (reporte por local con detalle + contratos + solicitudes) y `/inquilinos/:id/export.pdf`.
  - [ ] Llama a `JsreportService.renderPdf('solicitudes-pdf', payload)`.
  - [ ] Retorna el buffer con Content-Type: `application/pdf`.
  - [ ] RLS probado.
- **Dependencias:** T-136, T-137.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — `GET /api/v1/reportes/{entidad}/export.pdf` (listados, verificado PDF v1.4 válido) + reportes de DETALLE (decisión owner): `GET /reportes/locales/:id/export.pdf` (ficha + historial de contratos + últimas 50 solicitudes) y `GET /reportes/inquilinos/:id/export.pdf` — registrados ANTES de las rutas genéricas `:entidad` para que Nest resuelva bien.
  - Branding de plaza en header, footer chrome con paginación. Verificado el detalle de local con datos reales (L-SOL-1).

### T-141 — Implementar KPIs: pendientes, aprobadas_hoy, rechazadas_hoy, eventos_proximos, contratos_por_vencer

- **Descripción:** Implementar el endpoint que retorna los KPIs del dashboard: solicitudes pendientes, aprobadas hoy, rechazadas hoy, eventos próximos (7 días), contratos por vencer (30 días), top 5 por antigüedad. Materializa CU-PA-1 a CU-PA-4 y `docs/05` §2.8.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/reportes/kpis` con `@Roles('admin_plaza', 'superadmin')`.
  - [ ] Retorna:
    ```json
    {
      "pendientes": 12,
      "aprobadasHoy": 5,
      "rechazadasHoy": 2,
      "eventosProximos7d": 8,
      "contratosPorVencer30d": 3,
      "tasaAprobacion": 0.72,
      "tiempoMedioRespuestaHoras": 18.5,
      "solicitudesConSubsanacion": 4,
      "top5Antiguedad": [{ "id": "...", "codigo": "...", "titulo": "...", "enviadaAt": "..." }]
    }
    ```
  - [ ] Queries SQL optimizadas con índices (los índices ya están en T-074).
  - [ ] RLS probado.
  - [ ] Para v1.1: cachear 5 min con Redis.
- **Dependencias:** T-074, T-049, T-128.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — `GET /api/v1/reportes/kpis` con TODAS las métricas del plan. Definiciones aplicadas (el plan no las precisaba): `pendientes` = estados enviada|asignado|en_revision|requerida_subsanacion; "hoy" = día civil de El Salvador (UTC-6); `tasaAprobacion` = aprobadas/(aprobadas+rechazadas) histórico (null sin decisiones); `tiempoMedioRespuestaHoras` = AVG(decision_at−enviada_at) en SQL; `solicitudesConSubsanacion` = DISTINCT solicitudes con evento `subsanada` en historial; `top5Antiguedad` = no terminales más viejas por enviada_at.
  - `superadmin` recibe el AGREGADO GLOBAL de todas las plazas (admin client) — alimenta `/superadmin/dashboard` (T-143).
  - Se añadió además `GET /api/v1/reportes/dashboard` (datos de gráficos T-143: tendencia mensual 6 meses por estado vía `date_trunc`, por tipo, por prioridad, actividad reciente del historial).
  - Verificado con datos reales (admin demo y superadmin). El cache Redis de 5 min queda para v1.1 (T-V11: sin Redis en v1).

### T-142 — Implementar cron de kpi_snapshot cada 15 min

- **Descripción:** Implementar un cron que cada 15 min guarde el resultado de los KPIs en una tabla `kpi_snapshot` para histórico y optimización. Materializa S-PA-B y S-KPI.
- **Criterios de aceptación:**
  - [ ] Migración con `kpi_snapshot` (id, plaza_id, fecha, jsonb_metricas).
  - [ ] `backend/src/modules/reportes/cron/kpi-snapshot.cron.ts` con `@Cron('*/15 * * * *')`.
  - [ ] Para cada plaza activa, llama al servicio de KPIs y guarda el snapshot.
  - [ ] Retención: 90 días (limpieza con otro cron).
  - [ ] RLS habilitado.
- **Dependencias:** T-141.
- **Prioridad:** Media.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — Migración `20260607222800_modulo_11_kpi_snapshot` (id, plaza_id FK, fecha, metricas JSONB, índice (plaza_id, fecha), RLS ENABLE+FORCE). Cron `kpi-snapshot.cron.ts` cada 15 min: descubre plazas activas (admin client) y guarda cada snapshot bajo `withTenant`.
  - ⚠️ Desviación: la limpieza de retención (90 días) corre en el MISMO tick (deleteMany indexado, barato), no en "otro cron" como decía el plan.
  - 🐛 **Fix transversal detectado por esta tarea:** el primer tick guardó snapshots DUPLICADOS — `ScheduleModule.forRoot()` estaba registrado en AdjuntosModule (módulo 08) Y NotificacionesModule (módulo 09), creando DOS schedulers: **todos los @Cron de la app corrían 2 veces** (enmascarado hasta ahora: email-worker tiene advisory lock, auto-asignación re-verifica en tx, vencimiento dedup diaria). Se centralizó en `AppModule` (única registración) — commit `fix:` separado. Verificado tras el fix: 1 snapshot por plaza por tick.

### T-143 — Implementar dashboard /admin/dashboard con recharts

- **Descripción:** Implementar la pantalla principal del admin con KPIs y gráficos de tendencia. Materializa CU-PA-1 a CU-PA-4.
- **Criterios de aceptación:**
  - [ ] `/admin/dashboard` con Server Component que carga KPIs.
  - [ ] Cards con los 5 KPIs principales (T-141).
  - [ ] Gráficos con `recharts`:
    - `LineChart`: tendencia mensual (últimos 6 meses) de solicitudes por estado.
    - `BarChart`: solicitudes por tipo.
    - `PieChart`: distribución por prioridad.
  - [ ] Tabla "Top 5 por antigüedad" con link a cada solicitud.
  - [ ] Sección "Actividad reciente": últimos 10 eventos del historial agregados.
  - [ ] Refresco cada 5 min.
  - [ ] Si es `superadmin`, ve un dashboard global con métricas agregadas de todas las plazas (`/superadmin/dashboard`).
- **Dependencias:** T-141, T-142.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — `/admin/dashboard` (Server Component: fetch de `/reportes/kpis` + `/reportes/dashboard`) con 5 cards de KPIs + 3 secundarios (tasa, tiempo medio, subsanaciones), gráficos **recharts 3.8.1** (latest verificada en npm, peers React 19 ✅) en Client Component `dashboard-charts.tsx`: LineChart tendencia 6 meses por estado, BarChart por tipo, PieChart por prioridad. Tabla "Top 5 por antigüedad" con links y "Actividad reciente" (últimos 10 del historial). Refresco cada 5 min con el `AutoRefresh` existente (router.refresh re-ejecuta el fetch server-side).
  - `/superadmin/dashboard` (dashboard GLOBAL agregado, sin links de detalle — las solicitudes viven en el panel de cada plaza) compartiendo el mismo `DashboardContenido`. Links "Dashboard" añadidos a ambos navs.

### T-144 — Implementar pantalla /admin/reportes con filtros

- **Descripción:** Implementar la pantalla para generar y descargar reportes. Materializa CU-RE-1 a CU-RE-8.
- **Criterios de aceptación:**
  - [ ] `/admin/reportes` con formulario de filtros:
    - Selector de entidad (solicitudes / locales / inquilinos).
    - Filtros contextuales según entidad.
    - Rango de fechas.
    - Selector de formato (CSV, XLSX, PDF).
  - [ ] Botón "Generar" que dispara la descarga del archivo.
  - [ ] Previsualización de los primeros 10 registros (sin descargar).
  - [ ] Historial de reportes generados (placeholder, los reportes programados están fuera de v1).
  - [ ] Solo `admin_plaza` y `superadmin` acceden. Inquilino NO ve esta pantalla (S-RE-A).
  - [ ] RLS probado.
- **Dependencias:** T-138, T-139, T-140.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — `/admin/reportes` con `ReportesGenerator` (client): selector de entidad, filtros contextuales (solicitudes: estado/tipo/local/inquilino/fechas; locales: estado; inquilinos: búsqueda), formato CSV/XLSX/PDF, "Previsualizar" (server action → `GET :entidad/preview`, primeros 10 + total) y "Generar" que descarga vía route handler BFF `/api/reportes/export` (la descarga binaria necesita headers de attachment; el JWT nunca toca el cliente).
  - Placeholder visible de "Historial de reportes" (reportes programados fuera de v1, como pide el criterio). Link "Reportes" en el nav admin. Inquilino sin acceso (layout + 403 del backend).

### T-145 — Implementar pantalla /admin/configuracion (SLA, MIME, tamaño)

- **Descripción:** Implementar la pantalla de configuración de la plaza (CU-PA-7 a CU-PA-12). Permite editar SLA, MIME, tamaño, color, branding, etc. Materializa S-Branding.
- **Criterios de aceptación:**
  - [ ] `/admin/configuracion` con tabs: General, Branding, SLA, Adjuntos, Calendario.
  - [ ] Tab "General": nombre comercial, email de contacto, teléfono, TZ (select con IANA).
  - [ ] Tab "Branding": color primario (color picker), logo (upload, reutiliza T-041).
  - [ ] Tab "SLA": editor JSON para `sla_dias_por_tipo` y `sla_multiplicador_por_prioridad` con preview visual del semáforo.
  - [ ] Tab "Adjuntos": lista de MIME permitidos (con checks), tamaño máximo en MB.
  - [ ] Tab "Calendario": toggle "Mostrar hitos contractuales".
  - [ ] Cambios se persisten con `PATCH /api/v1/configuracion` (T-044).
  - [ ] Solo `admin_plaza` y `superadmin` acceden.
  - [ ] RLS probado.
- **Dependencias:** T-044, T-041, T-100, T-115.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — `/admin/configuracion` con las 5 tabs sobre los endpoints EXISTENTES: General y Branding → `PATCH /plazas/:id` + `POST /plazas/:id/logo` (T-040/T-041, admin_plaza permitido por T-V08); SLA/Adjuntos/Calendario → `PATCH /configuracion` (T-044). Server actions con validación Zod (`UpdatePlazaSchema`/`UpdateConfiguracionSchema`).
  - ⚠️ Desviaciones de UI: (1) la TZ se muestra DESHABILITADA con nota "fija en v1" — T-V08 la declaró no editable, el select IANA del plan contradiría esa decisión vinculante; (2) el "editor JSON" del SLA se implementó como inputs numéricos por tipo/prioridad + **preview visual del semáforo** (tabla tipo×prioridad con días totales coloreados) — misma información, sin JSON crudo propenso a errores.
  - Tab Adjuntos: checkboxes de la lista de MIME conocidos + tamaño máx MB (validación min 1, lista no vacía). Tab Calendario: toggle de hitos contractuales. Link "Configuración" en el nav admin.
