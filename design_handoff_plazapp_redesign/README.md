# Handoff: Rediseño de Plazapp (sys-solicitudes)

## Overview

Rediseño visual completo de **Plazapp**, una plataforma SaaS multi-tenant para gestión
operativa de plazas comerciales (locales, inquilinos, contratos, solicitudes de mantenimiento/
eventos, calendario, reportes y notificaciones). Cubre las **37 pantallas** del producto en
4 roles: público/auth, superadmin (plataforma), admin de plaza e inquilino.

El objetivo del rediseño —según el brief original `REDISENO-PANTALLAS.md`— era **elevar la
calidad visual manteniendo intacta la información, las acciones y los estados** de cada pantalla.
Se conserva la arquitectura BFF y el acento dinámico por plaza; el cambio es de **tokens, layout
y componentes**, no de lógica de negocio.

Dirección visual elegida: **"institucional / confiable"** (sensación bancaria), con **modo claro
y oscuro**, sidebar navy permanente, acento azul por defecto pero **adaptable a cualquier color
de tenant**, tipografía General Sans + JetBrains Mono.

---

## About the Design Files

Los archivos de este bundle (`index.html`, `css/*`, `js/*`) son **referencias de diseño creadas
en HTML/CSS/JS vanilla** — un prototipo navegable que muestra el aspecto y comportamiento deseados.
**No son código de producción para copiar tal cual.**

La tarea es **recrear estos diseños en el entorno real del proyecto**. El stack actual de Plazapp
(según el brief) es **Next.js 14 (App Router) + Tailwind v4 + shadcn/ui**, con `lucide-react`,
`sonner`, FullCalendar y Recharts. Implementa el rediseño usando **esos patrones y librerías
existentes** (Server Components para lo estático, `components/client/*` para lo interactivo), no
reemplazando la arquitectura. El prototipo usa router por hash y funciones que devuelven HTML solo
porque es una maqueta autocontenida; en producción cada "pantalla" es una ruta/página Next y cada
"componente" debe ser un componente React.

Mapa de equivalencias prototipo → producción:

| En el prototipo | En producción (Next + Tailwind + shadcn) |
|---|---|
| `js/app.js` (router por hash, `render()`) | App Router (`app/**/page.tsx`, layouts) |
| `css/tokens.css` (`:root` / `[data-theme]`) | `globals.css` + `tailwind.config.ts` (CSS vars + dark mode `class`) |
| Funciones `page(...)` que devuelven strings | Server/Client Components |
| `openModal(...)` | shadcn `Dialog` |
| `<i data-lucide="...">` | `lucide-react` (`<Inbox />`, etc.) |
| `lineChart/barChart/donut/sparkline` (SVG inline) | Recharts |
| `calendarGrid` (grid estático) | FullCalendar |
| Toasts (no implementados en maqueta) | `sonner` (mantener) |

---

## Fidelity

**Alta fidelidad (hifi).** Colores, tipografía, espaciado, radios, sombras, estados y micro-
interacciones son finales. Recrear la UI de forma pixel-cercana usando los componentes y utilidades
del codebase. Todos los valores exactos están en `css/tokens.css`, `css/components.css` y resumidos
en la sección **Design Tokens** de este documento.

---

## Principios del rediseño (decisiones clave)

1. **Identidad por-tenant primero.** El acento es la variable CSS `--primary` (default `#2f62e6`);
   toda la escala (`--primary-50…700`, `-soft`, `-ring`) se deriva con `color-mix()`. La marca de
   cada plaza (color + logo) aparece en sidebar, login, dashboards y vista previa de branding. El
   sistema debe lucir premium con **cualquier** primario.
2. **Navegación = sidebar agrupada con iconos** (reemplaza los 10 links horizontales del header
   actual). Grupos: *Operación* (Solicitudes, Calendario), *Catálogo* (Locales, Inquilinos,
   Contratos, Categorías), *Plataforma* (Reportes, Notificaciones, Configuración), con Dashboard
   suelto arriba. La sidebar es **navy permanente** en ambos temas (look institucional, deja
   brillar el acento). Colapsable a solo-iconos.
3. **Jerarquía y densidad.** KPIs primarios grandes con sparklines + KPIs secundarios; gráficos con
   leyenda; tablas con cabecera en mayúsculas/tracking, filas hover, paginación numérica.
4. **Badges / semáforo unificados.** Un único set semántico (estado de solicitud, local, contrato,
   notificación; prioridad A–F; SLA verde/ámbar/rojo). Misma forma (pill con punto) en toda la app.
5. **Tareas estrella con mimo:** wizard de nueva solicitud (stepper de 3 pasos, selector de tipo
   con tarjetas, campos extra dinámicos) y detalle de solicitud (contenido en tabs + **panel de
   decisión separado y sticky** a la derecha).
6. **Estados vacíos con CTA** (icono en caja + título + descripción + botón) en lugar de texto gris.
7. **Modo claro y oscuro** desde el token system (`[data-theme]`), con toggle en el topbar.

---

## Design Tokens

> Fuente canónica: **`css/tokens.css`**. En producción, llevar estos a `globals.css` como CSS
> variables y exponerlos en `tailwind.config.ts`. El modo oscuro se activa con `[data-theme="dark"]`
> (en Tailwind, configurar `darkMode: ['selector', '[data-theme="dark"]']` o migrar a `.dark`).

### Tipografía
- **Sans (UI/títulos):** `"General Sans"` (Fontshare), pesos 400/500/600/700. Fallback
  `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
  `@import url("https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap");`
- **Mono (códigos, montos, IDs, contraseñas temporales):** `"JetBrains Mono"` (Google Fonts), 400–700.
- **Base:** `14px` / `line-height 1.5`. `-webkit-font-smoothing: antialiased`.
- **Escala usada:** page-title 23px/600/-.02em · h3 card 14.5px/600 · body 13.5–14px · label 12.5px/550 ·
  hint/cellsub 11.5–12px · KPI value 30px/650/-.02em · table header 11px/600 uppercase tracking .05em.

### Color — modo claro
| Token | Hex |
|---|---|
| `--bg` (página) | `#f4f6f9` |
| `--surface` (tarjetas) | `#ffffff` |
| `--surface-2` | `#fafbfc` |
| `--surface-3` | `#f1f3f6` |
| `--border` | `#e6e8ee` |
| `--border-strong` | `#d6dae2` |
| `--text` | `#131a26` |
| `--text-2` | `#475063` |
| `--text-3` | `#6b7486` |
| `--text-muted` | `#98a0b0` |
| `--primary` (acento, dinámico) | `#2f62e6` |
| `--primary-contrast` | `#ffffff` |
| **Sidebar** `--side-bg` | `#0d1521` (grad `#101a28 → #0b131e`) |
| `--side-text` | `#9aa7ba` · `--side-text-strong` `#ffffff` |

### Color — modo oscuro
| Token | Hex |
|---|---|
| `--bg` | `#080b11` |
| `--surface` | `#10151e` |
| `--surface-2` | `#0c111a` |
| `--surface-3` | `#18202c` |
| `--border` | `#222b39` |
| `--border-strong` | `#2d3848` |
| `--text` | `#e9edf4` |
| `--text-2` | `#a4afc0` |
| `--text-3` | `#818c9f` |
| sidebar | `#0a1019` (grad `#0c131e → #080d15`) |
| `--primary-soft` (override) | `color-mix(--primary 22%, #0d1420)` |
| `--primary-700` (override, texto acento) | `color-mix(--primary 52%, white)` |

### Color — semántico (fg / bg-tint / border) — claro
| Semántica | fg | bg | border |
|---|---|---|---|
| ok / éxito / vigente / disponible / aprobada | `#0a6b46` | `#e7f6ee` | `#bce6cf` |
| info / enviada / alquilado | `#0b5cab` | `#e6f1fd` | `#bcdcf6` |
| warn / en revisión / mantenimiento | `#9a6206` | `#fdf3e2` | `#f3dcab` |
| orange / subsanación | `#b14a08` | `#fdeee2` | `#f6cba6` |
| indigo / asignado | `#3f3fb0` | `#ebebfb` | `#cfcff3` |
| cyan | `#0a6a78` | `#e2f5f8` | `#a9e2ea` |
| danger / rechazada / cancelada / error | `#b42318` | `#fdeceb` | `#f5c4c0` |
| violet | `#6b35c2` | `#f1e9fc` | `#dcc8f4` |
| neutral / borrador / inactivo | `#5a6678` | `#eef0f3` | `#dde1e8` |

(Variantes oscuras equivalentes en `tokens.css`, bloque `[data-theme="dark"]`.)

### Prioridad (chip cuadrado 22×22, mono 700, texto blanco)
`A #e0463a` · `B #e8852c` · `C #d6a811` · `D #3f9e5a` · `E #2f8fb0` · `F #7a8499`

### SLA (semáforo — punto 8px con halo)
`verde #16a34a` · `ámbar #e0a106` · `rojo #e0463a` · `— (sin SLA) gris`

### Radios
`--r-xs 5px` · `--r-sm 7px` · `--r-md 10px` · `--r-lg 14px` · `--r-xl 18px` · `--r-pill 999px`
- Inputs/botones: `--r-sm`. Cards: `--r-lg`. Modales: `--r-xl`. Badges/pills: `--r-pill`.

### Sombras (claro)
- `--shadow-xs` `0 1px 2px rgba(16,24,40,.05)`
- `--shadow-sm` `0 1px 3px rgba(16,24,40,.07), 0 1px 2px rgba(16,24,40,.04)` (cards)
- `--shadow-md` hover de cards
- `--shadow-lg` modales/popovers

### Espaciado
- Padding de página/main: `28px` (`--gutter`). Card padding: `20–22px`. Gap de grids: `16–18px`.
- Anchos de contenido: `.page` max `1180px`, `.page.narrow` `760px` (formularios/wizard),
  `.page.wide` `1320px` (dashboards, bandeja, detalle de solicitud).

---

## Layout / Shell (común a admin, superadmin, inquilino)

- **Grid:** `grid-template-columns: 256px 1fr` (sidebar fija + columna principal). Colapsada: `76px`.
- **Sidebar** (`--side-bg`, sticky, alto `100vh`):
  - Header: logo cuadrado 34px con gradiente del acento + "Plazapp" + subtítulo (nombre de plaza /
    "Consola de plataforma").
  - Grupos con label en mayúsculas (10.5px, tracking .09em, `--side-text-dim`) e items `.nav-link`
    (icono lucide 18px + label 13.5px/500). Activo: fondo `--side-active-bg` (acento al 22%), texto
    blanco, barra vertical de 3px a la izquierda en `--primary-300`. Badge de conteo opcional
    (mono, pill, acento sólido o translúcido).
  - Footer: avatar + nombre + rol.
- **Topbar** (64px, sticky, `backdrop-filter: blur(14px)`, borde inferior): botón colapsar ·
  buscador pill (input + `⌘K`) · selector de plaza (punto de color + nombre) · toggle de tema
  (sol/luna) · campana con punto de notificación · avatar.
- **Main:** padding 28px, contenido centrado según ancho de `.page`.
- **Responsive:** <920px la sidebar pasa a off-canvas (drawer), el buscador se oculta.

---

## Screens / Views (37)

> Cada pantalla está implementada como una función `page("<ruta>", {shell, nav}, render)` en los
> archivos `js/screens-*.js`. Abajo: propósito, layout y componentes clave. Los textos (copy) exactos
> están en el código. Estados (badges/semáforo) y acciones se conservan 1:1 respecto al brief.

### A. Público / auth — `js/screens-auth.js`

**1. Layout raíz** — provee tema global (`data-theme`), fuentes, contenedor `#app`. En producción =
`app/layout.tsx` + `<Toaster>` de sonner (top-right, richColors).

**2. Home / entrada** (`/`) — card centrada con marca de la plaza (logo + nombre), saludo, y
**3 tarjetas de destino** (Admin / Inquilino / Superadmin) con icono en caja tintada, título y
descripción; hover desplaza y tinta con acento. Botón "Cerrar sesión".

**3. Login** (`/login`) — **layout split**: panel izquierdo navy (mismo gradiente que sidebar) con
patrón de rejilla enmascarado, titular grande, 3 features con iconos, footer de plaza; panel derecho
= card (`max-w-400px`, `--r-xl`, `--shadow-lg`) con título, campos email/password con icono inline,
"Recordarme" + link de reset, botón primario full-width, y atajos demo de rol. Toggle de tema en el
panel de marca.

**4. Reset — solicitud** (`/reset-password`) — mismo layout; un campo email + botón "Enviar enlace".
Estado enviado: banner verde neutro ("Si el email existe… expira en 30 minutos") + volver a login.

**5. Reset — confirmar** (`/reset-password/:token`) — nueva contraseña + confirmar; botón restablecer.

### B. Superadmin — `js/screens-superadmin.js` + dashboard en `js/screens-admin-dashboard.js`

**6. Shell superadmin** — sidebar con *Dashboard global* + *Plazas*; topbar muestra "Plataforma"
(icono globo) en vez de plaza.

**7. Dashboard global** (`/superadmin/dashboard`) — reusa `dashboardContent("global")` (idéntico al
admin, sin links a detalle).

**8. Plazas** (`/superadmin/plazas`) — header + botón "Nueva plaza" (abre modal). Tabla: Plaza
(punto de color con halo + nombre) · Slug (mono) · Contacto · Creada · Acciones (Desactivar ghost
rojo → modal de confirmación). **Modal "Nueva plaza"** (`lg`, 2 secciones): *Datos de la plaza*
(nombre → auto-slug, color picker + hex, email) con **vista previa de marca en vivo** (barra con el
color + nombre); *Administrador inicial* (nombre, rol, email, contraseña temporal mono).

### C. Admin de plaza — `js/screens-admin-*.js`

**9. Shell admin** — sidebar agrupada completa (ver Layout).

**10. Dashboard** (`/admin/dashboard`) — `js/screens-admin-dashboard.js`:
- **5 KPI cards** (`grid` 5 col → 2 → 1): label + icono en caja tintada, valor 30px, delta opcional
  (flecha + texto verde/rojo), **sparkline** SVG al pie en algunas. Tints: Pendientes=warn,
  Aprobadas=ok, Rechazadas=danger, Eventos=info, Contratos x vencer=violet.
- **3 KPI secundarios** (tasa de aprobación con barra de progreso; tiempo medio de respuesta; con
  subsanación).
- **Gráficos:** LineChart tendencia por estado (6 meses, leyenda) · Donut por prioridad · BarChart
  por tipo. En producción → **Recharts**.
- **2 listas:** Top 5 por antigüedad (prioridad + código + estado + SLA) · Actividad reciente
  (icono + evento + usuario + tiempo).
- Header con badge "Auto-refresh 5 min" (en prod, componente `AutoRefresh` con `router.refresh()`).

**11. Locales** (`/admin/locales`) — header + "Nuevo local". Barra de filtros (Estado select, Piso,
Sector, Limpiar). Tabla: Código (link mono) · Nombre · Piso · Sector · m² (num mono) · Estado (badge
local) · Desactivar. Paginación.

**12. Local — detalle** (`/admin/locales/:id`) — breadcrumb + H1 "{código} · {nombre}" + badge.
**Tabs:** Datos (form `max-w-560`, código disabled, estado disabled si alquilado), Contratos
(mini-cards, vigente resaltada verde), Adjuntos (dropzone + lista de archivos), Solicitudes (empty).
Footer de timestamps.

**13. Nuevo local** (`/admin/locales/nuevo`) — `formPage` `narrow`: código*, m², nombre, piso+sector,
descripción. Botonera Cancelar | Crear.

**14. Inquilinos** (`/admin/inquilinos`) — filtros (razón social, identificación) + tabla (Razón
social link · Identificación mono · Contacto · Email · Desactivar).

**15. Inquilino — detalle** (`/admin/inquilinos/:id`) — H1 razón social + "ID:…" + botón "Alta
rápida de usuario" (modal). Tabs: Datos (razón social e identificación **inmutables/disabled**;
editar dirección/contacto; botón Desactivar a la izq, Guardar a la der), Contratos, Solicitudes.
**Modal alta usuario:** email+nombre → al crear muestra **contraseña temporal grande en mono**
(componente `.temp-pass`) con banner de aviso "se muestra una sola vez".

**16. Nuevo inquilino** (`/admin/inquilinos/nuevo`) — form razón social*, identificación, dirección,
contacto+teléfono, email.

**17. Contratos** (`/admin/contratos`) — filtros (Local, Inquilino, Estado) + tabla (Local link ·
Inquilino · Inicio · Fin "Indefinido" si null · Monto/mes mono · Estado badge vigente/finalizado/
cancelado).

**18. Contrato — detalle** (`/admin/contratos/:id`) — breadcrumb + **banner de vencimiento**
condicional (ámbar T30 / rojo T7) + H1 "{local} · {inquilino}" + badge + (si vigente) botones
"Renovar" y "Cerrar contrato". Grid de datos (`dl`: inicio, fin, monto, moneda, condiciones full).
Panel Adjuntos (solo PDF). **Modales** Renovar (fechas + monto + preview) y Cerrar (tipo segmented
Finalizado/Cancelado + motivo* + fecha).

**19. Nuevo contrato** (`/admin/contratos/nuevo`) — Local* (solo disponibles), Inquilino*, fechas,
monto* + moneda (maxlength 3), condiciones.

**20. Categorías** (`/admin/categorias`) — `js/screens-admin-catalog2.js`. Filtros (búsqueda con
icono + estado + Filtrar) + tabla (Nombre link · Descripción truncada · Subcat. · Estado · Acciones:
Subcategorías + Desactivar).

**21. Nueva categoría** (`/admin/categorias/nueva`) — nombre* (max 80), descripción (max 500).

**22. Categoría — detalle** (`/admin/categorias/:id`) — H1 + estado + "n subcategorías" + "Gestionar
subcategorías". Grid split: tarjeta *Editar* (nombre, descripción) + tarjeta *Subcategorías activas*
(lista con nombre, responsable, supervisores n/5, chip de prioridad).

**23. Subcategorías — gestor** (`/admin/categorias/:id/subcategorias`) — tabla: Nombre · Prioridad
(chip) · Responsable · Supervisores (badge n/5, **rojo si =5**) · Estado · Acciones (Editar /
Responsable / Supervisores / Desactivar, todos ghost-icon). **3 modales:** Nueva/Editar (nombre,
descripción, prioridad A–F, responsable solo en crear), Responsable (actual + select), Supervisores
(lista con Quitar + añadir o "Límite de 5 alcanzado").

**24. Configuración** (`/admin/configuracion`) — `js/screens-admin-ops2.js`. **5 tabs:**
- *General:* nombre, email, teléfono, zona horaria (disabled "fija en v1").
- *Branding:* color picker + hex bidireccional que **actualiza `--primary` en vivo**; uploader de
  logo; tarjeta de **vista previa** (barra + botón primario + badge).
- *SLA:* inputs de días por tipo + **matriz preview Tipo×Prioridad** con celdas semáforo
  (`<3d` rojo, `3–7d` ámbar, `>7d` verde).
- *Adjuntos:* checkboxes de MIME permitidos + tamaño máx.
- *Calendario:* toggle "Mostrar hitos contractuales".

**25. Bandeja de solicitudes** (`/admin/solicitudes`) — `js/screens-admin-ops.js`. Cola priorizada.
Header con segmented "Todas / Asignadas a mí" + badge "60 s" (auto-refresh). Filtros (Estado, Tipo,
Prioridad, Filtrar). **Tabla:** Código link · Tipo (badge neutral) · Título truncado · Local mono ·
Estado (badge solicitud) · Prio (chip) · **SLA** (semáforo) · Asignada (avatar + nombre) · Enviada ·
Decisión. Paginación.

**26. Solicitud — detalle (admin)** ⭐ (`/admin/solicitudes/:id`) — **pantalla núcleo.**
- Breadcrumb + H1 código + badges (Estado, Prioridad, SLA) + subtítulo (título · local · inquilino ·
  asignada). Aviso **SC-4** (banner rojo) si el usuario es el creador.
- **Layout `detail-grid`** = contenido (1fr) + **panel lateral sticky** (320px):
  - Contenido en **tabs**: Detalle (descripción + `dl` 2col con campos dinámicos), Comentarios (lista
    con avatar + badge tipo + textarea), Historial (**timeline** vertical con punto e icono por
    evento), Adjuntos (dropzone + archivos).
  - **Panel de decisión** (sticky): título "Panel de decisión", botones Aprobar (verde) / Rechazar
    (rojo outline) / Pedir subsanación; meta (prioridad con chip + dropdown, asignada, SLA); acciones
    Reasignar / Liberar / Cancelar.
- **Modales:** Decisión (textarea; rechazo y subsanación **exigen** comentario, aprobación opcional)
  y Reasignar (select de staff + motivo).

**27. Calendario admin** (`/admin/calendario`) — `js/screens-admin-ops2.js`. Layout `cal-wrap` =
panel izq (navegación de mes, **leyenda** Eventos verde / Mantenimientos naranja / Hitos violeta /
Solape borde rojo, filtros) + **grid mensual** (7 col, celda con número + eventos como chips con
borde-izquierdo de color, día actual con número en círculo de acento). Eventos clicables → modal con
detalle + "Ver solicitud". En prod → **FullCalendar** con drag&drop (mover evento) y click en slot
vacío → wizard prefilled.

**28. Reportes** (`/admin/reportes`) — panel generador (Entidad → filtros contextuales → Formato
CSV/XLSX/PDF → Previsualizar + Generar) + tabla preview ("primeros X de Y") + placeholder "Reportes
programados fuera de v1".

**29. Notificaciones** (`/admin/notificaciones`) — filtros + **tabla** (Destinatario · Plantilla con
icono mail + mono · Estado badge pill · Reintentos · Creado · Enviado · Acciones: ojo=preview, retry
si fallido). **Modal preview** (destinatario, asunto, cuerpo preformateado). Sección
**Desuscripciones** (lista email + plantilla + fecha + botón Resetear).

### D. Inquilino — `js/screens-inquilino.js`

**30. Shell inquilino** — sidebar simple grupo *Portal*: Mis solicitudes, Mis contratos, Calendario.

**31. Mis solicitudes** (`/inquilino/solicitudes`) — como la bandeja pero **sin columnas SLA ni
Asignada**. Header + "Nueva solicitud".

**32. Nueva solicitud — wizard** ⭐ (`/inquilino/solicitudes/nueva`) — **tarea estrella.**
- **Stepper** de 3 pasos (círculo numerado: futuro=outline, activo=acento con halo, completado=verde
  con check; líneas conectoras que se vuelven verdes).
- *Paso 1 — Tipo y categoría:* **selector de tipo con 4 tarjetas** (Mantenimiento/Evento/
  Remodelación/Otro, icono en caja + label, seleccionada con borde+fondo acento). Categoría +
  Subcategoría (se ocultan si tipo = Otro).
- *Paso 2 — Detalles + campos extra dinámicos:* Local, Título, Descripción + bloque condicional
  según tipo (Mantenimiento: área + checkbox ingreso; Evento: asistentes/fechas/horas + checkboxes;
  Remodelación: fecha/duración/constructora/presupuesto; Otro: categoría libre). **Aviso de
  duplicados** (banner ámbar, no bloqueante).
- *Paso 3 — Adjuntos + revisión:* dropzone + **resumen read-only**. Botonera "Atrás | Guardar
  borrador | Enviar ahora (verde)".
- Navegación con `wzGo(n)` (cambia panel + stepper) y `wzType(t)` (muestra campos del tipo).

**33. Solicitud — detalle (inquilino)** (`/inquilino/solicitudes/:id`) — mismo layout `detail-grid`
que el admin pero el panel lateral es **solo lectura de estado** (estado, asignada, prioridad,
enviada). Botones contextuales según estado (borrador → Editar/Enviar; subsanación → Editar/Reenviar;
no terminal → Duplicar/Cancelar). Tabs iguales (el inquilino siempre puede comentar).

**34. Editar solicitud** (`/inquilino/solicitudes/:id/editar`) — reusa el **wizard** en modo edición
(solo borrador o subsanación).

**35. Mis contratos** (`/inquilino/contratos`) — tabla (Local link · Inicio · Fin · Monto · Estado).

**36. Contrato — detalle (inquilino)** (`/inquilino/contratos/:id`) — grid de datos + panel "Contrato
firmado (PDF)" (subir/descargar).

**37. Calendario inquilino** (`/inquilino/calendario`) — mismo calendario **read-only** (sin
drag&drop), filtros Locales + Tipos.

---

## Componentes transversales (sistema reutilizable)

Definidos en `css/components.css` y construidos por helpers en `js/ui.js`. En producción, cada uno
es un componente React:

| Componente | Clase / helper | Notas de implementación |
|---|---|---|
| Botón | `.btn` + `.btn-primary/secondary/ghost/danger/danger-solid/success` + `.btn-sm/lg/icon/block` | Alturas 38/32/44. shadcn `Button` variants. |
| Badge de estado | `.badge` + `.b-ok/info/warn/orange/indigo/cyan/danger/violet/neutral` | Pill con punto. Helpers `badgeSolicitud/Local/Contrato/Notif`. **Pieza central** del lenguaje visual. |
| Chip de prioridad | `.prio.prio-A…F` | Cuadrado 22px mono. Helper `prioChip(p)`. |
| Semáforo SLA | `.sla.sla-green/amber/red` | Punto con halo + label. Helper `slaCell(sla,label)`. |
| Card | `.card` (+ `.card-head/body/foot`, `.card-pad`, `.hoverable`) | radius lg, shadow-sm. |
| KPI card | `.kpi` + `kpiCard({...})` | label + icono tintado + valor + delta + sparkline. |
| Input / Select / Textarea | `.input/.select/.textarea` | alto 40, focus ring acento. shadcn `Input`. |
| Filtros | `.filters` + `filterBar(...)` | barra dentro de card. |
| Tabla | `.tbl` + `tableCard({...})` | header uppercase, hover, `.cellcode` (mono link), `.num`, `.actions`. shadcn `Table`. |
| Paginación | `.pager` + `pager(active,total)` | activa = acento. |
| Tabs | `.tabs/.tab` + `tabs([...])` | activo subrayado acento. `[data-tabpanel]` para contenido. shadcn `Tabs`. |
| Stepper (wizard) | `.stepper/.step` | estados active/done. |
| Timeline (historial) | `.timeline/.tl-item/.tl-dot` | línea + punto con icono. |
| Definition list | `.dl` (+ `.c2`, `.full`) | grid de pares dt/dd. |
| Banner | `.banner` + `-warn/-danger/-info/-ok` | avisos contextuales. |
| Avatar | `.avatar` + `avatar(name)` | iniciales con gradiente por hash de nombre. |
| Dropzone / archivo | `.dropzone`, `.file-row`, `.file-ic` | uploader genérico (validar MIME+tamaño en cliente). |
| Empty state | `.empty` + `emptyState({...})` | icono + título + body + CTA. |
| Modal | `.modal*` + `openModal/closeModal/modalShell` | overlay blur. shadcn `Dialog`. |
| Placeholder de imagen | `.placeholder` | franjas + texto mono (para mockups; reemplazar por imágenes reales). |
| Iconos | `<i data-lucide="...">` | → `lucide-react`. Lista de iconos usados abajo. |
| Gráficos | `lineChart/barChart/donut/sparkline` (SVG) | → **Recharts**. |
| Calendario | `calendarGrid()` | → **FullCalendar**. |

### Iconos usados (lucide)
`layout-dashboard, inbox, calendar-days, store, users-round, file-text, tags, bar-chart-3, bell,
settings, building-2, globe, search, panel-left, sun, moon, chevron-down/left/right, arrow-right/left,
plus, x, check, check-circle-2, x-circle, file-edit, hand, repeat, unlock, ban, flag, user-check,
timer, clock, file-warning, trending-up/down, refresh-cw, send, mail, mail-check, lock, shield-check,
shield-alert, zap, calendar-check, user-plus, user-cog, users, git-branch, list-tree, pencil, power,
trash-2, download, upload, upload-cloud, image, file-image, file-signature, paperclip, message-square,
history, activity, calendar, wrench, party-popper, hammer, more-horizontal, palette, eye, filter,
copy, save, rotate-ccw, bell-off, alert-triangle, info, calendar-clock, calendar-plus, log-out`.

---

## Interactions & Behavior

- **Routing:** prototipo por hash; en prod, rutas Next del brief. Mantener breadcrumbs y links de
  detalle (códigos → detalle).
- **Tema:** `data-theme="light|dark"` en `<html>`, persistido en localStorage; toggle en topbar.
  En prod, sincronizar con preferencia del usuario.
- **Sidebar colapsable:** clase `.collapsed` en el shell (persistida). <920px = drawer off-canvas.
- **Tabs:** cambian `[data-tabpanel]` visible. shadcn `Tabs`.
- **Modales:** overlay con blur, cierre por backdrop/Esc/botón. Reglas de validación conservadas:
  rechazo y subsanación **exigen comentario**; aprobación opcional; motivo obligatorio al cerrar
  contrato; supervisores tope 5.
- **Wizard:** validación amable por paso; "Guardar borrador" vs "Enviar ahora".
- **Branding en vivo:** el color picker de Configuración/Nueva plaza actualiza `--primary` y toda la
  UI reacciona (probar contraste con cualquier color).
- **Auto-refresh:** dashboards 5 min, bandeja 60 s (badge informativo; en prod `AutoRefresh` +
  `router.refresh()`).
- **Transiciones:** entrada de página `translateY(7px)→0` 0.26s; hover de cards `translateY(-1px)` +
  shadow; modales `scale/translateY` 0.2s. Respetar `prefers-reduced-motion`.
- **Toasts:** mantener `sonner` (top-right, richColors) para resultados de acciones.

## State Management
El prototipo es estático (datos en `js/data.js`). En producción, respetar el patrón BFF: Server
Components/Server Actions para datos y mutaciones; estado de cliente solo donde hay interacción
(wizard, tablas con acciones, uploads, calendario, color picker, tabs, modales). Variables de UI a
manejar: tema, sidebar colapsada, tab activa por detalle, paso del wizard, apertura de modales,
filtros (en URLSearchParams para que sean compartibles, como hoy).

## Assets
- **Fuentes:** General Sans (Fontshare CDN), JetBrains Mono (Google Fonts). En prod, autohospedar
  con `next/font` si se desea.
- **Iconos:** lucide (ya en el stack como `lucide-react`).
- **Imágenes/logos:** el prototipo usa cajas `.placeholder` y avatares generados. Sustituir por el
  **logo real de cada plaza** (`plaza.logoUrl`) y adjuntos reales. No hay assets propietarios.

## Files
Incluidos en este bundle (referencia de diseño):
- `index.html` — carga fuentes, lucide, CSS y JS; contenedor `#app`.
- `css/tokens.css` — **todos los design tokens** (claro/oscuro, acento, semántico).
- `css/base.css` — reset, shell (sidebar/topbar/main), utilidades.
- `css/components.css` — botones, inputs, badges, tablas, tabs, KPI, timeline, stepper, modales, etc.
- `css/auth.css` — layouts de login/reset/home.
- `css/screens.css` — estilos específicos (calendario, matriz SLA, wizard, mini-cards, etc.).
- `js/data.js` — datos de ejemplo + mapas de estado + helpers (`money`, `dotColor`).
- `js/ui.js` — helpers de componentes (badges, tabla, KPI, gráficos SVG, etc.).
- `js/app.js` — shell, router, tema, modales, NAV config.
- `js/screens-auth.js` · `screens-admin-dashboard.js` · `screens-admin-catalog.js` ·
  `screens-admin-catalog2.js` · `screens-admin-ops.js` · `screens-admin-ops2.js` ·
  `screens-superadmin.js` · `screens-inquilino.js` — las 37 pantallas.

**Para ver el prototipo:** abrir `index.html` en un navegador. Entrar por el login con los atajos de
rol (Admin / Superadmin / Inquilino). Alternar tema con el icono sol/luna del topbar.
