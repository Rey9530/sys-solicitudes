# Refactor Responsive del Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer todo `frontend/` usable desde 320 px aplicando principios mobile-first de Bootstrap 5 sin instalar Bootstrap ni romper el design system actual.

**Architecture:** Mantener Tailwind 4, Radix y `globals.css` como fuente de verdad. Primero se endurecerán los patrones globales (shell, headers, containers, grids y dialogs); después se añadirá una primitiva declarativa `ResponsiveDataView<T>` que permite que las tablas densas se presenten como tarjetas en móvil y como tablas desde 768 px; finalmente se ajustarán las áreas especiales y se verificará cada viewport. No se duplicarán fetches ni lógica de negocio.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, Tailwind CSS 4, Radix Dialog, FullCalendar, Recharts, npm scripts existentes.

## Global Constraints

- No instalar Bootstrap 5 ni ninguna dependencia nueva.
- Soporte mínimo obligatorio: 320 px.
- Breakpoints de referencia: 576, 768, 992, 1200 y 1400 px.
- Mantener 920 px como excepción funcional del drawer del shell.
- Conservar branding por plaza, dark mode, tokens, permisos, autenticación y lógica de negocio.
- No modificar backend, contratos ni acciones de servidor salvo que una incompatibilidad de tipos lo exija explícitamente.
- No sobrescribir cambios preexistentes del working tree.
- Confirmaciones destructivas deben seguir usando `confirmAction` desde `frontend/src/lib/sweetalert.ts`.
- Verificar cada grupo con `npm run lint`, `npm run type-check` y, al final, `npm run build`.

---

### Task 1: Baseline y mapa de cambios

**Files:**
- Read: `F:/sys-solicitudes/frontend/package.json`
- Read: `F:/sys-solicitudes/frontend/src/app/globals.css`
- Read: `F:/sys-solicitudes/frontend/src/components/ui/table.tsx`
- Read: `F:/sys-solicitudes/frontend/src/components/ui/dialog.tsx`
- Read: `F:/sys-solicitudes/frontend/src/components/shell/app-shell.tsx`
- Modify: ninguno en esta tarea

**Interfaces:**
- Produces: lista concreta de scripts disponibles, estado inicial del frontend y mapa de reglas CSS que no deben eliminarse.

- [ ] **Step 1: Guardar el estado inicial sin alterar cambios existentes**

Run from repository root:

```bash
git status --short
cd frontend && npm run lint
cd frontend && npm run type-check
```

Expected: `git status` puede mostrar cambios preexistentes; lint y type-check deben dejar claro qué fallos ya existían antes de editar.

- [ ] **Step 2: Localizar reglas responsive y tablas existentes**

Run:

```bash
rg -n "@media|page-head|table-wrap|form-grid|stepper|cal-wrap|auth|kpi-grid" frontend/src/app/globals.css
rg -l "<Table|<table|className=\"tbl" frontend/src/components frontend/src/app
```

Expected: inventario de reglas y componentes que se tocarán en tareas posteriores.

- [ ] **Step 3: Registrar baseline en la bitácora de implementación**

Crear una nota de trabajo en `PLANIFICACION/` solo si existe una tarea técnica activa para responsive; no modificar documentos de tareas no relacionadas. El registro debe incluir fecha, comandos ejecutados y cualquier fallo preexistente, sin borrar entradas inmutables.

- [ ] **Step 4: Commit solo si se creó documentación nueva**

```bash
git status --short
```

No crear commit vacío ni incluir cambios preexistentes.

---

### Task 2: Normalizar containers, gutters y reglas globales mobile-first

**Files:**
- Modify: `frontend/src/app/globals.css`
- Optional modify: `frontend/tailwind.config.ts` solo si una clase existente depende de él; no eliminarlo sin verificar Tailwind 4

**Interfaces:**
- Consumes: tokens actuales, `.page`, `.main`, `.form-grid`, `.kpi-grid`, `.grid-two`, `.detail-grid` y excepción `.shell` a 920 px.
- Produces: clases globales `.container-x`, `.row-actions` y reglas mobile-first sin overflow horizontal del documento.

- [ ] **Step 1: Añadir tokens documentados de breakpoint sin cambiar el tema**

Dentro de la sección de tema global, añadir variables que puedan ser consultadas por CSS propio:

```css
:root {
  --bp-sm: 576px;
  --bp-md: 768px;
  --bp-lg: 992px;
  --bp-xl: 1200px;
  --bp-xxl: 1400px;
}
```

No usar variables CSS dentro de `@media`; las media queries conservarán valores literales para compatibilidad.

- [ ] **Step 2: Añadir container y acciones reutilizables**

En `@layer components`:

```css
.container-x {
  width: 100%;
  max-width: 1320px;
  margin-inline: auto;
  padding-inline: 1rem;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

@media (min-width: 576px) {
  .container-x { padding-inline: 1.25rem; }
}

@media (min-width: 992px) {
  .container-x { padding-inline: 1.5rem; }
}

@media (min-width: 1200px) {
  .container-x { max-width: 1180px; }
}

@media (min-width: 1400px) {
  .container-x { max-width: 1320px; }
}
```

- [ ] **Step 3: Hacer mobile-first los patrones estructurales**

Cambiar solo reglas equivalentes, conservando valores visuales actuales:

```css
.grid-two,
.grid-split,
.detail-grid,
.cal-wrap {
  grid-template-columns: 1fr;
}

.form-grid.c2,
.form-grid.c3 {
  grid-template-columns: 1fr;
}

@media (min-width: 576px) {
  .form-grid.c2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (min-width: 768px) {
  .grid-two,
  .grid-split { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .form-grid.c3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .detail-grid { grid-template-columns: minmax(0, 1fr) 340px; }
}

@media (min-width: 992px) {
  .cal-wrap { grid-template-columns: 230px minmax(0, 1fr); }
}
```

Conservar el drawer del shell en `max-width: 920px` y añadir comentario explicando la excepción. No reemplazar automáticamente todas las media queries de `globals.css`; revisar cada regla para no alterar calendarios ni auth accidentalmente.

- [ ] **Step 4: Prevenir overflow de la página**

Añadir únicamente si no existe una regla equivalente:

```css
html,
body {
  max-width: 100%;
  overflow-x: hidden;
}

.main,
.main-col,
.page,
.card {
  min-width: 0;
}
```

- [ ] **Step 5: Ejecutar validación CSS/TS**

```bash
cd frontend && npm run lint
cd frontend && npm run type-check
```

Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "feat(responsive): normaliza layout mobile-first"
```

---

### Task 3: Mejorar shell, topbar y PageHeader en móvil

**Files:**
- Modify: `frontend/src/components/shell/app-shell.tsx`
- Modify: `frontend/src/components/shell/topbar.tsx`
- Modify: `frontend/src/components/shell/sidebar.tsx` solo para atributos de accesibilidad
- Modify: `frontend/src/components/ui/page-header.tsx` solo si la semántica requiere cambios
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: `AppShell` existente, `Sidebar`, `Topbar` y clases `.page-head`/`.page-actions`.
- Produces: drawer usable por teclado y headers que no desbordan a 320 px.

- [ ] **Step 1: Implementar cierre del drawer con Escape**

En `app-shell.tsx`, añadir un `useEffect` que registre `keydown` solo mientras `mobileOpen` sea verdadero y cierre con `Escape`. No alterar la lógica de localStorage.

```tsx
useEffect(() => {
  if (!mobileOpen) return;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setMobileOpen(false);
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [mobileOpen]);
```

- [ ] **Step 2: Añadir semántica al backdrop y navegación activa**

Mantener el backdrop como botón con `aria-label="Cerrar menú"`. En el link activo de `sidebar.tsx`, añadir `aria-current="page"` solo cuando el item sea la ruta actual; no cambiar permisos ni rutas.

- [ ] **Step 3: Hacer responsive `.page-head` y `.page-actions`**

En `globals.css`, usar una columna por defecto y dos desde 768 px:

```css
.page-head {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.page-actions {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  gap: 8px;
}

@media (min-width: 768px) {
  .page-head { flex-direction: row; align-items: flex-start; justify-content: space-between; }
  .page-actions { width: auto; justify-content: flex-end; }
}
```

- [ ] **Step 4: Reducir gutters de topbar y evitar compresión**

Ajustar la regla existente, no duplicarla:

```css
.topbar { padding-inline: clamp(12px, 4vw, 28px); }
.top-tenant,
.top-avatar,
.top-icon { flex-shrink: 0; }
```

Si el selector de plaza tiene ancho fijo, usar `max-width: min(230px, 42vw)` y `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.

- [ ] **Step 5: Validar**

```bash
cd frontend && npm run lint && npm run type-check
```

Manual: probar drawer, Escape, backdrop, Tab y PageHeader a 320/360/768 px.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/shell frontend/src/components/ui/page-header.tsx frontend/src/app/globals.css
git commit -m "fix(responsive): compacta shell y encabezados"
```

---

### Task 4: Crear `ResponsiveDataView<T>` sin duplicar datos

**Files:**
- Create: `frontend/src/components/client/responsive/responsive-data-view.tsx`
- Modify: `frontend/src/components/ui/table.tsx` solo si hace falta exponer wrapper reutilizable
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Produces:

```ts
export interface ResponsiveColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  cardLabel?: React.ReactNode;
  primary?: boolean;
  hideOnCard?: boolean;
  className?: string;
  actions?: (row: T) => React.ReactNode;
}

export interface ResponsiveDataViewProps<T> {
  rows: readonly T[];
  columns: readonly ResponsiveColumn<T>[];
  rowKey: (row: T) => string;
  emptyState?: React.ReactNode;
}
```

- [ ] **Step 1: Implementar el componente cliente con dos variantes CSS**

Crear un Client Component que renderice simultáneamente una tabla y una lista de cards, usando clases `.responsive-data-table` y `.responsive-data-cards`. Esto evita leer `window.innerWidth`, hydration mismatch y layout shifts por breakpoint. La colección `rows` se recibe una sola vez.

La tabla debe producir `<table className="tbl">`, `<thead>`, `<tbody>`, `th` y `td`. La lista debe producir `<ul>` y cada registro `<li>` con `article` visual, `h2`/`h3` o bloque primario, y `<dl>` para campos secundarios. `hideOnCard` solo debe afectar la vista de tarjeta.

- [ ] **Step 2: Añadir reglas CSS de visibilidad**

```css
.responsive-data-cards { display: grid; gap: 12px; }
.responsive-data-table { display: none; }

@media (min-width: 768px) {
  .responsive-data-cards { display: none; }
  .responsive-data-table { display: block; min-width: 0; }
}
```

Las cards deben usar `min-width: 0`, `overflow-wrap: anywhere` para códigos/correos y `row-actions` para botones.

- [ ] **Step 3: Validar accesibilidad estructural**

Asegurar que cada `dt` tenga su `dd`, que las acciones mantengan nombres accesibles y que no se usen índices como keys. La tabla deberá conservar el contenido de headers; la tarjeta deberá mostrar `cardLabel` cuando exista.

- [ ] **Step 4: Validar tipos y lint**

```bash
cd frontend && npm run lint && npm run type-check
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/client/responsive frontend/src/components/ui/table.tsx frontend/src/app/globals.css
git commit -m "feat(responsive): añade vista reutilizable de tabla y tarjetas"
```

---

### Task 5: Migrar `SolicitudesTable` como tabla piloto

**Files:**
- Modify: `frontend/src/components/client/solicitudes-table.tsx`
- Read: `frontend/src/components/estado-badge.tsx`
- Read: `frontend/src/components/ui/avatar.tsx`

**Interfaces:**
- Consumes: `ResponsiveDataView`, `SolicitudListItem`, `baseHref`, `showSla`, `showAsignado`.
- Produces: mismas solicitudes y mismos enlaces/badges, con cards a menos de 768 px.

- [ ] **Step 1: Convertir celdas actuales a `ResponsiveColumn<SolicitudListItem>`**

Definir columnas con `codigo` como `primary`, `tipo`, `titulo`, `local`, `estado`, `prioridad`, `sla` condicional, `asignada`, `enviada` y `decision`. Las columnas condicionales deben construirse en el mismo orden que la tabla actual.

- [ ] **Step 2: Mantener enlaces y renderers actuales**

La celda del código debe seguir enlazando a `${baseHref}/${s.id}`. Reutilizar `SolicitudEstadoBadge`, `PrioridadBadge`, `SlaSemaforo`, `Avatar` y `formatDateInPlazaTz` sin cambiar contratos.

- [ ] **Step 3: Reemplazar solo el bloque de tabla**

Conservar el `Card` y `EmptyState`; dentro del Card usar:

```tsx
<ResponsiveDataView
  rows={solicitudes}
  columns={columns}
  rowKey={(row) => row.id}
/>
```

- [ ] **Step 4: Validar la tabla piloto**

```bash
cd frontend && npm run lint && npm run type-check
```

Manual: verificar móvil con y sin SLA/asignado y escritorio con la misma información.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/client/solicitudes-table.tsx
git commit -m "refactor(responsive): adapta tabla de solicitudes a tarjetas"
```

---

### Task 6: Migrar listados CRUD restantes

**Files:**
- Modify: `frontend/src/components/client/usuarios-plaza-table.tsx`
- Modify: `frontend/src/components/client/usuarios-inquilino-table.tsx`
- Modify: `frontend/src/components/client/contratos-table.tsx`
- Modify: `frontend/src/components/client/locales-table.tsx`
- Modify: `frontend/src/components/client/inquilinos-table.tsx`
- Modify: `frontend/src/components/client/plazas-table.tsx`
- Modify: `frontend/src/components/client/categorias-table.tsx`
- Modify: `frontend/src/components/client/tipos-solicitud-table.tsx`
- Modify: `frontend/src/components/client/roles-staff-table.tsx`

**Interfaces:**
- Consumes: `ResponsiveColumn<T>` y `ResponsiveDataView<T>` de Task 4.
- Produces: cards móviles conservando acciones, permisos, paginación y navegación.

- [ ] **Step 1: Migrar una tabla por vez**

Para cada componente, conservar fetches, estados, filtros, callbacks y acciones. Sustituir solo el JSX repetitivo de `Table` por columnas tipadas. Marcar como `primary` el nombre/código más útil y `hideOnCard` los campos secundarios puramente operativos.

- [ ] **Step 2: Adaptar acciones táctiles**

En cards, envolver acciones en `.row-actions`. No eliminar acciones por permisos. Si una acción solo muestra icono en móvil, mantener `aria-label` y tooltip/title existente.

- [ ] **Step 3: Mantener paginación fuera de la vista**

El componente seguirá recibiendo/renderizando el paginador existente una sola vez; `ResponsiveDataView` no debe asumir paginación.

- [ ] **Step 4: Validar cada grupo**

```bash
cd frontend && npm run lint && npm run type-check
```

Manual: 320/360/414/768/992 px para al menos una tabla de usuarios, contratos y catálogos.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/client/*-table.tsx
git commit -m "refactor(responsive): adapta listados administrativos a tarjetas"
```

---

### Task 7: Migrar auditoría, notificaciones y matriz de permisos

**Files:**
- Modify: `frontend/src/components/client/auditoria-tabla.tsx`
- Modify: `frontend/src/components/client/notificaciones-table.tsx`
- Modify: `frontend/src/components/client/admin/matriz-permisos.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: `ResponsiveDataView` para listas; matriz existente para comparación.
- Produces: auditoría/notificaciones legibles en móvil y matriz horizontal usable.

- [ ] **Step 1: Migrar la lista de auditoría**

Usar cards para eventos, conservar el botón/modal de detalle dentro de `actions` y mantener el diff interno con `overflow-x: auto`.

- [ ] **Step 2: Migrar notificaciones**

Mostrar destinatario/asunto/estado/fecha como campos etiquetados; conservar preview en `Dialog` y acciones actuales.

- [ ] **Step 3: Mejorar matriz de permisos sin convertirla a cards**

Añadir clase `matriz-tbl` y reglas:

```css
.matriz-scroll { overflow-x: auto; overscroll-behavior-x: contain; }
.matriz-tbl th:first-child,
.matriz-tbl td:first-child {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--surface);
}
.matriz-tbl thead th:first-child { z-index: 2; }
```

- [ ] **Step 4: Validar**

```bash
cd frontend && npm run lint && npm run type-check
```

Manual: modal de auditoría, preview de notificación y scroll de matriz a 320/768 px.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/client/auditoria-tabla.tsx frontend/src/components/client/notificaciones-table.tsx frontend/src/components/client/admin/matriz-permisos.tsx frontend/src/app/globals.css
git commit -m "fix(responsive): adapta auditoria notificaciones y matriz"
```

---

### Task 8: Ajustar formularios, wizard y diálogos

**Files:**
- Modify: `frontend/src/components/client/solicitud-wizard.tsx`
- Modify: `frontend/src/components/client/configuracion-form.tsx`
- Modify: `frontend/src/components/client/*-form.tsx` cuando usen grids o widths fijos
- Modify: `frontend/src/components/ui/dialog.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: grids globales de Task 2 y `DialogContent` actual.
- Produces: formularios utilizables desde 320 px sin cambios de validación ni server actions.

- [ ] **Step 1: Corregir grids rígidos del wizard**

Cambiar bloques como `grid grid-cols-2 gap-3` por `grid grid-cols-1 gap-3 sm:grid-cols-2`. Cambiar widths inline rígidos a `w-full sm:w-40 max-w-full` cuando sean campos auxiliares.

- [ ] **Step 2: Compactar stepper móvil**

En CSS, conservar los círculos/estado activo y ocultar o truncar labels secundarios solo en móvil sin eliminar información accesible. Añadir `aria-current="step"` al elemento activo si el componente todavía no lo tiene.

- [ ] **Step 3: Revisar formularios CRUD**

Buscar `grid-cols-2`, `grid-cols-3`, `w-24`, `w-[...]` y `style={{ width: ... }}` en formularios. Sustituir solo las anchuras que causan overflow; los inputs numéricos pequeños pueden conservar anchura si tienen `max-width: 100%`.

- [ ] **Step 4: Ajustar `DialogContent` para 320 px**

Conservar `max-h-[88vh]`, `overflow-y-auto`, Radix y el ancho actual, pero usar `w-[calc(100%-1rem)] p-4 sm:w-[calc(100%-2rem)] sm:p-6`. No cambiar z-index, overlay ni focus trap.

- [ ] **Step 5: Validar**

```bash
cd frontend && npm run lint && npm run type-check
```

Manual: wizard completo, formularios de alta/edición y dialogs largos a 320/360/768 px.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/client frontend/src/components/ui/dialog.tsx frontend/src/app/globals.css
git commit -m "fix(responsive): compacta formularios wizard y dialogs"
```

---

### Task 9: Ajustar calendario, uploads y charts

**Files:**
- Modify: `frontend/src/components/client/calendario/calendario-view.tsx`
- Modify: `frontend/src/components/client/adjunto-uploader.tsx`
- Modify: `frontend/src/components/client/adjuntos-contrato.tsx`
- Modify: `frontend/src/components/client/dashboard-charts.tsx`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Consumes: FullCalendar, existing URL filters, Recharts and file actions.
- Produces: calendar toolbar/filtros adaptables, archivos sin overflow y charts con altura estable.

- [ ] **Step 1: Ajustar layout del calendario**

Mantener filtros arriba del calendario bajo 992 px y dos columnas desde 992 px. Asegurar `min-width: 0` en el contenedor del calendario.

- [ ] **Step 2: Compactar toolbar de FullCalendar**

Usar una configuración memoizada que reduzca botones visibles bajo 768 px, manteniendo navegación de fecha y acceso a `listWeek`. No tocar carga de eventos, filtros URL, zona horaria, drag/drop ni permisos.

- [ ] **Step 3: Ajustar archivos**

En filas de archivos, aplicar `min-width: 0`, `flex-wrap: wrap` y botones que puedan bajar a otra línea. Reducir padding del dropzone bajo 576 px sin cambiar validaciones MIME/tamaño.

- [ ] **Step 4: Estabilizar charts**

Conservar `ResponsiveContainer`; asegurar que cada wrapper tenga altura explícita o mínima que funcione a 320 px. No cambiar datos ni colores semánticos.

- [ ] **Step 5: Validar**

```bash
cd frontend && npm run lint && npm run type-check
```

Manual: calendario de admin/inquilino, exportación iCal, interacción de eventos, upload, dashboard y charts a 320/768/992 px.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/client/calendario frontend/src/components/client/adjunto-uploader.tsx frontend/src/components/client/adjuntos-contrato.tsx frontend/src/components/client/dashboard-charts.tsx frontend/src/app/globals.css
 git commit -m "fix(responsive): ajusta calendario adjuntos y charts"
```

---

### Task 10: Verificación integral y documentación

**Files:**
- Read: `frontend/package.json`
- Modify: `PLANIFICACION/*.md` solo la bitácora de la tarea responsive correspondiente

**Interfaces:**
- Consumes: todos los cambios anteriores.
- Produces: evidencia técnica y manual de que el frontend responsive no rompe flujos existentes.

- [ ] **Step 1: Ejecutar lint y type-check completos**

```bash
cd frontend && npm run lint
cd frontend && npm run type-check
```

Expected: PASS. Si falla por código preexistente, separar exactamente los errores nuevos de los baseline y corregir los nuevos antes de continuar.

- [ ] **Step 2: Ejecutar build de producción**

```bash
cd frontend && npm run build
```

Expected: build finalizado correctamente sin errores de RSC, TypeScript ni páginas dinámicas nuevas.

- [ ] **Step 3: Verificar rutas por viewport**

Probar en DevTools a 320, 360, 414, 576, 768, 992, 1200 y 1440 px:

- `/login`;
- dashboards de admin, superadmin e inquilino;
- listados de solicitudes, usuarios, contratos, locales, inquilinos, plazas y catálogos;
- auditoría, notificaciones y permisos;
- configuración, reportes y adjuntos;
- calendario;
- wizard y detalles de solicitud.

En cada ruta comprobar que `body` no tenga scroll horizontal, que los controles sean alcanzables por teclado y que los datos/acciones permanezcan completos.

- [ ] **Step 4: Revisar diff y cambios ajenos**

```bash
git diff --check
git status --short
git diff --stat
```

Expected: solo archivos previstos del frontend y documentación de bitácora; ningún cambio backend o archivo preexistente sobrescrito.

- [ ] **Step 5: Añadir bitácora inmutable**

Registrar desviaciones reales, decisiones de breakpoints, resultado de comandos, rutas verificadas y cualquier tarea dependiente afectada. No borrar entradas antiguas; corregir mediante una entrada `actualización:`.

- [ ] **Step 6: Commit final de documentación si aplica**

```bash
git add PLANIFICACION/<bitacora-responsive>.md
git commit -m "docs(responsive): registra verificacion del frontend"
```

---

## Self-review del plan

- **Cobertura:** incluye containers/breakpoints, shell, headers, tablas, matriz, formularios, wizard, dialogs, calendario, uploads, charts, accesibilidad, pruebas y documentación.
- **Dependencias:** Task 4 define `ResponsiveColumn<T>` y `ResponsiveDataView<T>` antes de las tareas 5–7 que los consumen.
- **No se añaden dependencias:** confirmado.
- **No placeholders:** cada tarea identifica archivos, interfaces, pasos y comandos concretos.
- **Working tree:** Task 1 obliga a registrar baseline y todas las tareas limitan sus `git add` a archivos previstos.
- **Riesgo de cambios masivos:** la migración de tablas empieza con `SolicitudesTable` como piloto antes de propagarse.
