# Módulo 11 — Reportes y Panel Administrativo

> **Propósito:** jsreport 4.13 como contenedor Docker separado (BFF proxy desde el backend), 6 plantillas inline (solicitudes/locales/inquilinos × PDF/XLSX), CSV generado inline, 3 KPIs principales, snapshot precalculado cada 15 min, dashboard con `recharts`, y pantalla de configuración de plaza.
>
> **Pre-requisito:** T-001 a T-134 (incluye Calendario) deben estar `Completada`.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-135 | Levantar jsreport 4.13 como contenedor Docker y verificar conexión | Alta | Pendiente |
| T-136 | Implementar cliente BFF HTTP a jsreport desde backend | Alta | Pendiente |
| T-137 | Crear 6 plantillas inline (solicitudes/locales/inquilinos × PDF/XLSX) | Alta | Pendiente |
| T-138 | Implementar GET /api/v1/reportes/{entidad}/export.csv (inline) | Alta | Pendiente |
| T-139 | Implementar GET /api/v1/reportes/{entidad}/export.xlsx | Alta | Pendiente |
| T-140 | Implementar GET /api/v1/reportes/{entidad}/export.pdf | Alta | Pendiente |
| T-141 | Implementar KPIs: pendientes, aprobadas_hoy, rechazadas_hoy, eventos_proximos, contratos_por_vencer | Alta | Pendiente |
| T-142 | Implementar cron de kpi_snapshot cada 15 min | Media | Pendiente |
| T-143 | Implementar dashboard /admin/dashboard con recharts | Alta | Pendiente |
| T-144 | Implementar pantalla /admin/reportes con filtros | Alta | Pendiente |
| T-145 | Implementar pantalla /admin/configuracion (SLA, MIME, tamaño) | Alta | Pendiente |

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*

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
- **Estado:** Pendiente.
- **Bitácora de cambios:** *(vacía)*
