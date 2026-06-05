# sys-solicitudes · Sistema de Gestión de Solicitudes para Plazas Comerciales

> Portal web **multi-plaza (SaaS)** para que las empresas administradoras de centros comerciales centralicen y den trazabilidad a las solicitudes (mantenimientos, eventos, remodelaciones) presentadas por sus inquilinos.

---

## 1. Acerca del proyecto

**Origen:** Cotización COT-2026-0012 (Helixsys · 20/05/2026).
**Estado actual:** documentación funcional para validación.
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

---

## 3. Resumen ejecutivo

| Aspecto | Detalle |
|---|---|
| **Problema** | Las administradoras de plazas gestionan solicitudes de inquilinos por canales informales (correo, llamadas, archivos sueltos), sin trazabilidad, sin agenda común y sin reportes. |
| **Solución** | Portal web multi-plaza con flujo formal de aprobación, calendario, repositorio documental, notificaciones por email y reportes exportables. |
| **Usuarios** | 3 roles: `superadmin` (plataforma), `admin_plaza` (cliente), `inquilino` (arrendatario). |
| **Módulos** | 9 módulos de la cotización + concepto transversal multi-tenant. |
| **Eje principal** | Ciclo de vida de la solicitud: `borrador → enviada → en_revision → aprobada/rechazada`, con subsanación y cancelación. |
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
| 1 | **Autenticación y Usuarios** | Login, registro por admin, recuperación de contraseña, 3 roles. |
| 2 | **Gestión de Locales** *(+ Contratos)* | CRUD de locales, inquilinos, contratos de alquiler. |
| 3 | **Solicitudes** | Creación, edición, envío, tipos (mantenimiento, evento, remodelación, otro). |
| 4 | **Aprobaciones** | Flujo de revisión: tomar, aprobar, rechazar, pedir subsanación. |
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
2. **Resolver la lista de SUPUESTOS** críticos.
3. **Confirmar el proveedor de hosting** y su topología (la cotización no lo incluye).
4. **Confirmar el SMTP transaccional** a usar en producción (SendGrid, SES, Mailgun, etc.).
5. **Generar el `schema.prisma` definitivo** a partir del DDL de [`docs/04-modelo-de-datos.md`](docs/04-modelo-de-datos.md).
6. **Crear el monorepo** con `frontend/`, `backend/`, `packages/contracts/`.
7. **Levantar el entorno de desarrollo** con el `docker-compose.yml` de [`docs/07-arquitectura.md`](docs/07-arquitectura.md).
8. **Iniciar la implementación** siguiendo la fase 2 de la cotización (autenticación, locales, solicitudes, aprobaciones).

---

## 8. Estructura del repositorio

```
sys-solicitudes/
├── README.md                       ← este archivo
├── Cotizacion_Solicitudes.pdf      ← cotización original
└── docs/
    ├── 01-vision-general.md
    ├── 02-stack-tecnologico.md
    ├── 03-modulos-del-sistema.md
    ├── 04-modelo-de-datos.md
    ├── 05-flujo-de-solicitudes.md
    ├── 06-roles-y-permisos.md
    └── 07-arquitectura.md
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
