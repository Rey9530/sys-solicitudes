# Inventario de Pantallas — Brief de Rediseño (Plazapp / sys-solicitudes)

> **Propósito de este documento.** Catálogo exhaustivo de **todas las pantallas** del frontend actual
> (`frontend/`, Next.js 14 App Router) para entregarlo a un proceso de rediseño visual (Claude Design).
> Describe, por cada pantalla: propósito, rol, ruta, estructura, componentes, datos, acciones, estados
> y los estilos Tailwind actuales. **No** describe lógica de backend ni de negocio salvo lo necesario
> para entender qué se muestra y qué transiciones existen.
>
> **Qué se pide al rediseño:** elevar la calidad visual manteniendo intacta la información, las acciones
> y los estados de cada pantalla. El stack permite re-theming sin tocar la lógica (ver §0).

---

## 0. Sistema de diseño actual (estado de partida)

El look actual es un **dashboard SaaS minimalista** sobre Tailwind v4 + shadcn/ui (`lucide-react` para iconos,
`sonner` para toasts, FullCalendar para el calendario, Recharts para gráficos). Es deliberadamente sobrio:
fondo claro, mucho gris neutro, un único color de acento, bordes finos y `shadow-sm`. Hay **poca jerarquía
visual, densidad alta y nula personalidad de marca** — es el principal objetivo a mejorar.

### Tokens reales (de `tailwind.config.ts` y `globals.css`)

| Token | Valor | Notas |
|---|---|---|
| `--color-primary` | `#2563eb` (azul) | **Dinámico por plaza**: se inyecta en `:root` con el `colorPrimario` del tenant. El rediseño debe asumir que el acento es variable. |
| `primary.50…900` | `color-mix()` sobre el primario | Escala derivada automáticamente del primario del tenant. |
| `--color-primary-foreground` | `#ffffff` | Texto sobre el acento. |
| `--font-sans` | `Inter`, system-ui fallback | Única familia tipográfica. |
| `body` | `bg-white text-gray-900 antialiased` | |
| focus | `outline-2 outline-offset-2 outline-primary` | Focus ring global accesible. |

### Clases de componente base (`@layer components`)
- `.btn` / `.btn-primary` / `.btn-secondary` / `.btn-ghost`: `rounded-md px-4 py-2 text-sm font-medium`, transición de color, `disabled:opacity-50`.
- `.input`: `w-full rounded-md border border-gray-300 px-3 py-2 text-sm` + focus primario.
- `.card`: `rounded-lg border border-gray-200 bg-white p-6 shadow-sm`.

### Paleta neutra y semántica (uso observado)
- **Fondos:** página `bg-gray-50`; tarjetas/tablas/forms `bg-white`.
- **Grises de texto:** `gray-900` (principal) → `700` (labels) → `600/500` (secundario) → `400` (hints).
- **Bordes:** `border-gray-200/300`, `border-dashed` para estados vacíos.
- **Radios/sombra:** `rounded-md`/`rounded-lg`/`rounded-xl`; `shadow-sm` (cards), `shadow-lg` (dialogs).
- **Semáforo de estados** (badges `inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset`):
  verde=ok/aprobado/vigente/disponible · azul/sky=info/enviada/alquilado · ámbar=warning/en_revisión/mantenimiento ·
  naranja=subsanación · índigo/cyan=asignado · rojo=error/rechazado/cancelado · gris=borrador/inactivo/terminal.

### Patrones estructurales repetidos
- **Shell:** header horizontal con branding + nav de links + botón "Cerrar sesión" (no hay sidebar). `<main>` centrado con `max-w-5xl` (público/superadmin/inquilino) o `max-w-6xl` (admin_plaza).
- **Listados:** header (título + subtítulo con total + botón "Nuevo") → barra de filtros (`rounded-lg border bg-white p-3`) → tabla (`rounded-lg border bg-white`) → paginación numérica centrada (página activa `bg-primary text-white`).
- **Detalle de recurso:** breadcrumb → H1 + badge de estado + botones de acción contextuales → **Tabs** (Datos / relacionados / Adjuntos / Historial).
- **Formularios:** `grid gap-4 rounded-lg border bg-white p-6`, `mx-auto max-w-lg`, label+input apilados, error `text-xs text-red-600`, botonera "Cancelar (outline) | Acción (primary)".
- **Diálogos modales:** shadcn `Dialog` (overlay `bg-black/40`, content `max-w-lg rounded-xl border bg-white p-6 shadow-lg`).
- **Toasts:** `sonner`, posición `top-right`, `richColors`.
- **Auto-refresh:** componente `AutoRefresh` (client, render nulo) que llama `router.refresh()` cada N ms en dashboards y bandeja.

> **Restricción de arquitectura relevante para el diseño:** el frontend es un BFF (Server Components / Server Actions);
> el JWT vive en cookie httpOnly y **nunca** llega al cliente. La interactividad real (`"use client"`) está aislada en
> `components/client/*` (calendario, formularios complejos, uploads, tablas con acciones). El rediseño debe respetar esa
> separación: lo estático puede permanecer en Server Components.

---

## Índice de pantallas

**Públicas / globales:** 1 Layout raíz · 2 Home/redirección · 3 Login · 4 Reset (solicitud) · 5 Reset (confirmar con token)
**Superadmin (plataforma):** 6 Shell superadmin · 7 Dashboard global · 8 Plazas (listado + alta)
**Admin de plaza:** 9 Shell admin · 10 Dashboard · 11 Locales (lista) · 12 Local (detalle) · 13 Nuevo local · 14 Inquilinos (lista) · 15 Inquilino (detalle) · 16 Nuevo inquilino · 17 Contratos (lista) · 18 Contrato (detalle) · 19 Nuevo contrato · 20 Categorías (lista) · 21 Nueva categoría · 22 Categoría (detalle) · 23 Subcategorías (gestor) · 24 Configuración (5 tabs) · 25 Bandeja de solicitudes · 26 Solicitud (detalle admin) · 27 Calendario admin · 28 Reportes · 29 Notificaciones
**Inquilino:** 30 Shell inquilino · 31 Mis solicitudes · 32 Nueva solicitud (wizard 3 pasos) · 33 Solicitud (detalle inquilino) · 34 Editar solicitud · 35 Mis contratos · 36 Contrato (detalle inquilino) · 37 Calendario inquilino
**Componentes transversales:** §38

---

# A. Públicas / globales

## 1. Layout raíz — `app/layout.tsx`
- **Rol:** todos. **Ruta:** envuelve toda la app.
- **Estructura:** `<html lang="es">`, `<body class="min-h-screen bg-white">`, `<Toaster>` (sonner, `top-right`, `richColors`).
- **Metadata:** título "Plazapp" / template `%s · Plazapp`; `robots: noindex,nofollow`; fuente Inter.
- **Rediseño:** punto único para tema global, modo oscuro y fuente. Sin contenido propio.

## 2. Home / redirección — `app/page.tsx`
- **Rol:** todos. **Ruta:** `/`.
- **Sin sesión:** card centrada (`max-w-md text-center`, `bg-gray-50`): logotipo "Plazapp" (H1 `font-bold text-primary`), subtítulo descriptivo, botón **"Iniciar sesión"** → `/login`.
- **Con sesión:** card `rounded-xl border bg-white p-8 shadow-sm` con: logo de la plaza (`plaza.logoUrl`, `h-12`), nombre comercial (o "Plazapp"), saludo "Hola, {nombre}" + email + rol, **botón de entrada según rol** (superadmin→`/superadmin/plazas`, admin→`/admin/locales`, inquilino→`/inquilino/contratos`) y **"Cerrar sesión"** (outline, server action).
- **Branding dinámico:** inyecta `:root{--color-primary: …}` con el color de la plaza.
- **Estados:** si falla `/auth/me`, usa datos de sesión sin enriquecer.
- **Rediseño:** es la "puerta de entrada" — candidata a hero/marca más fuerte y selección de destino más visual.

## 3. Login — `app/(public)/login/page.tsx` + `client/login-form.tsx`
- **Rol:** anónimo (redirige a `/` si ya hay sesión). **Ruta:** `/login`.
- **Layout:** card centrada `max-w-sm` sobre `bg-gray-50`. H1 "Plazapp" + "Inicia sesión para continuar".
- **Formulario (RHF + Zod `LoginSchema`):** `email` (placeholder `tucorreo@plazapp.com`), `password`. Errores `text-xs text-red-600`. Botón full-width `bg-primary` ("Iniciando…" en submit). Link "¿Olvidaste tu contraseña?" → `/reset-password`.
- **Acciones/estados:** `loginAction` → toast verde + redirect `/`; errores diferenciados `invalid` / `locked` (cuenta bloqueada) / `unknown` vía toast.
- **Rediseño:** pantalla de máxima exposición de marca; hoy es genérica.

## 4. Reset — solicitud — `app/(public)/reset-password/page.tsx` + `client/reset-request-form.tsx`
- **Rol:** anónimo. **Ruta:** `/reset-password`.
- **Layout:** misma card `max-w-sm`. H1 + "Restablecer contraseña".
- **Form:** un campo `email`; botón "Enviar enlace" ("Enviando…"); link "Volver a iniciar sesión".
- **Estado enviado:** sustituye el form por mensaje neutro "Si el email existe, recibirás un enlace… expira en 30 minutos" + link a login. (Respuesta neutra por seguridad — no revela si el email existe.)

## 5. Reset — confirmar con token — `app/(public)/reset-password/[token]/page.tsx` + `client/reset-confirm-form.tsx`
- **Rol:** anónimo con token. **Ruta:** `/reset-password/{token}`.
- **Layout:** card `max-w-sm`. H1 + "Elige una nueva contraseña".
- **Form (Zod con `refine` de coincidencia):** `newPassword` + `confirmPassword` (error "Las contraseñas no coinciden" bajo el segundo campo). Botón "Restablecer contraseña" ("Guardando…").
- **Estados:** éxito → toast + redirect `/login`; token inválido/expirado → vista de error "El enlace es inválido o ha expirado" + link a `/reset-password`.

---

# B. Superadmin (plataforma)

## 6. Shell superadmin — `app/(admin-plataform)/layout.tsx`
- **Rol:** `superadmin` (server-guard: sin sesión→`/login`, otro rol→`/`). **Ruta:** `/superadmin/*`.
- **Header** `border-b bg-white`, contenido `max-w-5xl`: izquierda "Plazapp" (`text-lg font-bold text-primary`) + nav (`Dashboard`, `Plazas`, links `text-gray-600 hover:text-primary`); derecha **"Cerrar sesión"** (Button outline sm, server action).
- **Main:** `min-h-screen bg-gray-50`, contenido `max-w-5xl px-4 py-8`.

## 7. Dashboard global — `app/(admin-plataform)/superadmin/dashboard/page.tsx`
- **Rol:** superadmin. **Ruta:** `/superadmin/dashboard`. Métricas **agregadas de todas las plazas**.
- **Estructura** (`space-y-6`, `AutoRefresh` cada 5 min): H1 "Dashboard global" + subtítulo → componente compartido `DashboardContenido` (mismo que admin, con `detalleHref=null` → los códigos no enlazan a detalle).
- **Contenido:** ver §10 (idéntico salvo el scope y la ausencia de links).

## 8. Plazas — listado + alta — `superadmin/plazas/page.tsx` + `client/plazas-table.tsx` + `client/nueva-plaza-dialog.tsx`
- **Rol:** superadmin. **Ruta:** `/superadmin/plazas`. Gestión de **tenants**.
- **Header:** H1 "Plazas" + subtítulo + **`NuevaPlazaDialog`** (botón "Nueva plaza").
- **Tabla `PlazasTable`** (`rounded-lg border bg-white`), columnas: **Plaza** (punto de color `h-3 w-3 rounded-full` con `colorPrimario` + nombre comercial) · **Slug** · **Contacto** (email o "—") · **Creada** (fecha en TZ plaza) · **Acciones** (botón ghost rojo "Desactivar"→"Desactivando…", con `confirm()`).
- **Empty:** "No hay plazas todavía." (`border-dashed p-8 text-center`).
- **Diálogo "Nueva plaza"** (`max-w-lg`): dos bloques separados por `border-t`.
  - *Datos de la plaza:* `nombreComercial`, `slug` (auto-`slugify` del nombre, editable), `colorPrimario` (`<input type=color>`), `emailContacto`, `telefonoContacto` (grids de 2 columnas).
  - *Administrador inicial:* `adminNombre`, `adminRolStaffCodigo` (select: Supervisor/Ingeniero/Técnico), `adminEmail`, `adminPassword` (temporal).
  - Botonera "Cancelar | Crear plaza". Éxito → toast + reset + cierra + refresh.
- **Rediseño:** la creación de tenant es un formulario denso en modal; valorar wizard/secciones con preview de marca (color + slug + logo).

---

# C. Admin de plaza

## 9. Shell admin — `app/(admin-plaza)/layout.tsx`
- **Rol:** `admin_plaza` (y `superadmin`). **Ruta:** `/admin/*`.
- **Header** `border-b bg-white`: "Plazapp" (`text-primary`) + **nav horizontal larga** (`flex gap-4`): Dashboard · Locales · Inquilinos · Contratos · Categorías · Solicitudes · Notificaciones · Calendario · Reportes · Configuración + "Cerrar sesión" (outline).
- **Main:** `bg-gray-50`, `max-w-6xl px-4 py-8`.
- **Rediseño:** **10 links horizontales saturan el header** — fuerte candidato a sidebar / nav agrupada con iconos.

## 10. Dashboard admin — `admin/dashboard/page.tsx` + `dashboard-kpis.tsx` + `client/dashboard-charts.tsx`
- **Rol:** admin_plaza. **Ruta:** `/admin/dashboard`. `AutoRefresh` 5 min. **Lectura, sin acciones.**
- **Estructura (`space-y-6`):**
  1. **5 KPI cards** (`grid sm:grid-cols-2 lg:grid-cols-5`, cada una `rounded-lg border bg-white p-4`, número `text-3xl font-bold` coloreado + label `text-xs text-gray-500`): Pendientes (ámbar) · Aprobadas hoy (verde) · Rechazadas hoy (rojo) · Eventos próximos 7d (azul) · Contratos por vencer 30d (violeta).
  2. **3 KPI secundarios** (`grid sm:grid-cols-3`): Tasa de aprobación (%) · Tiempo medio de respuesta (h) · Solicitudes con subsanación.
  3. **Gráficos Recharts** (`DashboardCharts`): **LineChart** tendencia mensual por estado (6 meses; colores por estado) · **BarChart** por tipo (barra `#2563eb`) · **PieChart** por prioridad (A=`#ef4444`…F=`#6b7280`).
  4. **2 listas** (`grid lg:grid-cols-2`): **Top 5 por antigüedad** (código→detalle + título + fecha) · **Actividad reciente** (código + evento + usuario + timestamp). Empty: "Sin solicitudes pendientes" / "Sin actividad registrada".
- **Rediseño:** densidad de números alta y plana; oportunidad de jerarquizar (KPIs primarios vs. secundarios), micro-tendencias (sparklines) y mejor tratamiento de gráficos.

## 11. Locales — listado — `admin/locales/page.tsx` + `client/locales-table.tsx` + `locales-filtros.tsx`
- **Ruta:** `/admin/locales`. Header (H1 "Locales" + total + **"Nuevo local"**).
- **Filtros** (`flex flex-wrap items-end gap-3`): Estado (select), Piso (input `w-28`), Sector (input `w-36`), "Limpiar filtros" (si hay activos). Disparo por `onBlur`/Enter/`onChange` → URLSearchParams.
- **Tabla:** Código (link→detalle) · Nombre · Piso · Sector · m² · Estado (badge) · acción "Desactivar" (ghost rojo, `confirm`).
- **Badges de local:** disponible=verde · alquilado=azul · en_mantenimiento=ámbar · fuera_de_servicio=gris.
- **Empty:** "No hay locales con esos criterios". **Paginación** numérica.

## 12. Local — detalle — `admin/locales/[id]/page.tsx` + `client/editar-local-form.tsx`
- **Ruta:** `/admin/locales/{id}`. Breadcrumb "Locales / {código}" + H1 "{código} · {nombre}" + badge estado.
- **Tabs (4):**
  1. **Datos** (`EditarLocalForm`, `max-w-lg`): `codigo` (disabled), `estado` (select; **disabled si tiene contrato vigente** — nota inline), `nombre`, `metrajeM2` (number step 0.01), `piso`, `sector`, `descripcion`. Botón "Guardar cambios".
  2. **Contratos (n):** lista de cards (vigente resaltada `border-green-300 ring`); fechas + monto/mes; click→`/admin/contratos/{id}`.
  3. **Adjuntos (n):** `AdjuntoUploader` (imágenes JPEG/PNG/WebP).
  4. **Solicitudes:** placeholder.
- **Footer:** timestamps creado/actualizado.

## 13. Nuevo local — `admin/locales/nuevo/page.tsx` + `client/nuevo-local-form.tsx`
- **Ruta:** `/admin/locales/nuevo`. H1 + "Se crea en estado «disponible»."
- **Form (`max-w-lg`):** `codigo`* (placeholder `L-101`), `metrajeM2`, `nombre`, `piso`+`sector` (2 cols), `descripcion`. Botonera "Cancelar | Crear local". Éxito → toast + redirect a listado.

## 14. Inquilinos — listado — `admin/inquilinos/page.tsx` + `inquilinos-table.tsx` + `inquilinos-filtros.tsx`
- **Ruta:** `/admin/inquilinos`. Header + "Nuevo inquilino".
- **Filtros:** Razón social (`w-56`), Identificación (`w-44`), "Limpiar".
- **Tabla:** Razón social (link→detalle) · Identificación · Contacto (nombre) · Email · "Desactivar". Empty + paginación estándar.

## 15. Inquilino — detalle — `admin/inquilinos/[id]/page.tsx` + `editar-inquilino-form.tsx` + `alta-usuario-inquilino-dialog.tsx`
- **Ruta:** `/admin/inquilinos/{id}`. Breadcrumb + H1 "{razón social}" + "ID: {identificación}" + botón **"Alta rápida de usuario"** (outline).
- **Tabs (3):**
  1. **Datos** (`max-w-lg`): `razonSocial` e `identificacion` **inmutables** (disabled, nota UX); editables: `direccion`, `contactoNombre`, `contactoTelefono`, `contactoEmail`. Botón izq "Desactivar" (rojo, disabled si contrato vigente) + der "Guardar cambios".
  2. **Contratos (n):** lista (vigente resaltado) → `/admin/contratos/{id}`.
  3. **Solicitudes:** placeholder.
- **Diálogo "Alta de usuario":** form (email + nombre prefilled) → al crear, muestra **contraseña temporal en monospace grande**, una sola vez, con aviso de compartirla de forma segura + botón "Entendido".

## 16. Nuevo inquilino — `admin/inquilinos/nuevo/page.tsx` + `nuevo-inquilino-form.tsx`
- **Ruta:** `/admin/inquilinos/nuevo`. Form `max-w-lg`: `razonSocial`*, `identificacion` (RUC/NIT), `direccion`, `contactoNombre`+`contactoTelefono` (2 cols), `contactoEmail`. Botonera Cancelar | Crear.

## 17. Contratos — listado — `admin/contratos/page.tsx` + `contratos-table.tsx` + `contratos-filtros.tsx`
- **Ruta:** `/admin/contratos`. Header + "Nuevo contrato".
- **Filtros (selects):** Local (`{codigo}`), Inquilino (`{razonSocial}`), Estado (vigente/finalizado/cancelado), "Limpiar".
- **Tabla:** Local (link) · Inquilino · Inicio · Fin ("Indefinido" si null) · Monto (`{moneda} {monto}` o "—") · Estado (badge: vigente=verde, finalizado=gris, cancelado=rojo).

## 18. Contrato — detalle — `admin/contratos/[id]/page.tsx` + `cerrar-contrato-dialog.tsx` + `renovar-contrato-dialog.tsx` + `adjuntos-contrato.tsx`
- **Ruta:** `/admin/contratos/{id}`.
- **Banner de vencimiento** (condicional): T7 (`red-300/red-50`, "vence en 7 días o menos") o T30 (`amber-300/amber-50`, "en 30 días o menos").
- **Header:** breadcrumb + H1 "{localCodigo} · {inquilino}" + badge; si vigente: botones **"Renovar contrato"** (primary) + **"Cerrar contrato"** (outline rojo).
- **Datos** (`grid grid-cols-2 md:grid-cols-4 gap-4`): Inicio · Fin/Indefinido · Monto/mes · Creado · Condiciones (full width, `whitespace-pre-wrap`). Si cerrado: Fin efectivo + Motivo.
- **Adjuntos:** `AdjuntosContrato` — solo **PDF**, subir/descargar/eliminar.
- **Diálogo Renovar:** nueva fecha inicio* + fin + monto (prefilled) + **preview del nuevo contrato**. **Diálogo Cerrar:** tipo (Finalizado/Cancelado) + motivo* + fecha fin efectiva (default hoy).

## 19. Nuevo contrato — `admin/contratos/nuevo/page.tsx` + `nuevo-contrato-form.tsx`
- **Ruta:** `/admin/contratos/nuevo`. Form `max-w-lg`: Local* (select **solo disponibles**; empty "No hay locales disponibles" en ámbar), Inquilino*, Fecha inicio + Fecha fin (2 cols), Monto mensual* + Moneda (`maxLength=3`, default USD), Condiciones (textarea 3 filas). Éxito → "Contrato creado; el local pasó a «alquilado»".

## 20. Categorías — listado — `admin/categorias/page.tsx` + `categorias-table.tsx`
- **Ruta:** `/admin/categorias`. Header + "Nueva categoría".
- **Filtros (form GET):** búsqueda por nombre (`type=search w-64`), select Activas/Inactivas/Todas, botón "Filtrar".
- **Tabla:** Nombre (link→detalle) · Descripción (truncada) · Estado (badge Activa verde / Inactiva gris) · Acciones (**"Subcategorías"** + **"Desactivar"** ghost). Empty + paginación (preserva filtros).

## 21. Nueva categoría — `admin/categorias/nueva/page.tsx` + `categoria-form.tsx` (modo crear)
- **Ruta:** `/admin/categorias/nueva`. Form `max-w-lg`: `nombre`* (max 80), `descripcion` (textarea 3 filas, max 500). Cancelar | Crear categoría.

## 22. Categoría — detalle — `admin/categorias/[id]/page.tsx` + `categoria-form.tsx` (modo editar)
- **Ruta:** `/admin/categorias/{id}`. Header: H1 "{nombre}" + "{estado} · {n} subcategoría(s)" + botón "Gestionar subcategorías".
- **Sección Editar:** `CategoriaForm` prefilled ("Guardar cambios").
- **Sección "Subcategorías activas":** lista (`divide-y border bg-white`) con nombre + "Responsable: {x} · Supervisores: {n}/5" + badge "Prioridad {letra}". Empty `border-dashed`.

## 23. Subcategorías — gestor — `admin/categorias/[id]/subcategorias/page.tsx` + `subcategorias-manager.tsx`
- **Ruta:** `/admin/categorias/{id}/subcategorias`. Breadcrumb + H1 "Subcategorías de {nombre}" + "Nueva subcategoría".
- **Tabla:** Nombre · Prioridad (badge gris) · Responsable ("—" si none) · Supervisores (badge `{n}/5`, **rojo si =5**) · Estado · Acciones (**Editar · Responsable · Supervisores · Desactivar**, ghost). Empty "No hay subcategorías. Crea la primera."
- **3 diálogos:**
  - *Nueva/Editar:* nombre* (max 80), descripción (2 filas), prioridad (A–F, default B), responsable* (solo en crear).
  - *Responsable:* select de staff (nombre + email); "Cambiar responsable" (disabled si no cambia).
  - *Supervisores `{n}/5`:* lista de actuales con "Quitar" + sección añadir (select de disponibles o "Límite de 5 alcanzado") + "Agregar"; botón "Cerrar".
- **Rediseño:** pantalla densa con muchas micro-acciones por fila; candidata a mejor agrupación visual y a row-expand en lugar de 3 modales.

## 24. Configuración — `admin/configuracion/page.tsx` + `configuracion-form.tsx` (5 tabs)
- **Ruta:** `/admin/configuracion`. H1 + subtítulo. Banner de feedback (verde/rojo) tras guardar. `useTransition` deshabilita botones (`pending`).
- **Tab General** (`max-w-md`): nombre comercial, email, teléfono, **zona horaria** (disabled, `America/El_Salvador`, "fija en v1"). Botón "Guardar".
- **Tab Branding:** color primario (color picker + input hex, bidireccional), logo (file PNG/SVG ≤2 MB, con preview). "Guardar color".
- **Tab SLA** (`md:grid-cols-2`): col1 "Días por tipo" (number por mantenimiento/evento/remodelación/otro); col2 "Multiplicador por prioridad" (number step 0.1, A–F). **Tabla preview Tipo×Prioridad** con semáforo (rojo <3d, ámbar 3–7d, verde >7d). "Guardar SLA".
- **Tab Adjuntos:** checkboxes de MIME permitidos (PDF/JPG/PNG/WebP/XLS/XLSX/DOCX/DWG) + tamaño máx (MB). Validación local (≥1 MIME, tamaño ≥1). "Guardar adjuntos".
- **Tab Calendario:** checkbox "Mostrar hitos contractuales". "Guardar calendario".
- **Rediseño:** es la pantalla de configuración más rica; el preview de SLA y el branding son oportunidades de UX visual (live preview de marca, sliders).

## 25. Bandeja de solicitudes (admin) — `admin/solicitudes/page.tsx` + `client/solicitudes-table.tsx`
- **Ruta:** `/admin/solicitudes`. **Cola de trabajo priorizada** del admin. `AutoRefresh` 60 s.
- **Header:** "Bandeja de solicitudes" + total en curso + toggle **"Asignadas a mí"** (fill/outline).
- **Filtros:** Estado (Las 3 colas / enviada / asignado / en_revisión), Tipo (mantenimiento/evento/remodelación/otro), Prioridad (A/B/C/D/F), botón "Filtrar".
- **Tabla:** Código (link) · Tipo · Título (truncado) · Local · Estado (badge) · Prioridad (badge) · **SLA** (punto verde/amarillo/rojo + label) · Asignada a (admin) · Enviada · Decisión. Empty "No hay solicitudes con esos criterios". Paginación.
- **Badges de solicitud:** borrador=gris · enviada=sky · asignado=índigo · en_revisión=ámbar · requerida_subsanacion=naranja · aprobada=verde · rechazada=rojo · cancelada=gris.

## 26. Solicitud — detalle (admin) — `admin/solicitudes/[id]/page.tsx` + `client/solicitud-detail-admin.tsx`
- **Ruta:** `/admin/solicitudes/{id}`. Pantalla de **revisión y decisión**.
- **Header:** código (H1) + badges Estado/Prioridad/**SLA**; subtítulo "{título} · Local · Inquilino · Asignada a {admin}". Aviso rojo **SC-4** si soy el creador ("no puedes aprobarla ni rechazarla").
- **Botones contextuales** (según estado/rol): **Tomar** (enviada) · **Tomar (revisar)** (asignado, soy asignado) · **Aprobar / Rechazar / Pedir subsanación** (en_revisión, soy asignado y no soy creador) · **Reasignar / Liberar** · dropdown de **prioridad** (A–F) · **Cancelar** (rojo). 
- **Tabs (4):**
  1. **Detalle** (read-only): descripción + `<dl>` 2 cols (solicitante, categoría/subcategoría, enviada, decisión, fechas/horas de evento si aplica, **campos extra dinámicos**).
  2. **Comentarios:** lista (usuario · badge tipo ámbar · fecha) + textarea (máx 4000) "Comentario para el inquilino…" + "Comentar".
  3. **Historial:** timeline vertical (`border-l`, puntos `bg-primary`) de eventos (creada/enviada/asignada/tomada/aprobada/rechazada/subsanada/reasignada/cancelada/comentario/adjunto/prioridad) con fecha + usuario + comentario.
  4. **Adjuntos:** `AdjuntoUploader` (PDF/JPEG/PNG/WebP/XLS/XLSX/DOCX/DWG; descargar/eliminar).
- **Diálogos:** *Decisión* (textarea; rechazo y subsanación **exigen** comentario, aprobación opcional) · *Reasignar* (select de admins + motivo).
- **Rediseño:** núcleo del producto. Hoy la densidad de botones contextuales en el header es alta — candidata a barra de acciones clara y a separar "panel de decisión" del contenido.

## 27. Calendario admin — `admin/calendario/page.tsx` + `client/calendario/calendario-view.tsx`
- **Ruta:** `/admin/calendario`. FullCalendar (dayGrid/timeGrid/list/interaction/luxon3), refetch 5 min.
- **Eventos por color:** Eventos=verde `#10b981` · Mantenimientos=naranja `#f59e0b` · Hitos contractuales=violeta `#8b5cf6`. **Solapes** con borde rojo.
- **Filtros (URL-driven, compartible):** Locales (multi), Inquilinos (multi), Tipos (toggles) + switch de **zona horaria** (navegador ↔ plaza, persistido en localStorage).
- **Interacción (solo admin):** **drag&drop** mueve el evento (`moverEventoAction`, toast); click en slot vacío → modal "Nueva solicitud" prefilled (`/inquilino/solicitudes/nueva?tipo=evento&fecha=…&hora=…&localId=…`); click en evento → modal con detalle + "Ver solicitud".

## 28. Reportes — `admin/reportes/page.tsx` + `client/reportes-generator.tsx`
- **Ruta:** `/admin/reportes`. H1 + "Exporta solicitudes, locales e inquilinos a CSV, XLSX o PDF. Rango máximo: 12 meses."
- **Panel generador** (`flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4`): **Entidad** (Solicitudes/Locales/Inquilinos) → **filtros contextuales** (Solicitudes: Estado/Tipo/Local/Inquilino/Desde/Hasta; Locales: Estado; Inquilinos: búsqueda) → **Formato** (CSV/XLSX/PDF) → **"Previsualizar"** (outline) + **"Generar"** (link de descarga a `/api/reportes/export?…`).
- **Preview inline:** tabla `text-xs` con "primeros X de Y registros"; empty "No hay registros con esos filtros."
- **Placeholder:** "Reportes programados e historial fuera de v1" (`border-dashed`).

## 29. Notificaciones — `admin/notificaciones/page.tsx` + `notificaciones-table.tsx` + `notificaciones-filtros.tsx` + `unsubscribes-list.tsx`
- **Ruta:** `/admin/notificaciones`. **Log de emails** + desuscripciones.
- **Filtros:** Estado (pendiente/enviado/fallido), Plantilla, Destinatario (input, apply en blur), Desde/Hasta, "Limpiar".
- **Tabla:** Destinatario · Plantilla (icono Mail) · Estado (badge pill: pendiente=ámbar, enviado=verde, fallido=rojo) · Reintentos · Creado · Enviado · Acciones (icono **ojo**=preview; **retry** si fallido). Paginación.
- **Modal preview:** destinatario, asunto, cuerpo (preformatted).
- **Sección Desuscripciones** (`UnsubscribesList`): lista email · plantilla · fecha + botón **"Resetear"**; empty "No hay desuscripciones registradas."

---

# D. Inquilino

## 30. Shell inquilino — `app/(inquilino)/layout.tsx`
- **Rol:** `inquilino` (guard: sin sesión→`/login`, otro rol→`/`). **Ruta:** `/inquilino/*`.
- **Header** `bg-white border-b`: "Plazapp" + nav (**Mis contratos · Mis solicitudes · Calendario**) + "Cerrar sesión". Main `max-w-5xl py-8`.

## 31. Mis solicitudes — `inquilino/solicitudes/page.tsx`
- **Ruta:** `/inquilino/solicitudes`. Header "Mis solicitudes" + total + **"Nueva solicitud"** (primary).
- **Filtros:** Estado (los 8 estados), Tipo, Prioridad, Desde/Hasta, "Filtrar".
- **Tabla** (reutiliza `SolicitudesTable` **sin** columnas SLA ni Asignada): Código · Tipo · Título · Local · Estado · Prioridad · Enviada · Decisión. Paginación.

## 32. Nueva solicitud — wizard 3 pasos — `inquilino/solicitudes/nueva/page.tsx` + `client/solicitud-wizard.tsx`
- **Ruta:** `/inquilino/solicitudes/nueva`. Acepta prefill `?tipo=&fecha=&hora=&localId=` (desde calendario).
- **Indicador de pasos** (chips numerados 1/2/3, activo `bg-primary text-white`).
- **Paso 1 — Tipo y categoría:** Tipo* (Mantenimiento/Evento/Remodelación/Otro). Si ≠ otro: Categoría* + Subcategoría* (dependiente). Si = otro: se omiten.
- **Paso 2 — Detalles + campos extra dinámicos:** Local*, Título*, Descripción* + campos según tipo:
  - *Mantenimiento:* Área afectada*, checkbox "Requiere ingreso al local".
  - *Evento:* Asistentes estimados*, Fecha inicio*/fin, Hora inicio/fin.
  - *Remodelación:* Fecha inicio estimada*, Duración (días)*, Empresa constructora*, Monto presupuesto*.
  - *Otro:* Categoría libre*, Descripción larga*.
  - **Aviso de duplicados** no bloqueante (caja ámbar) si hay solicitudes similares recientes.
- **Paso 3 — Adjuntos + revisión:** `AdjuntoUploader` (PDF/JPEG/PNG/WebP/XLS/XLSX/DOCX/DWG, ≤10 archivos) + resumen read-only (`<dl>`). Botonera **"Atrás | Guardar como borrador | Enviar ahora"** (verde).
- **Acciones:** guardar→`createSolicitudAction` (borrador)→detalle; enviar→create + subir adjuntos + `enviarSolicitudAction`.
- **Rediseño:** el wizard es la tarea estrella del inquilino; merece el mayor pulido (progreso claro, validación amable, resumen atractivo).

## 33. Solicitud — detalle (inquilino) — `inquilino/solicitudes/[id]/page.tsx` + `solicitud-detail-inquilino.tsx`
- **Ruta:** `/inquilino/solicitudes/{id}`. Header código + badges; subtítulo "{título} · Local · Asignada a {admin}".
- **Botones contextuales:** borrador → Editar · Cancelar · Duplicar · **Enviar**; requerida_subsanacion → Editar · Cancelar · Duplicar · **Reenviar subsanada**; no terminal → Cancelar · Duplicar.
- **Tabs (4)** iguales al admin: Detalle · Comentarios (el inquilino siempre puede comentar) · Historial · Adjuntos (eliminar solo en borrador/subsanación).

## 34. Editar solicitud — `inquilino/solicitudes/[id]/editar/page.tsx`
- **Ruta:** `/inquilino/solicitudes/{id}/editar`. Solo en **borrador** o **requerida_subsanacion** (si no, redirige a detalle). Reutiliza el wizard en modo PATCH (`updateSolicitudAction`). Nota: "El cambio de local solo está permitido en borrador y requerida_subsanacion".

## 35. Mis contratos — `inquilino/contratos/page.tsx`
- **Ruta:** `/inquilino/contratos`. Header "Mis contratos" + total. **Tabla:** Local (link) · Inicio · Fin ("Indefinido") · Monto (o "—") · Estado (badge vigente/finalizado/cancelado). Empty "No tienes contratos registrados."

## 36. Contrato — detalle (inquilino) — `inquilino/contratos/[id]/page.tsx`
- **Ruta:** `/inquilino/contratos/{id}`. Breadcrumb + H1 "Local {código}" + badge. **Grid info** (2–4 cols): Inicio · Fin · Monto mensual · Moneda · Condiciones (full). **Adjuntos:** "Contrato firmado (PDF)" — `AdjuntoUploader` solo PDF (el inquilino sube/descarga; elimina solo lo que subió).

## 37. Calendario inquilino — `inquilino/calendario/page.tsx`
- **Ruta:** `/inquilino/calendario`. FullCalendar **read-only** (sin drag&drop), scope al inquilino. Filtros: Locales (multi) + Tipos (Eventos/Mantenimientos/Hitos). Click en slot vacío → prefill del wizard de evento. Click en evento → modal informativo.

---

# E. §38 Componentes transversales (sistema reutilizable)

- **`estado-badge.tsx`** — badges presentacionales: estado de solicitud (8), prioridad (A–F), estado de local, estado de contrato y **semáforo SLA** (punto verde/amarillo/rojo o "—"). Base `inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset`. **Pieza central del lenguaje visual** — unificar su tratamiento impacta todo el producto.
- **`tabs.tsx`** — tabs client ligeros (`border-b`, tab activo `border-primary text-primary`); usados en todos los detalles.
- **`adjunto-uploader.tsx`** — dropzone drag&drop genérico: valida MIME + tamaño en cliente, lista de archivos (nombre · tamaño · fecha · descargar/eliminar), iconos lucide, vía Server Actions. Parametrizable (`mimeAllowlist`, `maxBytes`, `canDelete`). Reutilizado en local, contrato y solicitud.
- **`auto-refresh.tsx`** — client de render nulo; `router.refresh()` cada N ms (dashboards 5 min, bandeja 60 s).
- **`dashboard-kpis.tsx` / `dashboard-charts.tsx`** — KPI cards + gráficos Recharts compartidos entre dashboard global y de plaza.
- **`ui/*` (shadcn):** `button` (variants default/outline/ghost/destructive; sizes default/sm/icon), `input`, `label`, `dialog`, `table`.

---

# F. Recomendaciones para el rediseño (resumen accionable)

1. **Identidad de marca por-tenant primero.** El acento ya es dinámico (`--color-primary` por plaza). Diseñar un sistema que luzca premium con cualquier primario y que use logo + color del tenant en shell, login y dashboards.
2. **Navegación.** El header admin con 10 links horizontales es el mayor problema estructural → **sidebar agrupada con iconos** (Operación: Solicitudes/Calendario; Catálogo: Locales/Inquilinos/Contratos/Categorías; Plataforma: Reportes/Notificaciones/Configuración).
3. **Jerarquía y densidad.** Dashboards y tablas son planos y densos: introducir escalas tipográficas claras, KPIs primarios destacados, sparklines y mejor respiración.
4. **Badges/semáforo unificados** (§38): un único set consistente de estados eleva toda la app.
5. **Tareas estrella con mimo:** wizard de nueva solicitud (§32) y detalle/decisión de solicitud (§26 y §33) concentran el valor — merecen el mayor esfuerzo de UX (progreso, validación amable, panel de decisión claro, timeline atractivo).
6. **Estados vacíos y feedback:** hoy son texto gris en caja `border-dashed`; oportunidad de ilustración/CTA. Mantener toasts `sonner`.
7. **Respetar la arquitectura BFF:** la interactividad vive en `components/client/*`; lo demás puede seguir como Server Components. El rediseño es mayormente de tokens, layout y componentes, sin tocar Server Actions.
8. **Considerar modo oscuro** desde el token system (`globals.css`), hoy inexistente.

> **Cobertura:** 37 pantallas/rutas + componentes transversales. Fuente: análisis directo de `frontend/src` (páginas
> `page.tsx`, layouts y `components/client/*`), `tailwind.config.ts` y `globals.css`.
