# 15 · Cerrar solicitudes (T-091e-cerrar)

> **Estado:** ✅ Implementada (2026-08-11).
> **Revisa el SUPUESTO S-FS-A** de `docs/05-flujo-de-solicitudes.md` (estados terminales: `aprobada`, `rechazada`, `cancelada`).

## Contexto

El state machine v1.0 terminaba en `aprobada`: una vez que el admin aprobaba una solicitud, el flujo se acababa — aunque la **actividad real** (mantenimiento, evento, remodelación) todavía no se hubiera ejecutado. No había forma de registrar si la actividad terminó ni cómo terminó.

Esta tarea introduce el estado **`cerrada`** como nueva transición terminal, con un **resultado de cierre** (`exitoso` / `parcial` / `fallido` / `no_realizado`) y comentario obligatorio cuando el resultado no es `exitoso`. `aprobada` deja de ser terminal: pasa a significar "actividad autorizada, pendiente de ejecución".

## Decisiones de diseño (vinculantes)

| # | Decisión | Justificación |
|---|---|---|
| D1 | **Solo el admin asignado (o superadmin) puede cerrar.** Mismo guard que `aprobar`. | Defensa-en-profundidad ya probada: `403 NOT_ASSIGNED_ADMIN` para otros admins. SC-4: el creador no cierra. |
| D2 | **Resultado de cierre obligatorio** (`exitoso` / `parcial` / `fallido` / `no_realizado`). | El sistema necesita datos para los KPIs de ejecución y la toma de decisiones posterior. |
| D3 | **Comentario obligatorio cuando `resultado != 'exitoso'`.** Opcional para `exitoso`. | Justificación: si algo no salió bien, el inquilino merece saber por qué. Zod `.refine()` en `CerrarSolicitudSchema` cubre cliente + servidor. |
| D4 | `aprobada` **deja de ser terminal**. Aparece en la bandeja como "pendiente de cierre". | Refleja la realidad operativa: aprobada ≠ ejecutada. |
| D5 | **Sin SLA de ejecución.** La matview `solicitud_sla_view` ya excluye `aprobada`; `cerrada` también queda fuera naturalmente. | El SLA mide respuesta, no duración de la actividad. El cierre lo dispara el admin cuando la actividad termina. |
| D6 | **Email `solicitud-cerrada` al creador** con el resultado. Sin tocar `evento_calendario` ni `local.estado`. | Notificar al inquilino es prioritario; el calendario/local ya se ajustaron al aprobar (T6). |
| D7 | **No se reabre.** `cerrada` es terminal. | Si la actividad se repite o requiere nuevo permiso, se crea una nueva solicitud. |
| D8 | **Permiso `solicitudes.cerrar`**, asignado a los mismos roles que `solicitudes.aprobar`. | Privilegio simétrico al de decisión. Propagado a roles existentes en la migración. |
| D9 | **Sin tocar reportes para quitar el conteo de `aprobada`.** Tasa de aprobación cuenta `aprobada + cerrada`. | Una aprobada que aún no se cierra sigue contando como aprobada (decisión tomada). |
| D10 | **Bloqueo explícito de `updatePrioridad` cuando `estado === 'aprobada'`.** | Antes lo cubría `esTerminal`; ahora no aplica. |

## Transiciones nuevas

| # | Transición | Actor | Efectos |
|---|---|---|---|
| **T16** | `aprobada → cerrada` | Admin asignado (o superadmin) | `cerrada_at = now()`; `resultado_cierre`, `cierre_comentario`; historial `cerrada` con `<Resultado>: <comentario>`; email `solicitud-cerrada` al creador. No toca `evento_calendario` ni `local.estado`. |

`cancelar` **NO** admite `aprobada` como estado origen (decisión explícita D4): aprobada se cierra, no se cancela.

## Archivos tocados

### Backend

| Archivo | Cambio |
|---|---|
| `backend/prisma/schema.prisma` | Enum `solicitud_estado` agrega `cerrada`. Enum `solicitud_historial_evento` agrega `cerrada`. Nuevo enum `solicitud_resultado_cierre`. Modelo `solicitud` agrega `resultado_cierre`, `cierre_comentario`, `cerrada_at` + índice `solicitud_plaza_id_estado_decision_at_idx`. |
| `backend/prisma/migrations/20260811000001_solicitud_cerrada/migration.sql` | `ALTER TYPE` (con gotcha Prisma 7 documentado) + `CREATE TYPE` + `ALTER TABLE` + `CREATE INDEX` + propagación de permiso a roles con `solicitudes.aprobar` (`INSERT … ON CONFLICT DO NOTHING`). |
| `backend/prisma/seed-data/permisos.ts` | Agrega `solicitudes.cerrar` (mismos roles que `solicitudes.aprobar`). Actualiza la descripción de `solicitudes.aprobar`. |
| `backend/src/modules/solicitudes/state/solicitud-state.service.ts` | `ESTADOS_TERMINALES` ahora `['cerrada', 'rechazada', 'cancelada']`. `TRANSICIONES.cerrar` con `desde: ['aprobada']`. Nuevo método `cerrar()` modelado sobre `aprobar`. Exporta `RESULTADO_CIERRE_LABEL`. |
| `backend/src/modules/aprobaciones/aprobaciones.service.ts` | Nuevo `cerrar()` + `emailAlCreador(..., extraVars)`. |
| `backend/src/modules/aprobaciones/aprobaciones.controller.ts` | `POST /solicitudes/:id/cerrar` con `ZodValidationPipe(CerrarSolicitudSchema)` + `@RequirePermission('solicitudes.cerrar')`. |
| `backend/src/modules/solicitudes/solicitud.mapper.ts` | Mapea `resultadoCierre`, `cierreComentario`, `cerradaAt`. |
| `backend/src/modules/solicitudes/solicitudes.service.ts` | `updatePrioridad` bloquea `aprobada` explícitamente. `findDuplicados` excluye `cerrada`. |
| `backend/src/modules/solicitudes/sla/sla.util.ts` | Renombra `TERMINALES` → `SIN_SLA` (incluye `aprobada` también — la congelación se mantiene). |
| `backend/src/modules/reportes/reportes.service.ts` | KPIs por aprobadas ahora cuentan `aprobada + cerrada`. `ESTADO_LABEL`/`ESTADO_CLASE`/`marcaAguaParaEstado` cubren `cerrada`. |
| `backend/src/modules/adjuntos/adjuntos.service.ts` | `aprobada` deja de bloquear uploads (terminal array = `['cerrada', 'rechazada', 'cancelada']`) para que el admin pueda dejar evidencia antes de cerrar. |
| `backend/src/modules/notificaciones/email-templates.registry.ts` | Registra `solicitud-cerrada` (`critico: true`, `unsubscribe: false`). |
| `backend/src/modules/notificaciones/templates/solicitud-cerrada.html` | Plantilla Handlebars con `{{#if exitoso}}` para condicional el color. |

### Contracts

| Archivo | Cambio |
|---|---|
| `packages/contracts/src/solicitudes/index.ts` | `SolicitudEstadoSchema` agrega `cerrada`. `SOLICITUD_ESTADOS_TERMINALES = ['cerrada', 'rechazada', 'cancelada']` + helper `esEstadoTerminal()`. Nuevo `SolicitudResultadoCierreSchema`. `CerrarSolicitudSchema` con `.refine()` (comentario obligatorio cuando ≠ `exitoso`). `SolicitudOutputSchema`/`SolicitudDetailOutputSchema` agregan `resultadoCierre`, `cierreComentario`, `cerradaAt`. `BandejaQuerySchema` ahora referencia `SolicitudEstadoSchema` (sin duplicación). |

### Frontend (web)

| Archivo | Cambio |
|---|---|
| `frontend/src/components/estado-badge.tsx` | `SOLICITUD_ESTADO_TONE` agrega `cerrada → 'b-violet'`. `SOLICITUD_ESTADO_LABEL` agrega `cerrada`. Exporta `SOLICITUD_ESTADO_OPCIONES` (10 estados). `RESULTADO_CIERRE_TONE`/`_LABEL` + `ResultadoCierreBadge`. |
| `frontend/src/components/client/solicitud-detail-admin.tsx` | Usa `esEstadoTerminal` (sin array literal). Botón **Cerrar** en panel cuando `estado==='aprobada' && soyAsignado` (envuelto en `<Can permiso="solicitudes.cerrar">`). Modal `CerrarDialog` (select resultado + textarea con comentario obligatorio cuando ≠ `exitoso`). Bloque de estado `cerrada` muestra `ResultadoCierreBadge` + comentario + `cerradaAt`. Excluye `aprobada` del botón Cancelar. `EVENTO_LABEL` agrega `cerrada`. |
| `frontend/src/components/client/solicitud-detail-inquilino.tsx` | Usa `esEstadoTerminal`. Excluye `aprobada` del botón Cancelar. Banner "pendiente de cierre" en `aprobada`. Bloque de estado `cerrada` muestra resultado + comentario + `cerradaAt`. `EVENTO_LABEL` agrega `cerrada`. |
| `frontend/src/app/(admin-plaza)/admin/solicitudes/actions.ts` | Nuevo `cerrarAction` con `ensureCan(['solicitudes.cerrar'])` + `CerrarSolicitudSchema.safeParse()` + `postAccion(id, 'cerrar', …)`. |
| `frontend/src/app/(admin-plaza)/admin/solicitudes/page.tsx` | Filtro de estado usa `SOLICITUD_ESTADO_OPCIONES` (incluye `cerrada`). |
| `frontend/src/app/(inquilino)/inquilino/solicitudes/page.tsx` | Filtro de estado usa `SOLICITUD_ESTADO_OPCIONES`. |
| `frontend/src/components/client/reportes-generator.tsx` | Filtro de estado usa `SOLICITUD_ESTADO_OPCIONES` (`cerrada` incluida). |
| `frontend/src/components/client/dashboard-charts.tsx` | `ESTADO_COLORES` agrega `cerrada` (violet) + `pausada` (cyan) — faltaba. |

### Móvil (Flutter)

| Archivo | Cambio |
|---|---|
| `frontend_mobil/lib/features/solicitudes/domain/solicitud.dart` | Comentario del campo `estado` actualizado (incluye `cerrada`). |
| `frontend_mobil/lib/widgets/status_badge.dart` | `SolicitudEstadoMapper` agrega `cerrada → ('Cerrada', BadgeTone.violet)`. **Necesario** (switch exhaustivo). |

### Documentación

| Archivo | Cambio |
|---|---|
| `docs/05-flujo-de-solicitudes.md` | Tabla de estados: `aprobada` ya no terminal, `cerrada` agregada como terminal. Diagrama mermaid: `aprobada → cerrada`, terminales actualizados. Tabla de transiciones: nueva T16. §5.5 nueva fila email `solicitud-cerrada`. §5.7 "Tasa de aprobación" cuenta `aprobada + cerrada`. S-FS-A revisado. |
| `docs/04-modelo-de-datos.md` | §4.3.8 enum `solicitud_estado` actualizado. Nuevos campos `resultado_cierre`, `cierre_comentario`, `cerrada_at`. §4.10 DDL canónico actualizado + nuevo enum `solicitud_resultado_cierre` + índice. |
| `docs/06-roles-y-permisos.md` | §6.2.6 Aprobaciones: nueva fila **Cerrar (T16)**; filas ajustadas para reflejar que las decisiones requieren `admin_asignado` (consistente con SC-4). |
| `CLAUDE.md` | Diagrama ASCII del flujo: `aprobada → cerrada` agregada tras el bloque de comentarios. |

## Verificación (manual, sin tests automatizados — política del proyecto)

1. `docker-compose up -d` + `cd backend && npx prisma migrate dev`. Confirmar en psql:
   `SELECT unnest(enum_range(NULL::solicitud_estado));` debe incluir `cerrada`
   (gotcha Prisma 7 + `ALTER TYPE` documentado en la migración).
2. `npm run seed` → `solicitudes.cerrar` debe aparecer en `permiso` y en los roles
   con `solicitudes.aprobar`.
3. Flujo end-to-end: crear → enviar → (cron 15 min o `POST cron/test-auto-asignacion`)
   → tomar → aprobar.
4. Como admin **asignado**: `POST /solicitudes/:id/cerrar` con `resultado:'exitoso'` sin
   comentario → **200**. Con `resultado:'fallido'` sin comentario → **400**.
5. Como **otro** admin_plaza: cerrar → **403 `NOT_ASSIGNED_ADMIN`**.
6. Cerrar una solicitud en `en_revision` → **400 `INVALID_STATE_TRANSITION`**.
7. Cerrar dos veces → **400**.
8. `SELECT * FROM solicitud_historial WHERE solicitud_id=…` → fila `evento='cerrada'`.
9. Mailhog (`:8025`): llega `solicitud-cerrada` al creador con el resultado.
10. Solicitud `aprobada` pendiente: **no** aparece en `solicitud_sla_view`; en la UI no
    muestra semáforo; aparece en la bandeja como "Aprobada" pendiente de cierre.
11. Sobre una `aprobada` **no** se puede cancelar ni cambiar prioridad (UI + API).
12. **Multi-tenancy** (obligatorio): el admin de la plaza B no puede cerrar ni ver la
    solicitud de la plaza A (404/403).
13. Reportes: el PDF/XLSX de solicitudes cuenta la tasa de aprobación como
    `aprobada + cerrada` vs `aprobada + cerrada + rechazada`; la marca de agua de una
    cerrada aparece como `CERRADO/ok`.
14. `npm run lint && npm run type-check` en `frontend/`, `backend/` y `packages/contracts`;
    `flutter analyze` en `frontend_mobil/`.

## Riesgos / deuda técnica

- **Reportes históricos**: las solicitudes aprobadas **antes** de esta migración no
  pasaron por `cerrada`. Las consideradas "aprobadas" en KPIs siguen contando como
  tales; no se ejecuta backfill. Si el equipo quiere forzar el cierre retroactivo de
  aprobadas-pre-cerrada, será una tarea aparte (T-091e-bis).
- **Reabrir**: un admin que cerró por error no puede reabrir. Si la operativa lo
  demanda, abrir T-091f-reabrir con un SUPUESTO.
- **Calendario/local**: evento y remodelación crean filas en `evento_calendario` /
  cambian `local.estado` al aprobar (T6). Hoy no se revierten al cerrar; sigue siendo
  responsabilidad del flujo "mantenimiento-fin" (cron diario) liberar el mantenimiento.
