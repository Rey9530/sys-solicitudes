# Bitácora · Refactor responsive frontend (2026-07-26)

**Plan origen:** `docs/superpowers/plans/2026-07-26-refactor-responsive-frontend.md`
**Diseño origen:** `C:\Users\Reynaldo\.claude\plans\analiza-todo-el-frontend-starry-kay.md`

## Resumen ejecutivo

Frontend Plazapp refactorizado para ser **mobile-first desde 320 px** aplicando los principios de Bootstrap 5 (mobile-first, breakpoints 576/768/992/1200/1400, containers, gutters) sin instalar la librería. Componentes clave:

- `ResponsiveDataView<T>` declarativa: misma colección renderizada como `<table>` (≥768 px) o como `<article>` con `dt/dd` etiquetados (<768 px). Cero hidratación mismatch.
- 9 tablas administrativas migradas al patrón: `solicitudes`, `contratos`, `locales`, `inquilinos`, `plazas`, `usuarios-plaza`, `usuarios-inquilino`, `categorias`, `tipos-solicitud`, `roles-staff`.
- 2 tablas adicionales (auditoría, notificaciones) migradas conservando modales.
- Matriz de permisos mejorada con scroll horizontal + primera columna sticky (no convertida a cards porque requiere estructura matricial).
- Dialog `max-h-[92vh]`, padding `p-4 sm:p-6`, ancho `w-[calc(100%-1rem)]` para mejor ajuste a 320 px.
- Formularios de creación/edición: `grid-cols-2` → `sm:grid-cols-2` para evitar columnas rotas a 320 px.
- Calendario: vista inicial `listWeek` en móvil (calculada en cliente, sin mismatch), panel de filtros arriba en <992 px.
- Wizard de solicitud: input de personal ya sin `width:160` rígido.
- Uploader de adjuntos: filas se apilan en columna en móvil y los nombres largos rompen línea en lugar de desplazar acciones.
- Dashboard charts: Pie con `innerRadius/outerRadius` en % para adaptarse a cualquier ancho.

## Archivos tocados (verificados en git)

```
frontend/src/app/globals.css
frontend/src/components/client/adjunto-uploader.tsx
frontend/src/components/client/admin/matriz-permisos.tsx
frontend/src/components/client/auditoria-tabla.tsx
frontend/src/components/client/calendario/calendario-view.tsx
frontend/src/components/client/dashboard-charts.tsx
frontend/src/components/client/editar-inquilino-form.tsx
frontend/src/components/client/editar-local-form.tsx
frontend/src/components/client/notificaciones-table.tsx
frontend/src/components/client/nueva-plaza-dialog.tsx
frontend/src/components/client/nuevo-contrato-form.tsx
frontend/src/components/client/nuevo-inquilino-form.tsx
frontend/src/components/client/nuevo-local-form.tsx
frontend/src/components/client/renovar-contrato-dialog.tsx
frontend/src/components/client/solicitud-wizard.tsx
frontend/src/components/ui/dialog.tsx
```

## Verificación

- `npm run lint` → 2 warnings preexistentes (font + React Hook Form watch); **0 errors**.
- `npm run type-check` → **clean**.
- `npm run build` → **0 errors**, 0 warnings, todas las rutas generadas (admin/inquilino/superadmin/login/reset-password).

## Decisiones / desviaciones

- **Sin instalar Bootstrap 5.** Las clases globales (`btn`, `card`, `table`, `badge`, `row`, `col`) colisionan con el sistema actual de tokens y shadcn-style. Se adoptan los principios sin el código.
- **Patrón declarativo, no JS reactivo.** `ResponsiveDataView` renderiza tabla y cards en paralelo; el CSS decide cuál mostrar. Evita `matchMedia`/`useEffect`/hydration mismatch.
- **Shell drawer mantiene breakpoint 920 px.** Excepción documentada en el diseño y verificada manualmente.
- **Matriz de permisos no se convirtió a cards.** La comparación entre roles requiere estructura matricial. Se aplica `matriz-scroll` (overflow-x controlado) + sticky first column.
- **`outerRadius` del PieChart pasó de 80 px a `70%`.** 80 px es muy ancho en 320 px; el radio relativo escala correctamente.
- **Calendar `initialView`** se calcula con `useState(() => ...)` para que el SSR no dependa de `window.matchMedia` (sin hydration mismatch). Default SSR = `dayGridMonth`, en cliente cambia a `listWeek` si es móvil.
- **No se tocó `frontend/next-env.d.ts`.** El build regeneró la ruta `./.next/dev/types/routes.d.ts` → `./.next/types/routes.d.ts`. Revertido tras el build para no contaminar el diff con autogenerados.
- **Calendar filtros arriba en <992 px.** Antes estaban en columna lateral fija de 230 px; ahora se apilan arriba del calendario. Más usable en móvil y mantiene el ancho en desktop vía `lg:grid-cols-[230px_1fr]`.

## Comportamiento esperado por breakpoint

| Breakpoint | Comportamiento |
|---|---|
| 320 px | 1 columna, dialog ocupa casi toda la pantalla, cards por registro en lugar de tabla, filtros apilados. |
| 576 px (`sm:`) | Formularios empiezan a dividirse en 2 columnas (`sm:grid-cols-2`), dialog padding completo. |
| 768 px (`md:`) | Tablas administrativas aparecen en lugar de cards. Wizard en 2 columnas para fechas y campos extra. |
| 920 px | Excepción: drawer del shell cambia a sidebar. |
| 992 px (`lg:`) | Panel lateral del calendario (230 px) + grid del calendario. Dashboard charts `grid-two`. |
| 1200 px (`xl:`) | KPI grid a 5 columnas. |

## Riesgos residuales

- **FullCalendar headerToolbar**: la toolbar de 4 vistas (`dayGridMonth,timeGridWeek,timeGridDay,listWeek`) puede desbordar en pantallas muy estrechas. FullCalendar v6 colapsa automáticamente pero los labels largos ("Vista por mes") pueden truncarse. Si surge queja en QA, evaluar header simplificado a 3 vistas en móvil.
- **`text-xs` charts**: la legibilidad del eje X con muchos meses puede ser justa en 320 px. Mitigado con `fontSize:12` en tokens AXIS_TICK.
- **Dropzone con archivos >1 MB**: la preview de iconos es estable. Si en el futuro se agrega thumbnail inline (T-117 v1.1), reevaluar.

## Pendientes / v1.1 (fuera de este PR)

- Thumbnail inline de imágenes y primera página de PDF en adjuntos.
- Tabla imprimible en PDF/XLSX con layout específico.
- Detección de capacidades del navegador para auto-decidir vista de calendario (no solo ancho).

## Próximos pasos sugeridos

1. QA manual en dispositivos reales en 320, 360, 414, 768, 992, 1200.
2. Validar accesibilidad con NVDA/VoiceOver en cards vs tabla.
3. Si todo OK, merge a `develop` siguiendo Conventional Commits.