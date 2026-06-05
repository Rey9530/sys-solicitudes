# 01 · Visión General del Sistema

> **Código del documento:** `DOC-01-VG`
> **Estado:** Borrador para validación
> **Origen:** Cotización COT-2026-0012 (Helixsys · 20/05/2026)

---

## 1.1. Problema

Las empresas que administran centros comerciales o plazas comerciales alquilan múltiples locales a distintos inquilinos. La operación cotidiana genera un volumen alto de **solicitudes y permisos** que los inquilinos deben presentar a la administración: mantenimientos, remodelaciones, eventos, instalaciones especiales, accesos a zonas comunes, etc.

En la práctica, estas solicitudes se gestionan de forma dispersa (correo electrónico, llamadas, documentos físicos, chats), lo que provoca:

- **Trazabilidad nula o deficiente**: no se sabe con certeza en qué estado está una solicitud ni quién la está revisando.
- **Pérdida de información**: archivos adjuntos, planos o permisos que se mezclan o se pierden.
- **Falta de agenda común**: choques entre eventos y mantenimientos programados.
- **Ciclos de aprobación lentos**: idas y vueltas por canales informales.
- **Reportes inexistentes**: la administración no tiene visibilidad histórica ni indicadores (tiempos de respuesta, tipos de solicitud por local, etc.).
- **Onboarding lento de nuevos inquilinos**: cada alta se hace a mano.

---

## 1.2. Solución propuesta

Un **portal web multi-plaza (SaaS)** que centraliza el ciclo de vida de las solicitudes presentadas por los inquilinos, con un flujo formal de aprobación por parte de la administración, integrado con:

- Calendario compartido de eventos y mantenimientos.
- Repositorio documental por solicitud.
- Notificaciones por correo en cada cambio de estado.
- Reportes filtrados por tipo, local, estado y período.
- Panel administrativo con métricas.

El sistema se entrega como una plataforma **multi-tenant** donde cada **plaza comercial** es un cliente independiente con su propio espacio, usuarios y configuración.

---

## 1.3. Objetivos

### 1.3.1. Objetivo general

Proveer a las administradoras de plazas comerciales una plataforma web que centralice y dé trazabilidad al ciclo de vida de las solicitudes presentadas por sus inquilinos, desde su creación hasta su aprobación o rechazo, con notificaciones, calendario, repositorio documental y reportes.

### 1.3.2. Objetivos específicos

| # | Objetivo | Métrica de éxito |
|---|---|---|
| OE-1 | Digitalizar el alta y gestión de locales por plaza | 100% de locales registrados en sistema, ninguno en hojas de cálculo |
| OE-2 | Estandarizar el ciclo de solicitudes | Toda solicitud pasa por estados `borrador → enviada → en revisión → aprobada/rechazada` |
| OE-3 | Reducir el tiempo de respuesta de aprobación | Línea base vs. tiempo medio post-implementación |
| OE-4 | Eliminar la dispersión documental | Toda la documentación de una solicitud vive adjunta a ella |
| OE-5 | Dar visibilidad agregada a la administración | Reportes exportables por tipo, local, estado y período |
| OE-6 | Soportar múltiples plazas desde una sola instalación | Aislamiento de datos por `plaza_id` validado con pruebas |

---

## 1.4. Alcance

### 1.4.1. Dentro del alcance (incluye)

- Registro, autenticación y recuperación de contraseña de usuarios con tres roles: `superadmin`, `administrador_plaza`, `inquilino`.
- Aprovisionamiento y configuración básica de plazas (alta, edición, baja lógica, branding mínimo).
- Registro de locales por plaza, con su información de planta, estado y disponibilidad.
- Registro del contrato de alquiler que vincula un local con un inquilino por un período.
- Creación, edición, envío, revisión, aprobación y rechazo de solicitudes por parte del inquilino.
- Comentarios y adjuntos asociados a cada solicitud.
- Flujo de aprobación por el administrador de plaza con comentarios y notificación por correo.
- Calendario interactivo que muestra eventos y mantenimientos programados.
- Notificaciones automáticas por SMTP en cada cambio de estado de una solicitud.
- Reportes filtrados y exportables (CSV/XLSX) por tipo, local, estado y período.
- Panel administrativo con métricas (KPIs) y gestión de usuarios.
- API versionada (`/api/v1`) consumida por el frontend.

### 1.4.2. Fuera del alcance (excluye)

- **Procesamiento de pagos** de alquileres o cuotas. (No está en la cotización.)
- **Facturación electrónica** ni integración con sistemas contables.
- **Firma digital legalmente vinculante** de contratos. (El contrato se registra, no se firma dentro del sistema.)
- **App móvil nativa** (iOS/Android). El portal web es responsivo, pero no se entrega aplicación nativa.
- **Integración con sistemas externos del cliente** (ERP, CRM) en esta primera entrega.
- **Hosting y despliegue en producción** según lo indicado en la cotización: "Hosting: NO INCLUIDO".
- **Notificaciones in-app, WhatsApp o SMS**. Solo email según decisión D4.
- **i18n / multi-idioma**. Solo español (SUPUESTO S9).

---

## 1.5. Glosario

| Término | Definición |
|---|---|
| **Plaza** | Centro comercial o agrupación de locales administrado por una empresa. Es la unidad de tenancy (cada plaza es un cliente SaaS aislado). |
| **Local** | Unidad física dentro de una plaza, alquilada a un inquilino. Tiene código, metraje, ubicación, estado y disponibilidad. |
| **Inquilino** | Persona jurídica o física que alquila uno o varios locales. Tiene usuarios que la representan en el sistema. |
| **Contrato** | Registro del acuerdo de alquiler que vincula a un local con un inquilino durante un período (fecha inicio, fecha fin, monto, condiciones). |
| **Solicitud / Permiso** | Petición formal que un inquilino eleva a la administración para realizar una actividad (mantenimiento, evento, remodelación, otro). |
| **Tipo de solicitud** | Categoría de la solicitud: `mantenimiento`, `evento`, `remodelacion`, `otro`. |
| **Estado de solicitud** | Etapa del ciclo de vida: `borrador`, `enviada`, `en_revision`, `aprobada`, `rechazada`, `cancelada`, `requerida_subsanacion`. |
| **Aprobación** | Transición y registro por el cual un administrador de plaza acepta o rechaza una solicitud, con un comentario. |
| **Adjunto** | Archivo (plano, permiso, foto, PDF) asociado a una solicitud. |
| **Administrador de plaza** | Usuario de la administración que opera una plaza concreta: aprueba solicitudes, gestiona usuarios, ve reportes. |
| **Superadministrador** | Usuario a nivel plataforma que crea y configura plazas. No es cliente final, es operador del SaaS. |
| **Tenant** | Sinónimo de "plaza" en el contexto multi-tenant. Cada tenant tiene un `plaza_id` que aísla sus datos. |
| **SMTP** | Servicio de envío de correo electrónico saliente. |
| **MinIO** | Almacenamiento de objetos compatible con S3, usado para guardar adjuntos. |
| **JWT** | JSON Web Token, formato de token firmado utilizado para autenticar requests. |
| **Auth.js (NextAuth)** | Librería de autenticación para Next.js que soporta estrategias de credenciales, OAuth y JWT. |
| **SaaS** | Software como servicio. Modelo de entrega donde múltiples clientes usan la misma instalación aislada por tenant. |

---

## 1.6. Stakeholders y roles

| Rol | Quién es | Qué hace en el sistema |
|---|---|---|
| **Superadministrador (superadmin)** | Equipo de Helixsys / operador de la plataforma | Da de alta plazas, asigna el primer administrador de cada plaza, ve métricas globales. |
| **Administrador de plaza (admin_plaza)** | Personal de la empresa administradora de la plaza | Configura su plaza, gestiona usuarios, aprueba/rechaza solicitudes, ve reportes y calendario. |
| **Inquilino (inquilino)** | Comercio o negocio arrendatario | Crea, envía y da seguimiento a sus solicitudes. Ve su calendario y adjuntos. |

Detalle de la matriz de permisos por módulo y acción: ver [`06-roles-y-permisos.md`](./06-roles-y-permisos.md).

---

## 1.7. Restricciones y supuestos generales

> Toda decisión marcada con `SUPUESTO` debe ser validada con el cliente antes de pasar a implementación.

- **R1 — Stack frontend:** Next.js (App Router) + TypeScript, en reemplazo del Angular de la cotización original, por mejor performance, SSR/SSG y DX. (Ver justificación en [`02-stack-tecnologico.md`](./02-stack-tecnologico.md).)
- **R2 — Stack backend:** Node.js + NestJS + PostgreSQL, según la cotización.
- **R3 — Multi-tenant:** cada plaza es un tenant aislado. Estrategia: **base de datos compartida, esquema compartido, discriminador `plaza_id`** en cada tabla de negocio. (SUPUESTO S-EstrategiaMT — recomendado sobre schema-per-tenant o DB-per-tenant por menor costo operativo y simplicidad de migraciones.)
- **R4 — Autenticación:** Auth.js (NextAuth) en el frontend con estrategia **JWT**, y NestJS emite/valida los mismos tokens con clave compartida (HS256) o JWKS. Doble verificación frontend/backend. (Decisión D3.)
- **R5 — Notificaciones:** exclusivamente por email mediante SMTP. Sin in-app/WhatsApp/SMS. (Decisión D4, alineado al PDF.)
- **R6 — Almacenamiento:** MinIO (compatible S3), auto-hospedado, según la cotización.
- **R7 — Hosting:** no incluido en la cotización. Queda como decisión del cliente.
- **R8 — Idioma:** español únicamente, sin i18n. (SUPUESTO S9.)
- **R9 — Datos de contacto:** el sistema almacena nombre, email y teléfono de los usuarios; no almacena datos sensibles de pago.
- **R10 — Auditoría:** toda acción de aprobación/rechazo, edición de estado y cambio de rol queda registrada en una tabla de auditoría con timestamp y usuario. (SUPUESTO — alineado con buenas prácticas, no explícito en PDF.)
- **R11 — Datos no especificados en la cotización:** se asumen defaults sensatos y se marcan como `SUPUESTO` en cada documento correspondiente. Cualquier inconsistencia con la realidad del cliente se resolverá antes del kickoff.

---

## 1.8. Cronograma de referencia

Según la cotización (COT-2026-0012, semana a partir de aprobación):

| Semana | Actividades |
|---|---|
| 1 | Diseño UI/UX, arquitectura del sistema, configuración de base de datos |
| 2 | Módulos principales: autenticación, gestión de locales, solicitudes y aprobaciones |
| 3 | Integraciones: email, calendario, documentos adjuntos, reportes y panel admin |
| 4 | Pruebas integrales, correcciones, despliegue en producción y entrega final |

Este cronograma es referencial para la documentación. Los hitos contractuales son los definidos en la sección 7 de la cotización.

---

## 1.9. Cómo usar este documento

Este archivo define el "qué" y el "para qué". Los demás documentos desglosan el "cómo":

- Stack técnico → [`02-stack-tecnologico.md`](./02-stack-tecnologico.md)
- Módulos en detalle → [`03-modulos-del-sistema.md`](./03-modulos-del-sistema.md)
- Modelo de datos → [`04-modelo-de-datos.md`](./04-modelo-de-datos.md)
- Flujo de solicitudes → [`05-flujo-de-solicitudes.md`](./05-flujo-de-solicitudes.md)
- Roles y permisos → [`06-roles-y-permisos.md`](./06-roles-y-permisos.md)
- Arquitectura → [`07-arquitectura.md`](./07-arquitectura.md)
