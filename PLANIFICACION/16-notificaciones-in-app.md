# 16 · Notificaciones in-app (campana del topbar)

> **Estado:** ✅ Implementada (2026-09-25).
> **Complementa** el módulo 09 (`09-notificaciones-email.md`): los emails siguen igual; esto agrega una bandeja por usuario dentro de la app.

## Contexto

La campana del topbar (`frontend/src/components/shell/topbar.tsx`) era decorativa: botón sin acción y un punto rojo fijo. El sistema solo avisaba por email. Se pidió que las acciones relevantes para cada usuario caigan en la campana, con la información principal y que al hacer clic redirija a la solicitud.

## Decisiones (owner, 2026-09-25 — vinculantes)

| # | Decisión | Justificación |
|---|---|---|
| D1 | Destinatarios: **`admin_plaza` e `inquilino`**. **Superadmin no recibe** y no ve la campana (tampoco al impersonar). | Pedido explícito del owner. |
| D2 | **Polling del conteo cada 45 s**, solo con la pestaña visible; la lista se carga al abrir. | Sigue el patrón existente (`auto-refresh.tsx`); cero infraestructura nueva (sin SSE/WebSocket). |
| D3 | **Retención 90 días** con cron diario de limpieza (03:00 America/El_Salvador). | Tabla acotada; la bandeja muestra las 20 más recientes. |
| D4 | Eventos extra además de los ejemplos: comentarios, reenvío/cancelación del inquilino, contratos por vencer, pausar/reanudar/liberar. | Decisión del owner. |
| D5 | La notificación se inserta **en la misma transacción** que la transición (atómica con historial y `email_log`). **Nunca se notifica al actor.** | Consistencia: si la transición hace rollback, no queda notificación huérfana. |
| D6 | Los destinatarios se filtran a **usuarios activos de la misma plaza** (`plaza_id` = tenant, `deleted_at IS NULL`). | Descarta superadmin (p. ej. si tomó la solicitud) y cualquier id ajeno al tenant. |
| D7 | Bandeja **sin permiso granular** (`@RequirePermission`): cada usuario solo ve/marca las suyas. | Es información propia; la defensa es RLS por plaza + `usuario_id = JWT.sub`. |

## Catálogo de eventos

| Tipo | Disparador | Destinatario | Clic → |
|---|---|---|---|
| `solicitud_asignada` | Cron auto-asignación (15 min) | Responsable de la subcategoría | `/admin/solicitudes/:id` |
| `solicitud_nueva_supervisor` | Cron auto-asignación | Supervisores activos (sin duplicar al responsable) | idem |
| `solicitud_reasignada` | `POST :id/reasignar` y cambio de responsable de subcategoría (masivo) | Nuevo responsable | idem |
| `solicitud_desasignada` | Idem | Admin anterior | idem |
| `solicitud_en_revision` | `tomar` | Inquilino creador | `/inquilino/solicitudes/:id` |
| `solicitud_aprobada` / `_rechazada` / `_subsanacion` / `_cerrada` | Decisiones del admin (con motivo/indicación/resultado en el mensaje) | Creador | idem |
| `solicitud_pausada` / `_reanudada` / `_liberada` | Acciones del admin | Creador | idem |
| `solicitud_cancelada` | `cancelar` (inquilino o admin) y local fuera de servicio | Creador + admin asignado (menos el actor) | según rol |
| `solicitud_rechazada` | Local fuera de servicio (rama rechazo) | Creador | idem |
| `solicitud_reenviada` | `POST :id/subsanar` | Admin que pidió la subsanación (del historial `subsanada`) | `/admin/solicitudes/:id` |
| `comentario_nuevo` | Comentario tipo `general` | Autor admin → creador; autor inquilino → admin asignado (o quien pidió subsanación) | según rol |
| `contrato_por_vencer` | Cron T-30/T-7 (09:00 SV) | Todos los `admin_plaza` activos (aunque su email sea inválido); una por contrato | `/admin/contratos/:id` |

## Archivos tocados

### Backend
| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` + `migrations/20260925162103_notificacion_inapp` | Modelo `notificacion` (FK plaza/usuario/solicitud/contrato, cascade en usuario/solicitud/contrato), índices por `(usuario_id, leida_at)`, `(usuario_id, created_at DESC)`, `created_at`. RLS ENABLE+FORCE + policy `notificacion_tenant_isolation` + GRANT a `syssol_app`. |
| `modules/notificaciones/notificaciones-inapp.service.ts` | `notificar` / `notificarSolicitud` (textos centralizados por tipo) + bandeja (`listarInbox`, `contarNoLeidas`, `marcarLeida`, `marcarTodasLeidas`). |
| `modules/notificaciones/notificaciones.controller.ts` | `GET inbox`, `GET inbox/conteo`, `POST inbox/leer-todas`, `POST inbox/:id/leer` — `@Roles('admin_plaza','inquilino')`. |
| `modules/notificaciones/cron/notificaciones-limpieza.cron.ts` | Limpieza > 90 días. |
| `aprobaciones.service.ts`, `cron/auto-asignacion.cron.ts`, `solicitudes.service.ts`, `locales.service.ts`, `categorias.service.ts`, `contratos/cron/vencimiento-alert.cron.ts` | Enganches (ver catálogo). Módulos importan `NotificacionesModule`. |

### Contracts
`packages/contracts/src/notificaciones/inapp.ts`: `NOTIFICACION_TIPOS`, `NotificacionesInboxQuerySchema`, `NotificacionOutput`, `NotificacionesInboxOutput`, `NotificacionesConteoOutput`.

### Frontend
| Archivo | Cambio |
|---|---|
| `lib/server/notificaciones-inbox-actions.ts` | Server Actions BFF (el JWT no llega al cliente). |
| `components/shell/notifications-bell.tsx` | Campana: badge real (`9+`), popover en portal (patrón `PlazaSelector`), iconos por tipo, tiempo relativo, "Marcar todas como leídas", clic → marca leída + navega. Fechas absolutas en TZ de plaza (`formatInPlazaTz`). |
| `components/shell/topbar.tsx` | Reemplaza el botón decorativo; oculto para superadmin. |
| `app/globals.css` | Estilos `.notif-*` y `.notif-badge` (tokens claro/oscuro existentes). |

## Verificación realizada (2026-09-25, stack local levantado)

- Migración aplicada; `\dp notificacion` muestra GRANT a `syssol_app` y policy; `relforcerowsecurity = t`.
- Flujo completo por API (inquilino crea/envía → cron asigna → admin toma/comenta/pide subsanación → inquilino comenta/reenvía → cron reasigna → pausa/reanuda/aprueba/cierra; rechazo; cancelación por inquilino; liberar): cada destinatario recibe el tipo correcto y el actor no se auto-notifica.
- Seguridad: admin de otra plaza marcando una notificación ajena → 404; admin marcando la de un inquilino de su plaza → 404; superadmin (con y sin `x-plaza-id`) → 403; bandeja de otra plaza vacía.
- Cron de contratos (endpoint dev `cron/test-alertas`) genera `contrato_por_vencer` con link al contrato. Cron de limpieza borra la de 91 días y conserva la de 89.
- **Fechas/TZ:** evento 15:42–17:10 local → `evento_calendario.inicio = 21:42Z` (15:42 America/El_Salvador), feed una sola vez; evento 08:05 → 14:05Z; detalle admin muestra `8:05am` / `28-09-2026`. `created_at` de notificaciones en UTC (timestamptz) y mostrado relativo o en TZ de plaza (`16:33Z` → `10:33am`).
- Regresión: suite e2e existente `npm run test:e2e` (calendario) 3/3 ✅; emails existentes siguen encolándose y enviándose (`solicitud-recibida`, `solicitud-aprobada`, `solicitud-asignada-responsable`); historial intacto.
- UI (Playwright) a 1280/1024/768/390 px: popover dentro del viewport, sin scroll horizontal, claro y oscuro, sin errores de consola.
- `type-check` + `lint` backend/frontend y `build` backend/contracts en verde.

## Bitácora de cambios

- **2026-09-25 — implementación inicial.**
  - ⚠️ Se agregó el tipo `solicitud_desasignada` (no estaba en el plan) para avisar al admin anterior en reasignaciones.
  - ⚠️ `pedirSubsanacion` y `reenviar` limpian `admin_asignado_id`: para `solicitud_reenviada` y comentarios del inquilino en `requerida_subsanacion` se resuelve el admin desde el último historial `subsanada`.
  - ⚠️ `vencimiento-alert.cron`: la consulta de admins ya no filtra `email_invalido` (in-app para todos); el filtro se aplica solo al email. Fecha del mensaje en `DD-MM-YYYY` (formato civil, sin conversión TZ: `fecha_fin` es `DATE`).
  - ⚠️ Gotcha: `prettier-plugin-tailwindcss` recorta espacios dentro de template literals de `className` (`` `notif-item${x ? ' unread' : ''}` `` perdía el espacio). Se usa `cn('notif-item', cond && 'unread')`.
  - Deuda detectada (no corregida aquí, fuera de alcance): `locales.service.ts` encola la plantilla de email `solicitud-rechazada` también cuando la solicitud se **cancela** por local fuera de servicio. La notificación in-app sí usa el tipo correcto.
  - Sin dependencias nuevas.
