# 14 · Pausar solicitudes (T-091d-pausar)

> **Estado:** ✅ Implementada (2026-07-27).
> **Reemplaza el SUPUESTO S-FS-I** de `docs/05-flujo-de-solicitudes.md` (que excluía `pausada` y `en_ejecucion` de v1).

## Contexto

El state machine v1.0 (módulos 06/07) es lineal: una vez que una solicitud entra en `asignado`/`en_revision`, el admin asignado la lleva hasta `aprobada`/`rechazada` o el inquilino la cancela. No existía forma de "poner en pausa" una solicitud a la espera de información externa.

Esta tarea introduce el **estado `pausada`** como nueva transición reversible, con semántica mínima (v1): solo cambia `solicitud.estado`, congela el SLA y queda oculta de los KPIs `pendientes`. Sin emails, sin tocar calendario ni `local.estado`.

## Decisiones de diseño (vinculantes)

| # | Decisión | Justificación |
|---|---|---|
| D1 | Solo se puede pausar desde `asignado` y `en_revision` | Mismo gating que `tomar`/`liberar`. Mantiene el modelo simple: pausada solo cuando hay un responsable asignado. |
| D2 | Reanudar siempre vuelve a `en_revision` | Conserva `admin_asignado_id` y `asignada_at` (sin reset). El SLA retoma el conteo desde el envío original. |
| D3 | Sin efectos colaterales en v1 (no toca calendario, no toca `local.estado`) | Minimalista. Se itera después si hace falta. |
| D4 | Sin emails (silencioso, como `liberar`) | El motivo queda en `solicitud_historial` para auditoría. |
| D5 | **Cualquier admin_plaza con permiso `solicitudes.pausar`/`solicitudes.reanudar` puede pausar/reanudar** (no se restringe al admin_asignado_id) | Cobertura operativa: si el admin asignado está de vacaciones, ausente o incapacitado, cualquier otro admin de la plaza puede cubrir la solicitud sin reasignar. El gating puramente RBAC (`PlazaScopeGuard` + `RolesGuard` + `@RequirePermission`) es suficiente. El `admin_asignado_id` se CONSERVA — al reanudar, sigue siendo el responsable. |
| D6 | `pausada` NO es terminal pero SÍ queda congelada | El SLA retorna `null` (mismo trato que terminales en `calcularSlaStatus`); la matview `solicitud_sla_view` ya la excluye por no estar en el `IN(...)` activo. |
| D7 | El inquilino no puede editar/reenviar/cancelar cuando su solicitud está pausada | Banner informativo en `/inquilino/solicitudes/[id]`; acciones del panel se ocultan. |
| D8 | Filtro `pausada` agregado a la bandeja (admin) y al listado del inquilino | Para auditoría rápida. |

## Transiciones nuevas

| # | Transición | Actor | Efectos |
|---|---|---|---|
| T14 | `asignado\|en_revision → pausada` | Cualquier admin_plaza con `solicitudes.pausar` (o superadmin) | `admin_asignado_id` y `asignada_at` se CONSERVAN; historial `pausada` con motivo opcional; SLA congelado; sin email. |
| T15 | `pausada → en_revision` | Cualquier admin_plaza con `solicitudes.reanudar` (o superadmin) | `admin_asignado_id` y `asignada_at` se conservan (sin reset); historial `reanudada`; SLA retoma el conteo desde el envío original; sin email. |

`cancelar` también admite `pausada` como estado origen (extensión natural de T5).

## Archivos tocados

### Backend

| Archivo | Cambio |
|---|---|
| `backend/prisma/schema.prisma` | Enum `solicitud_estado` agrega `pausada`. Enum `solicitud_historial_evento` agrega `pausada` y `reanudada`. |
| `backend/prisma/migrations/20260727000001_solicitud_pausada/migration.sql` | `ALTER TYPE ... ADD VALUE` para los 3 valores nuevos. Sin rebuild de `solicitud_sla_view` (ya excluye pausada por diseño del `WHERE`). |
| `backend/src/modules/solicitudes/state/solicitud-state.service.ts` | `TRANSICIONES`: agrega `pausar` y `reanudar`. Métodos `pausar()` y `reanudar()` con gating `assertEsAsignado` (privado) y registro en historial. |
| `backend/src/modules/aprobaciones/aprobaciones.service.ts` | Wrappers `pausar()` y `reanudar()` con `withTenant`, `assertSolicitud` y `audit()`. |
| `backend/src/modules/aprobaciones/aprobaciones.controller.ts` | `POST :id/pausar` y `POST :id/reanudar` con `@Roles`, `@RequirePermission` y `ZodValidationPipe`. |
| `backend/src/modules/solicitudes/sla/sla.util.ts` | `TERMINALES` agrega `'pausada'` (retorna `null` en `calcularSlaStatus`). |
| `backend/prisma/seed-data/permisos.ts` | Permisos `solicitudes.pausar` y `solicitudes.reanudar` en `PERMISOS_CATALOG`. El rol `admin` del sistema los recibe auto-asignado. |

### Contratos

| Archivo | Cambio |
|---|---|
| `packages/contracts/src/solicitudes/index.ts` | `SolicitudEstadoSchema` agrega `'pausada'`. `SolicitudHistorialEventoSchema` agrega `'pausada'` y `'reanudada'`. `BandejaQuerySchema.estado` agrega `'pausada'`. Nuevo `PausarSolicitudSchema` (motivo opcional). |

### Frontend

| Archivo | Cambio |
|---|---|
| `frontend/src/app/(admin-plaza)/admin/solicitudes/actions.ts` | `pausarAction(id, motivo?)` y `reanudarAction(id)` con `assertAnyCan` y `postAccion`. |
| `frontend/src/components/client/solicitud-detail-admin.tsx` | Botón **Pausar** en panel lateral (visible en `asignado`/`en_revision` cuando `soyAsignado`). Botón **Reanudar** cuando `pausada` y `soyAsignado`. Mensaje informativo si está pausada pero NO soy el asignado. Diálogo `PausarDialog` con motivo opcional. `EVENTO_LABEL` agrega `pausada` y `reanudada`. |
| `frontend/src/components/client/solicitud-detail-inquilino.tsx` | Banner informativo `tone="info"` cuando `esPausada`. Acciones de Editar/Reenviar/Cancelar se ocultan en estado pausado. `EVENTO_LABEL` agrega `pausada` y `reanudada`. |
| `frontend/src/components/estado-badge.tsx` | `SOLICITUD_ESTADO_TONE` agrega `pausada: 'b-cyan'`. `SOLICITUD_ESTADO_LABEL` agrega `pausada: 'Pausada'`. |
| `frontend/src/app/(admin-plaza)/admin/solicitudes/page.tsx` | Filtro `estado` agrega opción `pausada`. |
| `frontend/src/app/(inquilino)/inquilino/solicitudes/page.tsx` | Filtro `estado` agrega opción `pausada`. |

### Documentación

| Archivo | Cambio |
|---|---|
| `docs/05-flujo-de-solicitudes.md` | Tabla §5.2 agrega `pausada`. Diagrama mermaid §5.3 agrega flechas `asignado/en_revision → pausada → en_revision`. Tabla §5.4 agrega T14 y T15. §5.5 nota emails silenciosos. §5.6 enum eventos agrega pausada/reanudada. §5.11 métricas pendientes/top5 excluyen pausada. §5.12 S-FS-I revisado. |
| `PLANIFICACION/14-pausar-solicitudes.md` | Este archivo. |

## Permisos RBAC nuevos

```ts
{ codigo: 'solicitudes.pausar',   modulo: 'solicitudes', accion: 'pausar',   descripcion: 'Pausar una solicitud activa (asignado|en_revision). Congela el SLA.' },
{ codigo: 'solicitudes.reanudar', modulo: 'solicitudes', accion: 'reanudar', descripcion: 'Reanudar una solicitud pausada (vuelve a en_revision conservando el asignado).' },
```

Aplicar `prisma db seed` tras la migración (idempotente; el rol `admin` los recibe auto-asignado por `PERMISOS_ROL_ADMIN_TODOS`).

## Códigos de error

| Código | Cuándo |
|---|---|
| `400 INVALID_STATE_TRANSITION` | Pausar desde `borrador`, `enviada`, `requerida_subsanacion`, `aprobada`, `rechazada`, `cancelada`, o reanudar desde cualquier estado que no sea `pausada`. |
| `403 FORBIDDEN` | Pausar/reanudar siendo `inquilino` o sin el permiso correspondiente. El gating es puramente RBAC: cualquier admin_plaza de la plaza con `solicitudes.pausar`/`solicitudes.reanudar` puede hacerlo. |
| `400 COMENTARIO_REQUERIDO` | No aplica: el motivo es opcional. |

## Verificación manual

1. `cd backend && npx prisma migrate dev && npm run prisma:seed` (migración + permisos).
2. `npm run start:dev` y login como `admin@demo.com`.
3. Solicitud en `en_revision` → panel lateral muestra botón **Pausar**. Click → diálogo → motivo opcional → confirmar.
4. Estado cambia a `pausada`. Badge `b-cyan`. Historial muestra `evento=pausada` con motivo.
5. Panel lateral ahora muestra botón **Reanudar** (variante success). Click sin diálogo → vuelve a `en_revision`.
6. `SELECT id, status FROM solicitud_sla_view WHERE id = '<id>';` debe retornar 0 filas cuando está pausada, 1 fila con status cuando está en revisión.
7. Login como inquilino de la solicitud → detalle muestra banner "Solicitud pausada por la administración". Las acciones Editar/Reenviar/Cancelar están ocultas.
8. Bandeja admin `/admin/solicitudes?estado=pausada` muestra la solicitud.
9. Verificar multi-tenancy: con JWT de OTRA plaza, los endpoints deben retornar 404 (RLS).

## Trabajo futuro (NO incluido en esta tarea)

- [ ] Email informativo al inquilino al pausar/reanudar (con unsubscribe).
- [ ] Reasignación masiva al cambiar responsable de subcategoría: incluir `pausada` en `categorias.service.ts:474` (decisión producto).
- [ ] UI: mover el badge a un componente más prominente cuando está pausada en la bandeja.
- [ ] Métrica `tiempo_promedio_pausa` en KPIs.
- [ ] Calendario: marcar `evento_calendario.deleted_at` al pausar una solicitud tipo `evento` aprobada (decisión producto).
- [ ] Local: liberar `local.estado=en_mantenimiento` al pausar una remodelación aprobada (decisión producto).

## Desviaciones del plan original

- ✅ Implementación fiel al plan aprobado (semántica mínima, sin efectos colaterales).
- ⚠️ **D5 revisada** (post-aprobación): el gating relajó de "solo el admin_asignado" a "cualquier admin_plaza con permiso". Decisión del owner tras discutir cobertura operativa (vacaciones / ausencia del asignado). No se espera que otro admin de la plaza abuse de la acción — queda registrado en `solicitud_historial` con `usuarioId` del actor.
- El plan sugirió `b-purple` para el badge; en globals.css no existe — se usó `b-cyan` (color distintivo disponible que comunica "congelado").
- ⚠️ **GOTCHA de Prisma 7 + ALTER TYPE (2026-07-27)**: la migración `20260727000001_solicitud_pausada` se marcó como aplicada pero los `ALTER TYPE ... ADD VALUE IF NOT EXISTS` no se ejecutaron en la BD (Prisma 7 los envuelve en BEGIN/COMMIT y PG <14 los rollback silenciosamente). Síntoma: `migrate status` dice OK, el `enum_range` no incluye `pausada`, y todo intento de `tx.solicitud.update({ estado: 'pausada' })` falla con `Invalid input value for enum solicitud_estado`. **Fix inmediato**: ejecutar los 3 ALTER TYPE manualmente desde una conexión sin transacción (pg Client o Prisma Studio). **Prevención futura**: si una migración modifica enums, considerar separar las sentencias en un archivo sin `BEGIN`/`COMMIT` o usar `prisma migrate diff` con `--create-only` y editar el SQL resultante.