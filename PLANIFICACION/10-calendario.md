# Módulo 10 — Calendario

> **Propósito:** Vista de calendario con FullCalendar React (Client Component) mostrando eventos aprobados, mantenimientos programados y hitos contractuales. Detección visual de choques, export iCal (`.ics`), creación de solicitud `evento` desde el calendario, TZ de la plaza, y colores por tipo.
>
> **Pre-requisito:** T-001 a T-127 (incluye Notificaciones) deben estar `Completada`.

## Tabla de tareas

| ID | Título | Prioridad | Estado |
|---|---|---|---|
| T-128 | Crear migración Prisma con `evento_calendario` | Alta | Completada (adelantada al módulo 07) |
| T-129 | Implementar GET /api/v1/calendario (feed de eventos para FullCalendar) | Alta | Completada |
| T-130 | Implementar GET /api/v1/calendario/export.ics | Alta | Completada |
| T-131 | Implementar detección visual de choques (overlap query) | Media | Completada |
| T-132 | Implementar creación de solicitud tipo evento desde calendario | Media | Completada |
| T-133 | Implementar pantalla /calendario con FullCalendar (Client Component) | Alta | Completada |
| T-134 | Implementar filtros por local/inquilino/tipo y TZ de la plaza | Media | Completada |

---

### T-128 — Crear migración Prisma con `evento_calendario`

- **Descripción:** Crear el modelo `evento_calendario` 1:1 con solicitud aprobada de tipo `evento`: `id` (UUID), `plaza_id` (FK), `solicitud_id` (FK UNIQUE), `titulo` (TEXT), `inicio` (TIMESTAMPTZ), `fin` (TIMESTAMPTZ), `color` (TEXT), `deleted_at` (nullable, soft delete). Materializa `docs/04` §1.1 y T-102.
- **Criterios de aceptación:**
  - [ ] Modelo `evento_calendario` con todos los campos.
  - [ ] `solicitud_id` UNIQUE (1:1).
  - [ ] CHECK constraint: `fin > inicio`.
  - [ ] Índice `INDEX(plaza_id, inicio)`, `INDEX(plaza_id, deleted_at)`.
  - [ ] Migración aplicada.
  - [ ] RLS habilitado.
  - [ ] Trigger: si `evento_calendario.solicitud_id` cambia de estado (e.g. a `cancelada` por reversión), soft delete automático del evento.
- **Dependencias:** T-074, T-102 (en `07-aprobaciones.md`).
- **Prioridad:** Alta.
- **Estado:** Completada (⚠️ adelantada al módulo 07).
- **Bitácora de cambios:**
  - **2026-06-06 (rama `feat/modulo-07-aprobaciones`):** Modelo + migración + RLS + CHECK `fin > inicio` adelantados al módulo 07 (T-102 los necesitaba al aprobar eventos). Upsert 1:1 al aprobar; soft delete con `deleted_at`. ⚠️ El trigger de soft-delete automático por cambio de estado de la solicitud NO se implementó (la reversión es solo-BD por superadmin, S-FS-B; decidir en módulo 10 si se añade). El feed `GET /api/v1/calendario` sigue pendiente (T-129).
  - **2026-06-07 (rama `feat/modulo-10-11-calendario-reportes`):** Cerrado el pendiente (decisión owner): migración `20260607215949_modulo_10_evento_calendario_trigger` con `tg_evento_calendario_soft_delete` (AFTER UPDATE OF estado ON solicitud, SECURITY DEFINER — la reversión solo-BD corre sin contexto RLS): `aprobada → otro estado` soft-deletea el evento; `otro → aprobada` lo restaura (deleted_at = NULL). Verificado con reversión y re-aprobación directas en SQL. T-128 queda 100% completa.

### T-129 — Implementar GET /api/v1/calendario (feed de eventos para FullCalendar)

- **Descripción:** Implementar el endpoint que retorna el feed de eventos en formato FullCalendar (campos `id`, `title`, `start`, `end`, `color`, `extendedProps`). Materializa CU-CA-1 a CU-CA-5.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/calendario?from=&to=&localId=&tipo=&inquilinoId=` con autenticado.
  - [ ] Retorna `evento_calendario` (de solicitudes `evento` aprobadas) + mantenimientos programados (locales en `en_mantenimiento` con `fecha_inicio_mantenimiento` / `fecha_fin_mantenimiento`) + hitos contractuales (contratos por vencer en los próximos 30 días, si `calendar_mostrar_hitos_contrato = true`).
  - [ ] Formato compatible con FullCalendar `eventSources`:
    ```json
    [
      { "id": "evt-1", "title": "Feria de navidad", "start": "2026-12-01T18:00:00-06:00", "end": "2026-12-01T22:00:00-06:00", "color": "#10b981", "extendedProps": { "tipo": "evento", "solicitudId": "..." } },
      { "id": "mnt-1", "title": "Remodelación Local A-12", "start": "2026-11-15", "end": "2026-12-15", "color": "#f59e0b", "extendedProps": { "tipo": "mantenimiento", "localId": "..." } }
    ]
    ```
  - [ ] Filtros validados con Zod.
  - [ ] `from`/`to` en ISO-8601.
  - [ ] `inquilino` solo ve eventos de sus locales.
  - [ ] RLS probado.
- **Dependencias:** T-128, T-102, T-103, T-043.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — `GET /api/v1/calendario?from=&to=&localId=&tipo=&inquilinoId=` implementado en `calendario.service.ts` con schemas Zod en `packages/contracts/src/calendario/`. Tres fuentes: `evento_calendario` vivos (join a solicitud para código/local/inquilino), locales `en_mantenimiento` con ventana programada (all-day) y contratos vigentes con `fecha_fin` en los próximos 30 días (si `calendar_mostrar_hitos_contrato`). IDs prefijados `evt-`/`mnt-`/`cto-`.
  - ⚠️ Desviación: los filtros multi-select aceptan listas separadas por coma (`localId=a,b&tipo=evento,hito_contrato`); los tipos expuestos son `evento|mantenimiento|hito_contrato` — `remodelacion` NO es distinguible en v1 (el local en mantenimiento no guarda qué tipo de solicitud lo originó; aparece como `mantenimiento` naranja, igual que el ejemplo del plan).
  - Bonus: el feed marca `extendedProps.choque=true` en eventos solapados del mismo local (evita una segunda llamada del frontend; el endpoint T-131 existe igual).
  - Color hito contractual: `#8b5cf6` (violeta — el plan no definía color para hitos).
  - Scope verificado: admin ve todo; `inquilino` solo SUS eventos/mantenimientos/hitos (por `inquilino_id` del JWT); superadmin sin plaza → 403 (el calendario es por plaza). Fechas en ISO-8601 UTC (`Z`), equivalentes al offset `-06:00` del ejemplo.

### T-130 — Implementar GET /api/v1/calendario/export.ics

- **Descripción:** Implementar el endpoint que retorna un archivo `.ics` (iCalendar RFC 5545) con los eventos del usuario. Materializa S-ICalExport.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/calendario/export.ics` retorna `Content-Type: text/calendar` y `Content-Disposition: attachment; filename="plazapp-{plaza_slug}.ics"`.
  - [ ] Genera un `VCALENDAR` con un `VEVENT` por cada `evento_calendario` del usuario.
  - [ ] Campos del VEVENT: `UID`, `DTSTART`, `DTEND`, `SUMMARY` (titulo), `DESCRIPTION` (link a la solicitud), `LOCATION` (local), `ORGANIZER`.
  - [ ] Filtros: `?localId=&tipo=`.
  - [ ] Compatible con Google Calendar, Apple Calendar, Outlook (probado con import manual).
  - [ ] RLS probado.
- **Dependencias:** T-128, T-129.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — `GET /api/v1/calendario/export.ics` con `Content-Type: text/calendar` y `Content-Disposition: attachment; filename="plazapp-{slug}.ics"`. VEVENT con UID/DTSTAMP/DTSTART/DTEND (UTC básico)/SUMMARY/DESCRIPTION (código + link al detalle según rol)/LOCATION (código del local)/ORGANIZER (nombre comercial + email_contacto de la plaza).
  - ⚠️ Decisión: generado **inline sin librería** — se evaluó `ics@3.12.0` en npm y se descartó (RFC 5545 es texto plano; cero dependencias nuevas). Incluye escape RFC (coma/punto y coma/saltos), CRLF y folding a 75 octetos (§3.1).
  - Filtros `?localId=&tipo=` (tipo se acepta pero solo hay VEVENTs de `evento_calendario`, igual que el criterio). Scope inquilino aplicado.
  - Verificado: descarga con headers correctos y estructura VCALENDAR válida. ⚠️ El import manual en Google/Apple/Outlook queda para QA del owner (no automatizable desde el entorno dev); la estructura sigue RFC 5545 estricto.

### T-131 — Implementar detección visual de choques (overlap query)

- **Descripción:** Implementar el endpoint y la lógica que detecta cuándo hay choques de eventos en el mismo local. Materializa S-Choques y CU-CA-7.
- **Criterios de aceptación:**
  - [ ] `GET /api/v1/calendario/choques?localId=&from=&to=` retorna los pares de eventos que se solapan en el mismo local.
  - [ ] Algoritmo: para cada par de eventos del mismo local con `[inicio, fin)` que se intersectan → marcar como choque.
  - [ ] El frontend (T-133) marca visualmente los eventos en conflicto con un borde rojo o patrón de rayas.
  - [ ] S-Choques: el aviso es solo visual, no bloquea la creación de eventos (decisión documentada).
  - [ ] RLS probado.
- **Dependencias:** T-128, T-129.
- **Prioridad:** Media.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — `GET /api/v1/calendario/choques?localId=&from=&to=` retorna pares `{ localId, localCodigo, eventoAId, eventoBId }` de eventos del mismo local con `[inicio, fin)` intersectados (sweep O(n²) sobre los eventos del rango — suficiente para volúmenes de una plaza). El feed (T-129) además marca `choque=true` en `extendedProps` para que el frontend pinte el borde rojo sin llamada extra.
  - S-Choques confirmado: solo aviso visual, NO bloquea creación/aprobación.
  - Verificado: dos eventos solapados en L-SOL-1 → 1 par; al mover uno (drag-and-drop) → 0 pares.

- **Descripción:** Permitir que el `inquilino` o `admin_plaza` haga click en un slot del calendario y se abra el wizard de nueva solicitud pre-rellenado con `tipo=evento` y la fecha/hora del slot. Materializa S-CrearDesdeCalendario.
- **Criterios de aceptación:**
  - [ ] En el calendario (T-133), click en un slot vacío abre un modal "Nueva solicitud de evento en este horario" con fecha/hora pre-rellenadas.
  - [ ] El modal redirige a `/solicitudes/nueva?tipo=evento&fecha={slot}&localId={slot}` o pre-rellena el wizard.
  - [ ] Solo permitido en slots que no tengan ya un evento en el mismo local (evitar duplicados obvios).
  - [ ] RLS probado.
- **Dependencias:** T-129, T-088 (en `06-solicitudes.md`).
- **Prioridad:** Media.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — Click en slot vacío (solo rol `inquilino`) abre modal "Nueva solicitud de evento en este horario" → link a `/inquilino/solicitudes/nueva?tipo=evento&fecha=YYYY-MM-DD&hora=HH:MM`. El wizard (T-088) ganó prop `prefill` validada server-side (tipo por Zod, fecha/hora por regex, localId contra los locales del inquilino).
  - "Evitar duplicados obvios": si el slot clickeado ya intersecta un evento aprobado visible, el modal lo avisa y NO ofrece el botón de crear (se valida contra el cache del feed, sin llamada extra).
  - ⚠️ Desviación: el plan decía "inquilino o admin_plaza" — el click-para-crear quedó SOLO para inquilino: el flujo de creación de solicitudes es del inquilino en toda la app (el admin no tiene wizard propio); el admin sí tiene drag-and-drop (ver T-133).
  - ⚠️ El prefill `localId={slot}` del plan no aplica en slots de mes/semana (un slot no pertenece a un local); se acepta el param si viene en la URL.

### T-133 — Implementar pantalla /calendario con FullCalendar (Client Component)

- **Descripción:** Implementar la pantalla del calendario con FullCalendar React como Client Component. Vistas mes/semana/día/lista, drag-and-drop opcional, color por tipo, click en evento abre detalle. Materializa S-CA-A.
- **Criterios de aceptación:**
  - [ ] `/calendario` con Server Component que carga la `plaza` y `configuracion` y pasa a un Client Component.
  - [ ] `frontend/components/client/calendar/calendar-view.tsx` (`"use client"`) con FullCalendar React.
  - [ ] Vistas: `dayGridMonth` (mes), `timeGridWeek` (semana), `timeGridDay` (día), `listWeek` (lista).
  - [ ] Locale `es` (FullCalendar soporta).
  - [ ] Timezone: la del usuario (browser) por defecto; puede cambiar a la de la plaza.
  - [ ] Color por tipo (config o default):
    - evento: verde `#10b981`
    - mantenimiento: naranja `#f59e0b`
    - remodelación: rojo `#ef4444`
    - otro: gris `#6b7280`
  - [ ] Click en evento → modal con detalles + botón "Ver solicitud" (link a `/solicitudes/[id]` o `/admin/solicitudes/[id]`).
  - [ ] Drag-and-drop: solo `admin_plaza` puede mover eventos (lo que actualiza `fecha_evento_inicio`/`fin` de la solicitud).
  - [ ] Botón "Exportar iCal" que descarga el `.ics`.
  - [ ] Botón "Nueva solicitud de evento" que abre el wizard (T-132).
  - [ ] Refrescamiento cada 5 min con `revalidatePath` o re-fetch manual.
- **Dependencias:** T-129, T-131, T-132, T-130, T-043, T-134.
- **Prioridad:** Alta.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — **FullCalendar 6.1.20** (latest verificada en npm; peers React 19 ✅) con plugins daygrid/timegrid/list/interaction/luxon3 + `luxon@3.7.2`. Componente `components/client/calendario/calendario-view.tsx` (`"use client"`); vistas mes/semana/día/lista, locale `es`, colores por tipo (evento usa el color de la fila; choque → borde rojo `#dc2626`).
  - ⚠️ Desviación de ruta (decisión owner): NO existe `/calendario` plano — son **`/admin/calendario`** y **`/inquilino/calendario`** (Server Components por grupo de rol que hidratan el mismo Client Component), consistente con la estructura de la app. Links añadidos a ambos navs.
  - El feed llega vía server action (`calendario-actions.ts`) — BFF S-ARQ-E/F: el JWT nunca toca el cliente. El export iCal usa un route handler (`/api/calendario/export.ics`) porque la descarga necesita headers de attachment.
  - Click en evento → modal con fechas/local/tipo + aviso de choque + botón "Ver solicitud" (ruta según rol). Botones "Exportar iCal" (hereda el filtro de locales) y "Nueva solicitud de evento" (inquilino).
  - Drag-and-drop y resize SOLO admin (decisión owner): `PATCH /api/v1/calendario/eventos/:id/fechas` actualiza evento + `fecha_evento_*`/`hora_*` de la solicitud (fecha civil y hora en TZ de la plaza, UTC-6 fija) SIN tocar el estado, con fila en historial y auditoría; revert visual si el backend falla. Verificado por API (mover deshizo el choque y actualizó la solicitud).
  - Refresco cada 5 min con `refetchEvents()` (re-fetch manual, no `revalidatePath`: los datos van por server action).

### T-134 — Implementar filtros por local/inquilino/tipo y TZ de la plaza

- **Descripción:** Implementar los filtros laterales del calendario y el switch de TZ.
- **Criterios de aceptación:**
  - [ ] Panel lateral con filtros:
    - Local (multi-select con los locales visibles para el usuario).
    - Inquilino (multi-select, solo admin).
    - Tipo de evento (checkboxes: evento, mantenimiento, remodelación, hito contractual).
    - "Mostrar hitos contractuales" (checkbox, si `calendar_mostrar_hitos_contrato = true`).
  - [ ] Switch de TZ: "Mi zona horaria" / "Zona horaria de la plaza".
  - [ ] Al cambiar, se re-fetchea el feed.
  - [ ] Los filtros se persisten en la URL (search params) para compartir el link.
  - [ ] RLS probado.
- **Dependencias:** T-129, T-133.
- **Prioridad:** Media.
- **Estado:** Completada (2026-06-07).
- **Bitácora de cambios:**
  - 2026-06-07 — Panel lateral en `calendario-view.tsx`: multi-select de locales (checkboxes), inquilinos (solo admin), tipos (evento/mantenimiento/hito contractual — el checkbox de hitos solo aparece si `calendar_mostrar_hitos_contrato`; además el feed lo re-valida server-side) y switch de TZ "Mi zona horaria" / "Zona de la plaza (GMT-6)" implementado con el plugin `@fullcalendar/luxon3` (`timeZone: 'America/El_Salvador'`).
  - Todos los filtros y la TZ persisten en la URL (`?localId=a,b&tipo=...&tz=plaza`) → links compartibles; al cambiar cualquier filtro se hace `refetchEvents()`.
  - ⚠️ `remodelacion` no aparece como tipo filtrable (ver bitácora T-129: no distinguible de mantenimiento en v1).
  - RLS/scope verificado a nivel API (T-129); la página del inquilino solo lista sus locales (derivados de contratos vigentes).
