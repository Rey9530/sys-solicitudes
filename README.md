# sys-solicitudes · Sistema de Gestión de Solicitudes para Plazas Comerciales

> Portal web **multi-plaza (SaaS)** para que las empresas administradoras de centros comerciales centralicen y den trazabilidad a las solicitudes (mantenimientos, eventos, remodelaciones) presentadas por sus inquilinos.

---

## 1. Acerca del proyecto

**Origen:** Cotización COT-2026-0012 (Helixsys · 20/05/2026).
**Estado actual:** documentación funcional para validación + planificación de implementación descompuesta en tareas.
**Moneda:** USD (cotización base).
**Stack:** Next.js 14 + NestJS 10 + PostgreSQL 16 + MinIO + SMTP.

> ⚠️ Esta documentación está en estado de **borrador para validación**. Todos los elementos marcados con `SUPUESTO:` deben ser confirmados con el cliente antes de iniciar la implementación.

---

## 2. Índice de documentación

| # | Documento | Contenido |
|---|---|---|
| **01** | [`docs/01-vision-general.md`](docs/01-vision-general.md) | Problema, objetivos, alcance, glosario, stakeholders, restricciones. |
| **02** | [`docs/02-stack-tecnologico.md`](docs/02-stack-tecnologico.md) | Stack completo, justificación de Next.js sobre Angular, topología. |
| **03** | [`docs/03-modulos-del-sistema.md`](docs/03-modulos-del-sistema.md) | Los **9 módulos** de la cotización desarrollados a profundidad. |
| **04** | [`docs/04-modelo-de-datos.md`](docs/04-modelo-de-datos.md) | Diagrama ER (Mermaid), entidades, relaciones, SQL canónico. |
| **05** | [`docs/05-flujo-de-solicitudes.md`](docs/05-flujo-de-solicitudes.md) | State machine, transiciones, notificaciones, casos especiales. |
| **06** | [`docs/06-roles-y-permisos.md`](docs/06-roles-y-permisos.md) | Roles, matriz de permisos por módulo, guards de NestJS. |
| **07** | [`docs/07-arquitectura.md`](docs/07-arquitectura.md) | Componentes, multi-tenancy, estructura de carpetas, contratos API, despliegue. |

### Lectura recomendada

- **Si vienes del cliente y quieres entender el producto:** lee `01` y luego `03` (módulos).
- **Si vienes del equipo de desarrollo y vas a implementar:** lee `01` → `02` → `04` → `07` → `03` (módulos) → `05` → `06`.
- **Si vienes del equipo de QA:** lee `05` (flujo de solicitudes) y `06` (matriz de permisos).
- **Si vienes a tomar una tarea:** abre [`PLANIFICACION/00-INDICE.md`](PLANIFICACION/00-INDICE.md), busca tu módulo, y revisa la tarea por su ID (T-NNN).

---

## 3. Resumen ejecutivo

| Aspecto | Detalle |
|---|---|
| **Problema** | Las administradoras de plazas gestionan solicitudes de inquilinos por canales informales (correo, llamadas, archivos sueltos), sin trazabilidad, sin agenda común y sin reportes. |
| **Solución** | Portal web multi-plaza con flujo formal de aprobación, calendario, repositorio documental, notificaciones por email y reportes exportables. |
| **Usuarios** | 3 roles globales (`superadmin`, `admin_plaza`, `inquilino`) + **N roles de staff configurables por plaza** (técnico, ingeniero, etc.). |
| **Módulos** | 9 módulos de la cotización + concepto transversal multi-tenant + 2 nuevos módulos (roles de staff, categorías/subcategorías). |
| **Eje principal** | Ciclo de vida de la solicitud: `borrador → en_revision` (auto-asignada al responsable) → `aprobada/rechazada`, con subsanación y cancelación. |
| **Stack** | Next.js 14 (App Router) + NestJS 10 + PostgreSQL 16 + MinIO + SMTP + Auth.js. |
| **Hosting** | No incluido en la cotización. Queda a decisión del cliente. |
| **Inversión (referencia)** | USD 2 000 + IVA = USD 2 260 (cotización original). |
| **Cronograma (referencia)** | 4 semanas (semanas 1 a 4 según sección 5 de la cotización). |

---

## 4. Decisiones clave de la propuesta

Las siguientes decisiones modifican o amplían lo indicado en la cotización original y **deben ser validadas con el cliente** antes de implementar.

| ID | Decisión | Origen |
|---|---|---|
| **D1** | Sistema **multi-plaza / SaaS** con `plaza_id` como discriminador. Cada plaza es un tenant aislado. | Validado por el cliente (pregunta en plan mode). |
| **D2** | **Contratos de alquiler** se modelan como sub-sección del módulo **Gestión de Locales**, no como módulo independiente. | Validado por el cliente. |
| **D3** | Autenticación con **Auth.js (NextAuth) en frontend + JWT compartido con NestJS (HS256)**. | Validado por el cliente. |
| **D4** | Notificaciones **solo por email (SMTP)**, sin in-app/WhatsApp/SMS. | Validado por el cliente. |
| **D5** | Frontend **Next.js 14** reemplaza al Angular de la cotización, por mejor SSR/SSG, performance y DX. | Propuesta propia. |
| **D6** | ORM **Prisma** con migraciones versionadas. | Supuesto técnico. |
| **D7** | Validación con **Zod** compartida entre frontend y backend. | Supuesto técnico. |
| **D8** | Calendario con **FullCalendar React**. | Supuesto técnico. |
| **D9** | Estilo con **Tailwind + shadcn/ui**. | Supuesto técnico. |

---

## 5. Módulos del sistema (resumen)

> Detalle completo en [`docs/03-modulos-del-sistema.md`](docs/03-modulos-del-sistema.md).

| # | Módulo | Resumen |
|---|---|---|
| 0 | **Plazas (multi-tenant)** *transversal* | Alta de plazas, resolución por subdominio, branding. |
| 1 | **Autenticación y Usuarios** | Login, registro por admin, recuperación de contraseña, 3 roles globales. |
| 1A | **Roles de Staff** *(nuevo)* | CRUD de roles operativos de la plaza (técnico, ingeniero, etc.). |
| 2 | **Gestión de Locales** *(+ Contratos)* | CRUD de locales, inquilinos, contratos de alquiler. |
| 3 | **Solicitudes** | Creación, edición, envío, tipos (mantenimiento, evento, remodelación, otro). |
| 3A | **Categorías y Subcategorías** *(nuevo)* | CRUD de categorías; subcategorías con responsable y hasta 5 supervisores. |
| 4 | **Aprobaciones** | Flujo de revisión: tomar, aprobar, rechazar, pedir subsanación, reasignar. |
| 5 | **Notificaciones Email** | SMTP con log, reintentos, plantillas por evento. |
| 6 | **Calendario** | FullCalendar con eventos aprobados, mantenimientos, hitos contractuales. |
| 7 | **Documentos Adjuntos** | MinIO, tipos MIME controlados, URLs pre-firmadas. |
| 8 | **Reportes y Estadísticas** | Filtros, exportación CSV/XLSX, KPIs. |
| 9 | **Panel Administrativo** | Dashboard con métricas, gestión de usuarios, configuración de la plaza. |

---

## 6. Supuestos pendientes de validar

> La lista completa de SUPUESTOS está al final de cada documento. Los más críticos a validar primero son:

| ID | Supuesto | Documento | Impacto si cambia |
|---|---|---|---|
| **S-MT-A** | Resolución de tenant por subdominio en producción | 03 / 07 | DNS, TLS, despliegue |
| **S-MT-B** | Slug de plaza inmutable | 04 | URLs históricas |
| **S-MT-C** | Un usuario solo pertenece a una plaza | 03 / 06 | Modelo de datos y permisos |
| **S-SLA** | SLA visual por tipo de solicitud | 05 | Configuración por plaza |
| **S-LockTimeout** | Lock de revisión expira a 30 min | 05 | Concurrencia |
| **S-RolStaff** | Cada plaza define libremente sus roles de personal vía CRUD | 01 / 03 / 04 / 06 / 07 | Modelo de datos, permisos y endpoints |
| **S-Categorias** | `categoria` y `subcategoria` son entidades configurables por plaza (reemplazan el enum embebido en `campos_extra.categoria`) | 03 / 04 / 05 | Modelo de datos y formulario |
| **S-Subcategoria** | Una subcategoría tiene exactamente 1 responsable y entre 0 y 5 supervisores; el límite lo enforce un trigger PL/pgSQL | 04 / 06 | Modelo de datos y UI |
| **S-AutoAsignacion** | Al enviar una solicitud con `subcategoria_id`, se asigna automáticamente al responsable, se setea lock 30 min y entra directo a `en_revision` | 03 / 05 / 07 | State machine y endpoints |
| **S-Prioridad** | `prioridad ∈ {A,B,C,D,F}`; default heredado de la subcategoría, modificable por `admin_plaza` con `PATCH /solicitudes/:id` | 03 / 04 / 05 / 06 | Modelo, formulario y UI |
| **S-SLA-Prioridad** | El `admin_plaza` puede configurar un multiplicador de SLA por prioridad (`configuracion.sla_multiplicador_por_prioridad`) | 05 / 03 | Configuración por plaza |
| **S-ResponsabilidadStaff** | Un usuario `admin_plaza` debe tener `rol_staff_id` asignado para poder ser responsable o supervisor de una subcategoría | 04 / 06 | Modelo y permisos |
| **S-Reasignacion** | Cualquier `admin_plaza` (no solo supervisores) puede reasignar manualmente una solicitud; el endpoint `POST /solicitudes/:id/reasignar` libera el lock anterior y crea uno nuevo | 05 / 06 / 07 | Permisos y endpoints |
| **S-CamposTipo** | Campos extra por tipo de solicitud | 03 / 04 | Formularios y esquema |
| **S-TamañoMax** | 25 MB por archivo | 03 / 07 | Configuración por plaza |
| **S-MimeTypes** | Lista cerrada de MIME permitidos | 03 / 07 | Configuración por plaza |
| **S-Branding** | Color primario por plaza | 02 / 07 | UI y emails |
| **S-EstrategiaMT** | DB compartida + `plaza_id` | 04 | Toda la arquitectura |
| **S-Replicas** | Read replicas para reportes | 04 | Infra PostgreSQL |
| **S-Particionamiento** | Particionamiento mensual de tablas de alto volumen | 04 | Mantenimiento y retención |
| **S-CI** | GitHub Actions para CI | 07 | Proceso de releases |
| **S-Obs** | Stack de observabilidad (Pino + Prometheus + Sentry) | 07 | Operación |

> Antes de iniciar la implementación, el equipo debe revisar la lista completa de SUPUESTOS y obtener confirmación punto por punto.

---

## 7. Próximos pasos sugeridos

1. **Validar la documentación** sección por sección con el cliente.
2. **Resolver la lista de SUPUESTOS** críticos (especialmente los nuevos: `S-RolStaff`, `S-Categorias`, `S-Subcategoria`, `S-AutoAsignacion`, `S-Prioridad`, `S-SLA-Prioridad`, `S-ResponsabilidadStaff`, `S-Reasignacion`).
3. **Confirmar el proveedor de hosting** y su topología (la cotización no lo incluye).
4. **Confirmar el SMTP transaccional** a usar en producción (SendGrid, SES, Mailgun, etc.).
5. **Generar el `schema.prisma` definitivo** a partir del DDL de [`docs/04-modelo-de-datos.md`](docs/04-modelo-de-datos.md), incluyendo las nuevas entidades `rol_staff`, `categoria`, `subcategoria` y `subcategoria_supervisor`.
6. **Modelar primero** los nuevos módulos (roles de staff, categorías, subcategorías) **antes** del módulo `solicitudes`, ya que la auto-asignación T2 depende de la subcategoría. El orden sugerido es: `auth` → `usuarios` → `roles-staff` → `categorias` → `solicitudes` → `aprobaciones`.
7. **Crear el monorepo** con `frontend/`, `backend/`, `packages/contracts/`.
8. **Levantar el entorno de desarrollo** con el `docker-compose.yml` de [`docs/07-arquitectura.md`](docs/07-arquitectura.md).
9. **Iniciar la implementación** siguiendo la fase 2 de la cotización (autenticación, locales, solicitudes, aprobaciones).

---

## 7.1. Planificación accionable

> Generada a partir del análisis de los 7 documentos anteriores. **Empieza por aquí si vienes a implementar.**

| Documento | Contenido |
|---|---|
| [`PLANIFICACION/00-INDICE.md`](PLANIFICACION/00-INDICE.md) | **Índice global**, dashboard de estado, mapa de tareas, y **SUPUESTOS críticos que el cliente debe validar antes de iniciar el desarrollo** (T-V01…T-V15). |
| [`PLANIFICACION/01-setup-base.md`](PLANIFICACION/01-setup-base.md) | Bootstrap del monorepo, Docker, tooling, Prisma init, paquete `@app/contracts`, GitHub Actions CI, RLS base (T-001…T-016). |
| [`PLANIFICACION/02-autenticacion-usuarios.md`](PLANIFICACION/02-autenticacion-usuarios.md) | Triple guard, Auth.js + JWT compartido, login/refresh/logout/reset, lockout, usuarios CRUD, roles de staff (T-017…T-035). |
| [`PLANIFICACION/03-plazas-multitenant.md`](PLANIFICACION/03-plazas-multitenant.md) | Resolución de tenant (subdominio/path), RLS, CRUD de plazas, branding, configuración 1:1 (T-036…T-046). |
| [`PLANIFICACION/04-locales-inquilinos-contratos.md`](PLANIFICACION/04-locales-inquilinos-contratos.md) | Locales (CRUD + CSV), inquilinos, contratos con trigger anti-solapamiento, alertas T-30/T-7 (T-047…T-062). |
| [`PLANIFICACION/05-categorias-subcategorias.md`](PLANIFICACION/05-categorias-subcategorias.md) | Categorías, subcategorías con responsable y hasta 5 supervisores (trigger PL/pgSQL) (T-063…T-073). |
| [`PLANIFICACION/06-solicitudes.md`](PLANIFICACION/06-solicitudes.md) | Solicitudes CRUD, 4 tipos, campos extra JSONB validados con Zod, recurrencia, duplicar, prioridad heredada (T-074…T-090). |
| [`PLANIFICACION/07-aprobaciones.md`](PLANIFICACION/07-aprobaciones.md) | State machine completa (T1–T12), lock 30 min, bandeja priorizada, SC-4 defense, SLA visual, reasignación (T-091…T-108). |
| [`PLANIFICACION/08-adjuntos.md`](PLANIFICACION/08-adjuntos.md) | MinIO, buckets por tenant, upload/download con URLs pre-firmadas, validación MIME, cuarentena 30 días (T-109…T-117). |
| [`PLANIFICACION/09-notificaciones-email.md`](PLANIFICACION/09-notificaciones-email.md) | SMTP, 8 plantillas, cola `email_log`, worker con reintentos 1m/5m/30m, deduplicación, bounce handling (T-118…T-127). |
| [`PLANIFICACION/10-calendario.md`](PLANIFICACION/10-calendario.md) | FullCalendar (Client Component), `evento_calendario`, detección visual de choques, export iCal (T-128…T-134). |
| [`PLANIFICACION/11-reportes-panel.md`](PLANIFICACION/11-reportes-panel.md) | jsreport 4.13 (BFF), CSV/XLSX/PDF, KPIs, dashboard con recharts, pantalla de configuración (T-135…T-145). |
| [`PLANIFICACION/12-seguridad-auditoria.md`](PLANIFICACION/12-seguridad-auditoria.md) | Helmet, CORS, throttler, auditoría append-only, sanitización HTML, RFC 7807 (T-146…T-152). |
| [`PLANIFICACION/13-observabilidad-despliegue.md`](PLANIFICACION/13-observabilidad-despliegue.md) | `pino` + `requestId`, Prometheus, Sentry, health checks, docker-compose prod, GitHub Actions deploy (T-153…T-160). |

**Total:** 175 tareas (15 de validación + 160 de implementación) con dependencias explícitas y trazables.

---

## 8. Estructura del repositorio

```
sys-solicitudes/
├── README.md                       ← este archivo
├── Cotizacion_Solicitudes.pdf      ← cotización original
├── docs/                           ← especificación funcional y técnica
│   ├── 01-vision-general.md
│   ├── 02-stack-tecnologico.md
│   ├── 03-modulos-del-sistema.md
│   ├── 04-modelo-de-datos.md
│   ├── 05-flujo-de-solicitudes.md
│   ├── 06-roles-y-permisos.md
│   └── 07-arquitectura.md
└── PLANIFICACION/                  ← planificación accionable (175 tareas)
    ├── 00-INDICE.md
    ├── 01-setup-base.md
    ├── 02-autenticacion-usuarios.md
    ├── 03-plazas-multitenant.md
    ├── 04-locales-inquilinos-contratos.md
    ├── 05-categorias-subcategorias.md
    ├── 06-solicitudes.md
    ├── 07-aprobaciones.md
    ├── 08-adjuntos.md
    ├── 09-notificaciones-email.md
    ├── 10-calendario.md
    ├── 11-reportes-panel.md
    ├── 12-seguridad-auditoria.md
    └── 13-observabilidad-despliegue.md
```

Cuando se inicie la implementación, la estructura esperada (ver [`docs/07-arquitectura.md`](docs/07-arquitectura.md) §7.3) es:

```
sys-solicitudes/
├── README.md
├── docs/                           ← esta documentación
├── frontend/                       ← Next.js 14
├── backend/                        ← NestJS 10
├── packages/
│   └── contracts/                  ← Zod schemas compartidos
├── docker-compose.yml
├── docker-compose.prod.yml
└── .github/workflows/
```

---

## 9. Licencia y propiedad

Según la sección 8 de la cotización COT-2026-0012: **"El cliente recibe la propiedad total del código fuente al completar el pago."**

---

## 10. Contacto

- **Cotización:** Helixsys · `asistencia@helixsys.dev` · +506 6000-4443.
- **Cotización N°:** COT-2026-0012.
- **Fecha de cotización:** 20 de mayo de 2026.
- **Vigencia:** 30 días.
