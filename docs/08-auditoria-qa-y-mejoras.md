# 08 · Auditoría QA del frontend web y mejoras funcionales (2026-10-27)

> Rama: `fix/auditoria-responsive`. Stack local completo (Next 16 en `:3000`, NestJS en `:4000`,
> PostgreSQL/MinIO/jsreport en Docker). Pruebas con Playwright 1.63 (Chromium).
> **Regla aplicada (pedido del owner):** lo visual se corrigió en el acto; lo funcional se
> documenta aquí. Por decisión del owner (2026-10-27) se corrigieron además los bugs de
> severidad **Alta** (§3.1); el resto queda pendiente (§3.2) y las mejoras en §4.

## 1. Qué se probó

| Nivel | Suite (`frontend/e2e/`) | Qué cubre |
|---|---|---|
| Público | `acceso.spec.ts` | login (validación, credenciales inválidas), reset de contraseña (solicitar y token inválido), redirecciones sin sesión |
| Accesos | `acceso.spec.ts` | separación por rol en el frontend; en la API: aislamiento entre plazas, endpoints de admin vedados al inquilino, 401 sin token |
| Responsive | `responsive.spec.ts` | **todas** las pantallas de los 3 roles + públicas (55 pantallas: 34 de admin, 14 de inquilino, 4 de superadmin y 3 públicas, incluido el detalle de solicitud en cada uno de sus estados) × 6 anchos: 360 y 390 (teléfono), 768 y 1024 (tablet), 1280 y 1440 (PC). Mide scroll horizontal, elementos cortados por el borde, texto desbordado, objetivos táctiles < 24 px y campos sin etiqueta; guarda captura de página completa. Variante en tema oscuro (`E2E_TEMA=dark`). |
| Flujo completo | `flujo-solicitud.spec.ts` | wizard → borrador → enviar → tomar → pedir subsanación → reenviar → tomar → comentar → aprobar → cerrar, con dos sesiones (inquilino y admin), historial y PDF del permiso |
| Admin | `admin-gestion.spec.ts` | alta de local, inquilino y contrato entre ambos (el local pasa a alquilado), edición, búsqueda, categorías, usuarios de staff, pantallas de consulta y export CSV |
| Inquilino | `inquilino.spec.ts` | contratos, calendario + iCal, adjuntos (válido y MIME prohibido), editar borrador, duplicar, cancelar con motivo |
| Superadmin | `superadmin.spec.ts` | plazas, validación del alta, selector de plaza (impersonación), solicitudes globales con filtro y detalle, export CSV, dashboard |
| Calendario | `calendario.spec.ts` (existente) | regresión de eventos, horas 12 h, solicitudes cerradas visibles |
| Regresiones | `regresiones-api.spec.ts` | los bugs Alta corregidos (F1, F5, F6, F7) contra la API |

Ejecución: `cd frontend && npx playwright test` (requiere el stack local levantado; ver
`playwright.config.ts`). Tema oscuro: `E2E_TEMA=dark npx playwright test e2e/responsive.spec.ts`.
Las capturas quedan en `frontend/e2e-capturas/` (ignorada por git). Los datos creados llevan
prefijo `E2E-`.

**Resultados:** ver §5.

## 2. Correcciones visuales aplicadas

| # | Problema | Dónde | Arreglo |
|---|---|---|---|
| V1 | La paginación listaba todas las páginas (20+ botones) y se salía de la pantalla en teléfono | `components/ui/pager.tsx` (11 listados) | Ventana de páginas con "…" y flechas ‹ ›; en < 480 px solo ‹ página actual › |
| V2 | "Todas / Asignadas a mí" se veía como texto plano pegado (el CSS de `.segment` solo estilaba `button` y el componente usa `<a>`) | Bandeja de solicitudes | `.segment a` con el mismo estilo y estado activo |
| V3 | Códigos de local partidos en dos líneas en tablas densas ("L-" / "SOL-1") | Tablas con `.mono` | `white-space: nowrap` para códigos |
| V4 | Sin indicio de que una tabla densa tiene más columnas a la derecha | Tablas en laptops | Sombras de scroll en `.table-wrap` |
| V5 | El aviso "Vista de plataforma (superadmin)" se partía en 4 columnas angostas en teléfono | Detalle de solicitud global | Usa el componente `<Banner>` |
| V6 | Títulos "14 · NOMBRE" con el "·" al inicio de la segunda línea | Detalle de contrato, local y contrato del inquilino | El título fluye como un solo texto |
| V7 | Subcategorías con encabezado distinto al resto y `text-gray-900` (ilegible en tema oscuro) | `/admin/categorias/[id]/subcategorias` | `PageHeader` con migas de pan, como las demás pantallas |
| V8 | Colores fijos de tema claro (`gray-*`, `red-50`, `amber-50`, `blue-50`) que en tema oscuro quedaban como manchas claras | 10 componentes (calendario, subcategorías, wizard, adjuntos, diálogos de alta, tipos de solicitud) | Tokens del tema (`--surface-*`, `--text-*`, `--danger-*`, badges `.b-*`, `.banner-*`) |
| V9 | Fechas civiles mostradas crudas en ISO (`2026-09-16`) junto a otras en `16-09-2026` | Contratos (lista, detalle, cierre, carga inicial), locales e inquilinos (contratos asociados), campos extra de solicitudes, resumen del wizard | `formatFechaDMY` (regla T-V22: fechas civiles `DD-MM-YYYY`; instantes `dd/MM/yyyy`) |
| V10 | Texto técnico para el usuario final: "…borrador y requerida_subsanacion (S-FS-F)" | Editar solicitud (inquilino) | "Puedes editar la solicitud (incluido el local) mientras esté en borrador o requiera subsanación." |
| V11 | Filtro de inquilinos sin botón (solo Enter o perder el foco) | `/admin/inquilinos` | Botón "Filtrar", igual que en los demás listados |
| V12 | Objetivos táctiles chicos en teléfono/tablet: migas de pan (19 px), selector segmentado, enlaces del área de adjuntos | Global (`pointer: coarse`) | Altura mínima 28 px en táctil |
| V13 | Diálogos nativos `prompt()` (feos en móvil y sin estilo) | Liberar y Cancelar (admin), Cancelar (inquilino) | `promptAction` (SweetAlert2), ver §3.1 |
| V14 | Accesibilidad: 38 campos sin nombre accesible (etiquetas sin asociar en el wizard, editar local/inquilino, rol de staff, reportes y configuración; buscadores; selector de prioridad), pestañas sin roles ARIA | Varias pantallas, `Tabs` | `htmlFor`/`id`, `aria-label`, `role="tablist"/"tab"/"tabpanel"` + `aria-selected`. El barrido final reporta 0 campos sin etiqueta. |
| V15 | Mensajes de validación en inglés ("Invalid email address", "Invalid option") | Todos los formularios | Zod en español (`lib/zod-es.ts`) con mensajes propios para los casos comunes ("Este campo es obligatorio.", "Correo electrónico inválido.") |
| V16 | El inquilino no veía el motivo de una subsanación salvo abriendo la pestaña Historial | Detalle de solicitud (inquilino) | Aviso "La administración pidió correcciones." con el motivo, arriba del detalle |
| V17 | Checkbox "todos" de la matriz de permisos de 13 px en táctil | Matriz de permisos | 20 px en táctil, como los demás |

## 3. Bugs funcionales

Severidad: **Alta** = rompe un flujo principal o expone datos; **Media** = resultado incorrecto
con salida manual; **Baja** = incoherencia menor. "Verificado" = reproducido contra la API local o
leído en el código el 2026-10-27.

### 3.1 Corregido en esta rama

| # | Bug | Severidad | Detalle |
|---|---|---|---|
| F0 | Pulsar "Cancelar" en el diálogo de motivo **ejecutaba igual** la cancelación de la solicitud (inquilino y admin) o la liberación (admin) | Alta | `prompt()` devuelve `null` al cancelar y el código hacía `?? undefined` y seguía. "Cancelada" es terminal: no se podía deshacer. Ahora `promptAction` devuelve `null` y la acción se aborta. Regresión en `flujo-solicitud.spec.ts`. |
| F1 | **Editar una solicitud de remodelación siempre fallaba** con `422 CAMPOS_EXTRA_INVALIDOS` | Alta | `UpdateSolicitudSchema.camposExtra` era un `z.union` de objetos que descartan claves desconocidas: el payload de remodelación encajaba con la opción de evento y perdía sus campos. Ahora el contrato acepta el objeto y el service lo valida contra el schema del tipo final (`validateCamposExtra`, que ya existía). Datos inválidos siguen dando 422. Regresión en `regresiones-api.spec.ts`. |
| F5 | **Cambiar el rol de staff de un usuario no hacía nada** (200 y "Usuario actualizado") | Alta | `UsuariosService.update` aplica `rolStaffId` a un `admin_plaza`: rol activo de la plaza, nunca `null` (un admin sin rol recibe todos los permisos por compatibilidad: sería escalada, 400 `ROL_STAFF_INVALIDO`) y sin dejar la plaza sin administrador del sistema (409 `ULTIMO_ADMIN_SISTEMA`). Regresión en `regresiones-api.spec.ts`. |
| F6 | **Un usuario deshabilitado desaparecía de todos los listados** y no se podía reactivar desde la UI | Alta | `GET /usuarios?activo=false` lista los deshabilitados (sin filtro sigue devolviendo solo activos, que es lo que esperan los selectores de responsable/reasignación). La pantalla de usuarios suma el filtro "Activos / Deshabilitados", y la tabla ya mostraba "Inactivo" y "Reactivar". Regresión en `regresiones-api.spec.ts`. |
| F7 | **Desactivar una plaza no impedía el login** de sus usuarios | Alta | `login` y `refresh` rechazan con 403 `PLAZA_INACTIVA` si la plaza del usuario está desactivada; al desactivar una plaza se revocan los refresh tokens de sus usuarios (las sesiones abiertas terminan cuando expira su access token, ≤ 1 h). El login del web muestra "La plaza de este usuario está desactivada…". Regresión en `regresiones-api.spec.ts`. |
| F18 | **No se podía crear un inquilino, local o contrato dejando vacío un campo opcional** (emails de contacto, tipo de cliente, área, fechas y plazo del contrato, fecha fin al renovar o cerrar): el formulario mostraba "Invalid email address" / "Invalid option" y no enviaba | Alta | Los inputs vacíos llegan como `''` y los schemas los rechazan en campos con formato. Nuevo `sinVacios()` (`lib/form-resolver.ts`) que trata `''` como "sin valor" (`undefined` en altas, `null` en la edición de inquilino para borrar) en: nuevo local, nuevo/editar inquilino, nuevo contrato, renovar y cerrar contrato. Cubierto en `admin-gestion.spec.ts` (alta de inquilino solo con datos básicos). |

### 3.2 Pendientes

| # | Bug | Severidad | Verificado | Reproducción | Arreglo propuesto |
|---|---|---|---|---|---|
| F2 | Un PATCH parcial de solicitud **apaga el modo emergencia** | Media | API | Borrador con `esEmergencia: true` → `PATCH {titulo}` → queda `false`. En Zod 4, `.partial()` aplica el `.default(false)`. | Quitar el `.default(false)` del schema de update (dejarlo solo en create). |
| F3 | Se puede **enviar una solicitud sin fechas** | Media | API | Duplicar una solicitud (copia sin fechas) → `POST /:id/enviar` → 201, queda `enviada` con fechas `null`; el PDF del permiso sale sin fechas. Las ventanas 48 h / 5 d / 7 d solo se validan al crear. | Validar fechas obligatorias y ventanas en `enviar` y `subsanar` (y en el PATCH). |
| F4 | Los textos se guardan con **entidades HTML** y el usuario las ve: `Pintura &amp; Acabados` | Media | API + captura | `POST /solicitudes {titulo: "Pintura & Acabados"}` → se guarda `Pintura &amp; Acabados` y la bandeja lo muestra literal. Afecta a nombres comerciales con `&`, `<`, `>`. | Para campos de texto plano, no codificar entidades (React ya escapa al mostrar); sanitizar solo la `descripcion` rica. Migrar datos existentes. |
| F8 | El superadmin ve **Calendario** y **Configuración** en el menú, pero el backend le responde 403 | Media | Código (`@Roles`) + inventario | Superadmin con plaza seleccionada → Calendario → error. | Permitir superadmin en esos endpoints (con `x-plaza-id`) o quitarlos de su menú. |
| F9 | El **inquilino no puede gestionar los adjuntos de sus contratos** en el web (la zona de subida aparece, pero la acción responde "Permiso denegado") | Media | Código (`assertAnyCan` con `contratos.adjuntos.*` y el inquilino tiene `[]`) | Inquilino → Mis contratos → detalle → subir PDF. | En las server actions, dejar pasar al inquilino dueño (el backend ya lo permite) o esconder la zona. |
| F10 | El backend **no valida que el local esté disponible** al crear un contrato, ni que el tipo de solicitud esté activo | Media | Código (`contratos.service.ts#create` solo comprueba que exista) | `POST /contratos` con un local `fuera_de_servicio` → se crea y lo deja `alquilado`. | Validar en `ContratosService.create` y `SolicitudesService.create`. |
| F11 | `PATCH /plazas/:id` y `POST /plazas/:id/logo` **no exigen permiso granular**: cualquier admin de la plaza cambia nombre, color o logo llamando a la API | Media (seguridad) | Código (`plazas.controller.ts`: solo `@Roles`) | Admin sin `configuracion.editar_branding` → `PATCH /plazas/:id` directo. | `@RequirePermission('configuracion.editar_general' / 'editar_branding')`. Importa más con la app móvil, que llama directo a la API. |
| F12 | `rechazar` no exige ser el admin asignado (aprobar, cerrar y pedir subsanación sí) | Baja | Código (`solicitud-state.service.ts`: `rechazar` no llama a `assertEsAsignado`) | Otro admin rechaza vía API. | Misma validación `NOT_ASSIGNED_ADMIN`. |
| F13 | Al **cerrar con resultado "exitoso"** se descarta el comentario opcional | Baja | Código (`solicitud-detail-admin.tsx`: con `exitoso` el DTO solo lleva `resultado`) | Cerrar con éxito y comentario → el comentario no se guarda. | Enviar el comentario siempre que exista. |
| F14 | El selector de **prioridad** aparece en `borrador` y `aprobada`, donde el backend responde 400 | Baja | Código (inventario A2-R4) | Cambiar prioridad en una aprobada. | Ocultarlo en esos estados. |
| F15 | **Mensajes de error genéricos**: varias acciones leen `err.message` y el backend manda `detail` (`PLAZA_SLUG_TAKEN`, `EVENTO_CERRADO` nunca llegan al usuario) | Baja | Código | Crear plaza con slug repetido. | Leer `detail` (string o lista) en `calendario-actions`, `reportes/export`, `superadmin/plazas/actions`. |
| F16 | "Dashboard global" del superadmin muestra **solo una plaza** si hay una seleccionada | Baja | Código | Elegir plaza y abrir Dashboard global. | No enviar `x-plaza-id` desde `/superadmin/*`. |
| F17 | **Rate limit por IP** (100/min, login 5/min): con la app móvil, usuarios detrás de la misma red (CGNAT, Wi-Fi de la plaza) compartirán el contador | Media (antes de publicar la app) | Código | Muchos dispositivos en la misma IP. | Clave del throttler por usuario autenticado (y por email en login). |
| F19 | En **Auditoría**, el enlace "ver entidad" de un evento de **subcategoría** abre `/admin/categorias/<id de la subcategoría>` → 404 | Baja | Código (revisión de la app móvil) | Editar una subcategoría y abrir su evento en Auditoría. | Para `entidad = subcategoria` usar el `categoriaId` del registro y enlazar a la lista de subcategorías de esa categoría (la app móvil ya lo hace). |

## 4. Mejoras funcionales propuestas

| # | Mejora | Valor | Esfuerzo |
|---|---|---|---|
| M1 | **Buscador por código en Locales**: la API ya soporta `search`, la pantalla no lo ofrece (137 locales, 20 por página) | Alto | Bajo |
| M2 | **Panel de decisión accesible en teléfono**: en el detalle de solicitud el panel queda al final de un detalle muy largo; un botón fijo abajo o el panel arriba en teléfonos ahorraría mucho scroll al admin | Alto | Bajo |
| M3 | **"Descargar permiso (PDF)" solo cuando tiene sentido** (hoy aparece también en borrador, rechazada y cancelada) | Medio | Bajo |
| M4 | **Exponer "Mis contratos" en el menú del inquilino** (la pantalla existe pero no está enlazada) y el detalle de usuario de plaza desde la lista | Medio | Bajo |
| M5 | **Reactivar categorías y subcategorías** desde la UI (el backend lo permite) | Medio | Bajo |
| M6 | **Fuera de servicio** con el endpoint dedicado (`POST /locales/:id/fuera-de-servicio`, que rechaza las solicitudes pendientes) en vez del PATCH genérico | Medio | Bajo |
| M7 | **Ocultar botones sin permiso** (`<Can>`) en altas, ediciones, renovar/cerrar contrato, usuarios de inquilino, reportes y log de emails: hoy se muestran y fallan después con un toast | Medio | Medio |
| M8 | **Combos sin tope de 100**: locales/inquilinos en filtros y en "Nuevo contrato", plazas (50), desuscripciones (50); usar búsqueda o paginación | Medio | Medio |
| M9 | **iCal con rango de fechas y tipos** (hoy exporta todo el histórico) | Bajo | Bajo |
| M10 | **Filtros de fecha en hora de El Salvador** (emails, auditoría, reportes, solicitudes usan días UTC: un registro de las 19:00 cae en el día siguiente) | Medio | Bajo |
| M11 | **Buscador del topbar** ("Buscar… ⌘K") es decorativo: implementarlo (código de solicitud, local, inquilino) o quitarlo | Medio | Medio |
| M12 | **Comentarios internos** (solo staff) en solicitudes: hoy el inquilino ve todo comentario | Medio | Medio |
| M13 | **Branding para el inquilino**: no hay endpoint para leer el nombre/color de su plaza; el topbar muestra "Mi plaza" | Bajo | Bajo |
| M14 | **Etiquetas de obligatoriedad**: "Módulo *" y "Nivel *" al crear local son opcionales en el backend | Bajo | Bajo |
| M15 | **Aprobación especial inalcanzable**: `asistentes_estimados` está limitado a 20 y el umbral por defecto es 200 | Bajo | Bajo |
| M17 | **"Asignadas a mí" no hace nada para el rol "Administrador del sistema"**: el backend ignora el filtro para ese rol (a propósito, para que vea las `enviada` sin asignar), pero la UI marca "Asignadas a mí" como activo y muestra toda la plaza. Ocultar el selector para ese rol o respetar el filtro cuando se elige explícitamente | Medio | Bajo |
| M16 | **Documentación desactualizada**: `CLAUDE.md` dice access 15 min / refresh 7 d; el `.env` usa 1 h / 14 d (T-V13) | Bajo | Bajo |

Inventario completo de hallazgos de bajo nivel, con referencias a archivo y línea (A1-R…, A2-R…,
B1-R…, B2-R…, C-R…): `docs/superpowers/specs/2026-10-27-inventario-web-para-movil.md` §7.

## 5. Resultados de la corrida

Corrida final del 2026-10-27 contra el stack local (backend y frontend en modo dev):

| Suite | Resultado |
|---|---|
| Responsive, tema claro | **24/24** (55 pantallas × 6 anchos = 330 capturas). 0 scroll horizontal, 0 elementos cortados, 0 textos desbordados, 0 objetivos táctiles < 24 px, 0 campos sin etiqueta. |
| Responsive, tema oscuro | **24/24** (330 capturas), mismos 0 hallazgos. |
| Funcionales + regresiones | **51/51** (11 acceso, 8 flujo completo, 6 inquilino, 8 admin, 6 superadmin, 9 calendario, 3 regresiones). Una prueba de login fue intermitente por la compilación en frío de `next dev`; se amplió su espera. |
| Revisión visual | Capturas de teléfono de todas las pantallas (claro y oscuro) y de tablet/PC de las principales revisadas a ojo; lo encontrado está en §2. |

Antes de las correcciones el primer barrido ya pasaba casi todo: la base responsive
(`ResponsiveDataView`, drawer < 920 px) estaba bien. Lo que faltaba eran problemas que solo se ven
con datos reales (paginación de 20 páginas, códigos largos), en tema oscuro o mirando las capturas.

**Datos que dejan las pruebas en la plaza demo:** locales `E2E-*` (algunos con contrato), inquilinos
`E2E Comercial *`, solicitudes `E2E-*` / `VERIF-*` (en distintos estados, varias canceladas),
categorías `E2E Categoría *` (desactivadas al terminar) y usuarios staff `e2e.*@example.com`
(deshabilitados). Son datos de desarrollo; si molestan se pueden borrar filtrando por esos prefijos.

**Gotchas del entorno** (ya conocidos en el proyecto): `next dev` con Turbopack puede servir un
`globals.css` viejo tras varias ediciones seguidas (se resolvió reiniciando con `.next` limpio), y
Playwright vacía `test-results/` en cada corrida, por eso las capturas van a `e2e-capturas/`.
