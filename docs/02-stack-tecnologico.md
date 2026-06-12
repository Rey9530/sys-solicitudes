# 02 · Stack Tecnológico

> **Código del documento:** `DOC-02-ST`
> **Estado:** Borrador para validación
> **Origen:** Cotización COT-2026-0012 (Helixsys · 20/05/2026) + decisiones del cliente

---

## 2.1. Resumen del stack

| Capa | Tecnología | Origen de la decisión |
|---|---|---|
| **Frontend (Portal)** | Next.js 14+ (App Router) + React 18 + TypeScript | **Cambio** vs. Angular del PDF (justificación §2.3) |
| **UI** | Tailwind CSS + shadcn/ui + lucide-react | SUPUESTO S-UI |
| **Backend (API)** | Node.js 24.X + NestJS 10 | PDF (sección 3) |
| **ORM** | Prisma 7 | SUPUESTO S-ORM |
| **Validación** | Zod (compartido FE/BE) | SUPUESTO S-Validación |
| **Base de datos** | PostgreSQL 16 | PDF (sección 3) |
| **Autenticación** | Auth.js (NextAuth v5) + JWT compartido con NestJS (HS256) | Decisión D3 |
| **Almacenamiento de archivos** | MinIO (compatible S3) | PDF (sección 3) |
| **Generación de reportes** | jsreport 4.13 (`jsreport/jsreport:4.13.0`) como contenedor Docker separado. El backend NO instala librerías de generación; solo hace de proxy HTTP al servicio de jsreport. | Decisión del equipo |
| **Email transaccional** | SMTP (Nodemailer en NestJS) | PDF (sección 3) |
| **Calendario interactivo** | FullCalendar (`@fullcalendar/react`) | SUPUESTO S-Calendario |
| **Fechas y TZ** | `date-fns` + `date-fns-tz` | SUPUESTO S-Fechas |
| **Despliegue (referencia)** | Docker + docker-compose | SUPUESTO S-Deploy |
| **Tests** | Sin tests unitarios. Verificación funcional manual de cada endpoint con el backend levantado (ver §2.11). | Decisión del equipo |
| **Calidad de código** | ESLint + Prettier + TypeScript strict | Estándar |
| **Control de versiones** | Git (GitHub o GitLab, a definir con cliente) | Estándar |

---

## 2.2. Topología general

```
┌──────────────────────────────────────────────────────────────────┐
│                          NAVEGADOR                                │
│  (inquilino / administrador / superadmin)                         │
└──────────────────┬───────────────────────────────────────────────┘
                   │ HTTPS
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  FRONTEND — Next.js 14 (App Router)                               │
│  - Server Components por defecto                                  │
│  - Client Components para formularios, calendario, uploads        │
│  - Auth.js (NextAuth) gestiona sesión vía cookie httpOnly         │
│  - Server Actions para mutaciones simples                         │
│  - BFF ligero: el frontend NO expone la API de NestJS             │
└──────────────────┬───────────────────────────────────────────────┘
                   │ fetch + Authorization: Bearer <jwt>
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  BACKEND — NestJS 10 (API REST /api/v1)                           │
│  - Guards: JwtAuthGuard + PlazaScopeGuard + RolesGuard            │
│  - Validación: class-validator + Zod en DTOs                      │
│  - Módulos: auth, plazas, usuarios, roles-staff, locales,        │
│             contratos, categorias, solicitudes, aprobaciones,     │
│             notificaciones, calendario, adjuntos, reportes,       │
│             admin, auditoria                                      │
└──────┬──────────────────┬──────────────────┬──────────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
│  PostgreSQL  │   │    MinIO     │   │   SMTP Server    │
│  (datos)     │   │  (adjuntos)  │   │  (notificaciones)│
└──────────────┘   └──────────────┘   └──────────────────┘
```

---

## 2.3. Justificación: Next.js en lugar de Angular

> La cotización original (COT-2026-0012, sección 3) propone **Angular** como framework frontend. Esta propuesta lo sustituye por **Next.js**. A continuación el sustento técnico.

### 2.3.1. Comparativa resumida

| Criterio | Angular | Next.js (App Router) | Observación |
|---|---|---|---|
| **Renderizado** | SPA (CSR) por defecto | SSR, SSG, ISR y CSR combinables | Mejor performance percibida y mejor SEO si se requiere landing pública |
| **TTFB / FCP** | Depende de bundle | Mejora con SSR streaming y `Suspense` | Impacto medible en primera carga |
| **SEO** | Limitado (requiere Angular Universal) | Nativo | Útil si en el futuro hay páginas públicas (p. ej. estado de plaza) |
| **DX** | TypeScript first, opinionado | TypeScript first, opinionado pero menos rígido | Empate, pero comunidad React más amplia |
| **Ecosistema UI** | Angular Material, PrimeNG, ng-bootstrap | Tailwind, shadcn/ui, Radix, MUI, Chakra | Mayor oferta de componentes accesibles y modernos |
| **Curva de aprendizaje** | Alta (RxJS, DI, módulos, decorators) | Media (más estándar de JavaScript) | Equipo se incorpora más rápido |
| **Comunidad / oferta laboral** | Menor crecimiento | Mayor crecimiento y oferta | Riesgo de mantenimiento a largo plazo |
| **Server Components / Data Fetching** | No nativo | Nativo (RSC, Server Actions) | Reduce código de fetching manual y bundle de cliente |
| **Tamaño inicial del bundle** | Mayor en aplicaciones grandes | Mejor con tree-shaking y code splitting por ruta | Diferencia perceptible en mobile |
| **Tooling** | Angular CLI | `create-next-app`, Turbopack | Build más rápido con Turbopack |
| **Alineación con NestJS** | Buena | Buena (ambos en TS, mismo paradigma) | Empate |

### 2.3.2. Implicaciones del cambio

- **Implicación 1 — Migración futura no aplica:** se parte de cero, no hay código Angular que migrar.
- **Implicación 2 — Hosting:** Next.js puede desplegarse en Vercel, pero la cotización no incluye hosting. Se recomienda Dockerizar y orquestar con `docker-compose` o Kubernetes para mantener coherencia con NestJS y MinIO. (SUPUESTO S-Deploy.)
- **Implicación 3 — Estado del lado cliente:** para datos globales (sesión, permisos, plaza actual) se prefiere Server Components + `cache()` de Next.js en lugar de Redux/Zustand, salvo en módulos que lo necesiten (calendario, drag-and-drop).
- **Implicación 4 — Forms:** se recomienda **React Hook Form + Zod** para formularios complejos (crear/editar solicitudes, usuarios, locales).

### 2.3.3. Riesgos mitigados

- **Riesgo de SEO no necesario en esta entrega:** la app es un portal autenticado; SSR aporta principalmente performance, no SEO. *Mitigación:* seguir aprovechando SSR para datos del lado servidor (panel admin) y mantener la opción de renderizar páginas públicas en el futuro.
- **Riesgo de Server Components vs librerías de terceros incompatibles:** algunos componentes (FullCalendar) requieren Client Components. *Mitigación:* marcar explícitamente con `"use client"` solo donde sea necesario y aislar en `/components/client/`.

---

## 2.4. Backend: NestJS

NestJS se mantiene según la cotización por:

- Coherencia con TypeScript en ambos extremos.
- Patrón de **módulos** que mapea 1:1 a los módulos funcionales del sistema.
- Decoradores para `Guards`, `Interceptors`, `Pipes` que cubren el multi-tenant (`@PlazaScope()`), la autorización por rol y la validación.
- Ecosistema maduro (`@nestjs/jwt`, `@nestjs/passport`, `@nestjs/swagger` para documentación OpenAPI, `@nestjs/throttler` para rate limit, `@nestjs/schedule` para tareas programadas como recordatorios de calendario).

### 2.4.1. Estructura de módulos NestJS (referencia)

```
src/
├── app.module.ts
├── main.ts
├── common/                # filtros, interceptors, guards globales
│   ├── guards/jwt-auth.guard.ts
│   ├── guards/plaza-scope.guard.ts
│   ├── guards/roles.guard.ts
│   └── decorators/current-user.decorator.ts
├── config/                # carga de .env tipado
├── modules/
│   ├── auth/              # /api/v1/auth
│   ├── plazas/            # /api/v1/plazas
│   ├── usuarios/          # /api/v1/usuarios
│   ├── roles-staff/       # /api/v1/roles-staff  ← NUEVO: CRUD de roles operativos
│   ├── locales/           # /api/v1/locales
│   ├── contratos/         # /api/v1/contratos
│   ├── solicitudes/       # /api/v1/solicitudes
│   ├── aprobaciones/      # /api/v1/solicitudes/:id/aprobacion
│   ├── notificaciones/    # servicio interno, /api/v1/notificaciones (log)
│   ├── calendario/        # /api/v1/calendario
│   ├── adjuntos/          # /api/v1/solicitudes/:id/adjuntos
│   ├── reportes/          # /api/v1/reportes (BFF: delega PDF/XLSX a jsreport; CSV inline)
│   │   ├── controllers/
│   │   ├── services/
│   │   │   ├── reportes.service.ts        # orquesta query BD + llamada a jsreport
│   │   │   └── jsreport.client.ts         # wrapper HTTP fino (fetch/undici)
│   │   ├── templates/                     # HTML/handlebars inline, versionados en git
│   │   │   ├── solicitudes-pdf.html
│   │   │   ├── solicitudes-xlsx.html
│   │   │   ├── locales-pdf.html
│   │   │   ├── locales-xlsx.html
│   │   │   ├── inquilinos-pdf.html
│   │   │   └── inquilinos-xlsx.html
│   │   ├── dto/
│   │   └── csv/                           # generador inline de CSV (sin librería)
│   ├── categorias/        # /api/v1/categorias  ← NUEVO: CRUD con sub-recurso subcategorias
│   └── admin/             # /api/v1/admin (superadmin)
└── prisma/
    ├── schema.prisma
    └── migrations/
```

### 2.4.2. ORM — Prisma

**SUPUESTO S-ORM.** Se recomienda Prisma sobre TypeORM por:

- Schema declarativo en `schema.prisma` que sirve como documentación viva.
- Migraciones versionadas (`prisma migrate deploy`).
- Tipos TypeScript generados automáticamente, perfectos para compartir DTOs con el frontend.
- Soporte nativo de transacciones, `include`, `select` y `where` complejos (necesarios para reportes).

### 2.4.3. Validación — Zod

**SUPUESTO S-Validación.** Se comparte un paquete `@app/contracts` con esquemas Zod que se usan:

- En el **backend** con `ZodValidationPipe` de NestJS.
- En el **frontend** con `react-hook-form` y `@hookform/resolvers/zod`.

Esto evita duplicar reglas de validación y mantiene una sola fuente de verdad.

---

## 2.5. Base de datos — PostgreSQL 16

Según cotización. Se usa como base única para todos los tenants. Estrategia multi-tenant: **DB compartida + esquema compartido + discriminador `plaza_id`** en cada tabla de negocio (ver [`04-modelo-de-datos.md`](./04-modelo-de-datos.md)).

### 2.5.1. Consideraciones

- **Row-Level Security (RLS):** se habilita como segunda capa de defensa, con políticas que filtran por `plaza_id` extraído de la sesión.
- **Índices:** cada FK `plaza_id` y los campos de filtro frecuente (`estado`, `tipo`, `created_at`, `local_id`) van indexados.
- **Unique constraints compuestos:** p. ej. `UNIQUE (plaza_id, codigo)` en `local` para que dos plazas puedan tener el mismo código de local.
- **Soft delete:** campo `deleted_at` en `plaza`, `local`, `contrato`, `usuario` para no romper auditoría.

---

## 2.6. Autenticación — Auth.js (NextAuth) + JWT compartido

> Decisión D3 confirmada por el cliente. **NO** se usa NextAuth con sesión, **NO** se usa Auth.js como único emisor: el sistema usa una arquitectura de **token compartido** entre frontend y backend.

### 2.6.1. Flujo

1. El usuario llega a `/login` (Next.js).
2. NextAuth expone un **Credentials Provider** que internamente llama a `POST /api/v1/auth/login` de NestJS con `{ email, password }`.
3. NestJS valida credenciales, genera un **JWT firmado con HS256** usando una clave secreta en variable de entorno (`JWT_SECRET`).
4. El JWT contiene al menos: `sub` (user id), `plaza_id`, `rol`, `iat`, `exp`.
5. NextAuth guarda el JWT en una **cookie httpOnly + secure + sameSite=lax**.
6. En cada request al backend, el frontend envía `Authorization: Bearer <jwt>`.
7. NestJS valida la firma con la **misma** `JWT_SECRET` y carga el usuario en `request.user`.
8. `PlazaScopeGuard` valida que cualquier registro cargado pertenezca al `plaza_id` del token.

### 2.6.2. Tokens

- **Access token:** 15 min de expiración.
- **Refresh token:** 7 días, rotado en cada uso, almacenado como hash en tabla `refresh_token` con `revoked_at`.
- **Recuperación de contraseña:** token de un solo uso (UUID v4) firmado con JWT, expira en 30 minutos. (SUPUESTO S-Reset.)

### 2.6.3. Logout

- Revoca el `refresh_token` en BD.
- Limpia la cookie en Next.js.
- El access token expirará por sí solo en 15 min.

### 2.6.4. ¿Por qué no solo NextAuth con sesiones?

- Para mantener **una sola fuente de verdad de identidad** (NestJS) que puede ser consumida por clientes no web en el futuro (CLI, integraciones).

---

## 2.7. Almacenamiento — MinIO

Según cotización, sección 3. Se usa como **object storage** para todos los archivos adjuntos a solicitudes y a locales (fotos, planos, permisos).

### 2.7.1. Diseño

- Un **bucket por tipo de archivo**:
  - `solicitudes-adjuntos-{plaza_id}` (separa por tenant para facilitar exportación/eliminación).
  - `locales-planos-{plaza_id}`.
- Las URLs firmadas (pre-signed) se generan desde el backend con expiración de 15 min.
- **Límite de tamaño por archivo:** 25 MB por defecto. (SUPUESTO S-TamañoMax.)
- **Tipos MIME permitidos:** PDF, JPG, PNG, WEBP, XLSX, DOCX, DWG (SUPUESTO S-MimeTypes; DWG requiere visor externo).
- **Antivirus / escaneo:** fuera de alcance de la v1. (SUPUESTO — debe confirmarse.)

---

## 2.8. Notificaciones por email (SMTP)

Según cotización. Implementación con **Nodemailer** en NestJS, dentro del módulo `notificaciones`.

### 2.8.1. Plantillas

- Plantillas HTML con logo y datos de la plaza (pasados en el render).
- Idiomas: español únicamente.

### 2.8.2. Disparadores

| Evento | Destinatario | Plantilla |
|---|---|---|
| Solicitud enviada (legacy: estado `enviada` sin responsable) | `admin_plaza` de la plaza | `solicitud-recibida.html` |
| Solicitud auto-asignada al responsable de la subcategoría | Responsable de `subcategoria.responsable_id` | `solicitud-asignada-responsable.html` |
| Nueva solicitud notificada a supervisor de subcategoría | Cada uno de los hasta 5 supervisores | `solicitud-nueva-supervisor.html` |
| Solicitud reasignada manualmente a otro staff | Nuevo `admin_asignado_id` | `solicitud-reasignada.html` |
| Solicitud aprobada | `inquilino` solicitante | `solicitud-aprobada.html` |
| Solicitud rechazada | `inquilino` solicitante | `solicitud-rechazada.html` |
| Solicitud requiere subsanación | `inquilino` solicitante | `solicitud-subsanacion.html` |
| Recordatorio de evento próximo (T-24h) | Todos los involucrados | `evento-recordatorio.html` |
| Reset de contraseña | Usuario solicitante | `reset-password.html` |
| Bienvenida a nuevo usuario | Usuario nuevo | `bienvenida.html` |

### 2.8.3. Resiliencia

- Cola simple con tabla `email_log` (`estado: pendiente | enviado | fallido`, `reintentos`, `last_error`).
- Reintentos exponenciales (3 intentos: 1 min, 5 min, 30 min).
- Worker con `@nestjs/schedule` corre cada 1 min.

---

## 2.9. Calendario

**SUPUESTO S-Calendario.** Se propone **FullCalendar** en su variante React por:

- Vistas mes/semana/día/lista.
- Drag-and-drop de eventos (opcional).
- Soporte de eventos con todo el día y con horario.
- Theming consistente con Tailwind.

Renderizado como **Client Component** (requiere DOM).

---

## 2.10. UI Design System

**SUPUESTO S-UI.** Stack propuesto:

- **Tailwind CSS** para utility-first styling.
- **shadcn/ui** para componentes accesibles (basado en Radix UI).
- **lucide-react** para iconos.
- **SweetAlert2** (v11.x) para todos los diálogos de **decisión / confirmación destructiva** (deshabilitar, eliminar, resetear, reactivar). **Prohibido** `window.confirm` / `window.alert` nativos. Wrapper reutilizable en `frontend/src/lib/sweetalert.ts` con `confirmAction({...})`, `notifySuccess(...)`, `notifyError(...)`. Toasts efímeros no modales siguen yendo por `sonner` (más liviano, no bloquea la UI).
- **Tema:** se usa un tema base con un slot para el **color primario de la plaza** (SUPUESTO — ver `Branding` por plaza).
- **Responsive:** mobile-first, breakpoints estándar de Tailwind.

---

## 2.11. Verificación funcional de endpoints

> **Decisión del equipo.** No se escriben tests unitarios (Vitest, Jest), ni tests de integración (Supertest), ni tests e2e automatizados (Playwright). La verificación de cada endpoint se hace **manualmente** levantando el backend real y probando el endpoint con `curl`, Postman, Insomnia o Bruno. La validación de la respuesta se hace contra el Zod schema correspondiente en `packages/contracts/`.

### 2.11.1. Procedimiento al crear o modificar un endpoint

1. **Comprobar si el backend ya está escuchando en `:4000`.**

   - PowerShell (Windows):
     ```powershell
     Test-NetConnection -ComputerName localhost -Port 4000 -InformationLevel Quiet
     # o, para ver el PID:
     Get-NetTCPConnection -LocalPort 4000 -State Listen
     ```
   - Bash (Git Bash / Linux / macOS):
     ```bash
     lsof -i :4000
     # o:
     ss -ltn 'sport = :4000'
     ```
   - Si el puerto está ocupado: **hay una instancia activa del backend; reutilizarla y saltar al paso 3.**
   - Si el puerto está libre: continuar al paso 2.

2. **Levantar el backend (solo si no había nada escuchando).**

   - En la raíz del repo: `docker-compose up -d` (postgres, minio, mailhog).
   - En `backend/`: `npm run start:dev` (NestJS en `:4000` con watch mode, reinicia al guardar).

3. **Probar el endpoint con la herramienta disponible:**

   - Con `curl`:
     ```bash
     curl -X POST http://localhost:4000/api/v1/auth/login \
       -H "Content-Type: application/json" \
       -d '{"email":"admin@acme.test","password":"..."}'
     ```
   - Con Postman / Insomnia / Bruno: importar la request o crearla, enviando el JWT en `Authorization: Bearer <token>` cuando aplique.

4. **Validar la respuesta:**

   - **Status code** esperado (200, 201, 400, 401, 403, 404, 409, 500).
   - **Shape del body** contra el Zod schema en `packages/contracts/` (importarlo y usar `.safeParse()` mentalmente; o copiar el JSON en un REPL de Node con el schema).
   - **Side effects** cuando aplique: fila creada/actualizada en BD, entrada en `email_log`, objeto en MinIO, fila en `auditoria`, etc.

5. **Si la prueba falla:**

   - Revisar los logs del backend en consola (formato `pino`).
   - Si el código cambió, NestJS en watch mode ya reinició; **repetir el paso 3** sin reiniciar manualmente.
   - Si la instancia quedó en mal estado (procesos colgados, conexión a BD rota): detenerla con `Ctrl+C` en su terminal, o matar el PID que retornó `Get-NetTCPConnection` / `lsof`, y volver al paso 1.

### 2.11.2. Comandos de referencia rápida

| Acción | Windows (PowerShell) | Bash (Git Bash / Linux / macOS) |
|---|---|---|
| ¿Hay algo en `:4000`? | `Test-NetConnection localhost -Port 4000 -InformationLevel Quiet` | `lsof -i :4000` |
| Ver PID que escucha en `:4000` | `Get-NetTCPConnection -LocalPort 4000 -State Listen` | `lsof -ti:4000` |
| Levantar backend | `cd backend ; npm run start:dev` | `cd backend && npm run start:dev` |
| Apagar backend | `Ctrl+C` en la terminal del backend, o `Stop-Process -Id <PID> -Force` | `Ctrl+C`, o `kill <PID>` |
| Probar endpoint | `curl -X METHOD http://localhost:4000/api/v1/...` | igual |

### 2.11.3. Lo que esta estrategia excluye explícitamente

- No se instalan ni configuran frameworks de test (Vitest, Jest, Playwright, Supertest).
- No se generan archivos `*.spec.ts`, `*.test.ts` ni equivalentes.
- No se ejecutan suites automáticas en CI (ver §2.13 / `docs/07-arquitectura.md` §7.9 para el CI resultante).
- No se mockean dependencias: la verificación corre contra el backend real con la BD, MinIO y SMTP (MailHog en dev) levantados.

---

## 2.12. Generación de reportes con jsreport

> **Decisión del equipo.** Los reportes **no se generan en el backend**. Se levantará un contenedor independiente con **jsreport 4.13** ([documentación oficial](https://jsreport.net/learn/docker)) y el backend actuará como proxy HTTP (BFF) hacia él.

### 2.12.1. Arquitectura

```
┌───────────┐  GET /api/v1/reportes/.../export.{pdf,xlsx}  ┌───────────┐  POST /api/report
│ Frontend  │ ───────────────────────────────────────────▶ │ Backend   │ ────────────────────▶ ┌───────────┐
│ (Next.js) │ ◀────────────── binario (PDF/XLSX) ───────── │ (NestJS)  │ ◀───── binario ────  │ jsreport  │
└───────────┘                                              └───────────┘                      │ (Docker)  │
                                                                                              └───────────┘
                                                       ▲
                                                       │ Prisma query (con plaza_id)
                                                       │
                                                  ┌───────────┐
                                                  │ PostgreSQL│
                                                  └───────────┘
```

- **El frontend** llama al endpoint NestJS como hasta ahora (sin cambios en la UX).
- **El backend** (módulo `reportes`) hace: (1) valida JWT, (2) aplica `PlazaScopeGuard` + `RolesGuard`, (3) consulta la BD con Prisma aplicando el `plaza_id` del token, (4) arma el HTML/handlebars a partir de la plantilla y los datos, (5) hace `POST http://jsreport:5488/api/report` con `template.content` + `recipe` + `data`, (6) streamea la respuesta binaria de vuelta al frontend con el `Content-Type` adecuado.
- **jsreport** corre como contenedor separado (`jsreport/jsreport:4.13.0`), escucha en `5488`, expone `chrome-pdf` (PDF) y `xlsx` (Excel). No tiene acceso directo a PostgreSQL; recibe todo lo que necesita en el body de la request.

### 2.12.2. Versión y origen

- **Imagen Docker:** `jsreport/jsreport:4.13.0` (estable al día de hoy). Fuente: <https://jsreport.net/learn/docker>.
- **Puerto interno:** `5488/tcp`. Mapeo recomendado host `5488:5488` en desarrollo.
- **Recipes usados:** `chrome-pdf` (PDF, headless Chromium embebido) y `xlsx` (Excel nativo, sin Chromium). La elección de `xlsx` (no `html-to-xlsx`) es deliberada: produce archivos más livianos y respeta mejor los anchos de columna.

### 2.12.3. Plantillas (templates)

> Las plantillas se almacenan **inline en el backend** (no en el volumen de jsreport). Esto permite versionarlas en git, revisarlas en PRs y no perderlas al borrar el volumen.

- **Ubicación:** `backend/src/modules/reportes/templates/`. Archivos `.html` con placeholders de Handlebars (`{{variable}}`, `{{#each rows}}...{{/each}}`).
- **Por módulo:** una plantilla por formato y por entidad (ej.: `solicitudes-pdf.html`, `solicitudes-xlsx.html`, `locales-pdf.html`, etc.).
- **Carga:** el `reportes.service.ts` lee el archivo correspondiente con `fs.readFile` y lo envía a jsreport en el campo `template.content` del body. No se persisten plantillas dentro del contenedor jsreport.
- **Hot reload:** durante el desarrollo, los cambios en `backend/src/modules/reportes/templates/*.html` se ven reflejados al volver a llamar al endpoint, sin reiniciar nada (NestJS no compila esos archivos; el backend los lee en cada request).

### 2.12.4. Configuración de jsreport (env vars del contenedor)

| Variable | Valor ejemplo | Propósito |
|---|---|---|
| `chrome_launchOptions_args` | `--no-sandbox,--disable-dev-shm-usage,--disable-gpu` | Necesario para que el Chromium embebido arranque en Docker. |
| `extensions_authentication_admin_username` | `admin` | Usuario para HTTP Basic. |
| `extensions_authentication_admin_password` | (secreto fuerte) | Contraseña. |
| `extensions_authentication_cookieSession_secret` | (32+ chars random) | Secreto de sesión para el Studio. |

Estas variables se cargan en `docker-compose.yml` y se referencian desde el `.env` raíz.

### 2.12.5. Llamada HTTP del backend a jsreport (referencia)

Sin instalar el cliente oficial (`@jsreport/nodejs-client`), se usa `fetch` nativo de Node 24:

```ts
const res = await fetch(`${process.env.JSREPORT_URL}/api/report`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + Buffer.from(
      `${process.env.JSREPORT_ADMIN_USER}:${process.env.JSREPORT_ADMIN_PASSWORD}`
    ).toString('base64'),
  },
  body: JSON.stringify({
    template: { content: htmlString, engine: 'handlebars', recipe: 'chrome-pdf' },
    data: queryResult,
  }),
});
// res.body es un ReadableStream<NodeJS.ReadableStream> que se streamea al cliente.
```

### 2.12.6. Endpoints del backend (sin cambios en la URL, solo se agrega `.pdf`)

| Verbo | Ruta | Formato | Generación |
|---|---|---|---|
| `GET` | `/api/v1/reportes/solicitudes/export.csv` | text/csv | Backend, inline (concatenación de strings, separador `,`, UTF-8 con BOM). Sin librería. |
| `GET` | `/api/v1/reportes/solicitudes/export.xlsx` | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | Backend → jsreport (`recipe: 'xlsx'`). |
| `GET` | `/api/v1/reportes/solicitudes/export.pdf` | application/pdf | Backend → jsreport (`recipe: 'chrome-pdf'`). |
| `GET` | `/api/v1/reportes/locales/:id/export.pdf` | application/pdf | idem. |
| `GET` | `/api/v1/reportes/inquilinos/:id/export.pdf` | application/pdf | idem. |

(Se mantiene el patrón `export.{formato}` ya documentado en `docs/07-arquitectura.md` §7.5.2; solo se agrega `.pdf` para todas las entidades.)

### 2.12.7. Lo que el backend NO debe instalar

Documentar explícitamente para que nadie agregue dependencias por su cuenta:

- ❌ `@jsreport/nodejs-client` (cliente oficial; no es necesario, fetch basta).
- ❌ `exceljs`, `xlsx-populate`, `excel4node`, `node-xlsx`, `write-excel-file`.
- ❌ `pdfkit`, `pdfmake`, `pdf-lib`, `jspdf`, `html-pdf-node`, `puppeteer`, `playwright` (para PDF).
- ❌ Cualquier wrapper o binding a LibreOffice / wkhtmltopdf / WeasyPrint.

Si alguien necesita un formato nuevo, el camino es: **agregar una receta de jsreport + una plantilla**, no instalar una librería de Node.

### 2.12.8. Healthcheck de jsreport

- **Endpoint:** `GET /api/ping` (no requiere autenticación, según la documentación oficial de jsreport).
- **Uso:** el backend puede llamarlo al inicio o el `docker-compose` puede definir un `healthcheck` para esperar a que jsreport esté listo antes de levantar el backend.

---

## 2.13. DevOps y despliegue

> La cotización indica "Hosting: NO INCLUIDO". El cliente debe decidir proveedor. Mientras tanto:

- **Dockerfile multi-stage** para `frontend` y `backend`.
- **`docker-compose.yml`** con servicios: `frontend`, `backend`, `postgres`, `minio`, `mailhog`, `jsreport` (contenedor independiente para generación de reportes; ver §2.12).
- **Variables de entorno** documentadas en `.env.example`.
- **Migraciones** con `prisma migrate deploy` en el arranque del backend.
- **CI/CD** con GitHub Actions sugerido (SUPUESTO): build, lint, test, build de imagen Docker, push a registry. (No está en la cotización.)

---

## 2.14. Resumen de SUPUESTOS técnicos pendientes de validar

| ID | Supuesto | Impacto si cambia |
|---|---|---|
| S-UI | Tailwind + shadcn/ui | Cambia toda la base de estilos |
| S-ORM | Prisma | Cambia capa de datos |
| S-Validación | Zod compartido | Cambia contratos y DTOs |
| S-Calendario | FullCalendar React | Cambia el módulo de calendario |
| S-Fechas | `date-fns` + TZ | Bajo, aislado en utilidades |
| S-Deploy | Docker + compose | Bajo, contenedorizado de todos modos |
| S-Reset | Token de 30 min | Reglas de seguridad |
| S-TamañoMax | 25 MB por archivo | Reglas de upload |
| S-MimeTypes | Lista de la §2.7.1 | Lista permitida en adjuntos |
| S-Branding | Color primario por plaza | CSS variables y módulo de configuración |
| S-EstrategiaMT | DB compartida + `plaza_id` | Alto — define el modelo de datos |
| S-JSReport | jsreport 4.13 como contenedor separado; backend no instala libs de generación | Bajo: cualquier contenedor compatible con el API funciona |
