import { test, expect, type Page } from '@playwright/test';
import {
  CUENTAS,
  crearEventoCerrado,
  crearYAprobarEvento,
  feedCalendario,
  fechaPlazaMasDias,
  type FeedItem,
} from './helpers/api';
import { paginaAutenticada, irASemanaDe } from './helpers/ui';

/**
 * Regresión: una solicitud de evento aprobada debe verse UNA sola vez en el
 * calendario y a la hora pedida (hora de la plaza, America/El_Salvador).
 *
 * Bug reportado 2026-09-24: el inquilino veía 2 eventos, uno de ellos 6 h
 * antes (15:42 → 09:42). Causa: el feed emitía la misma solicitud como item
 * `evento` (evento_calendario) y como item `solicitud`, y este último
 * interpretaba "HH:MM" de la plaza como UTC (calendario.service.ts).
 *
 * Ampliado 2026-09-28 (pedido del cliente):
 *  - las solicitudes CERRADAS siguen en el calendario (antes un trigger de BD
 *    borraba su evento al cerrarlas);
 *  - el admin ve todas las solicitudes con fecha (cualquier tipo y estado);
 *  - el número de solicitud (`SOL-…`) siempre visible en el evento y en el modal;
 *  - horas en 12 h ("3:42 pm"), nunca "15:42".
 */
const HORA_INICIO = '15:42';
const HORA_FIN = '17:42';
const HORA_RE = /^3:42 pm/; // 12 h obligatorio (nunca "15:42")
const HORA_12H_RE = /^\d{1,2}:\d{2} (am|pm)/;

let evento: Awaited<ReturnType<typeof crearYAprobarEvento>>;
let cerrado: Awaited<ReturnType<typeof crearEventoCerrado>>;
const hoy = fechaPlazaMasDias(0);
// Modo estándar: inicio ∈ [ahora + 48 h, ahora + 5 d] (CreateSolicitudSchema).
const fecha = fechaPlazaMasDias(3);
const desdeSemana = `${fechaPlazaMasDias(-7)}T00:00:00-06:00`;
const hastaSemana = `${fechaPlazaMasDias(14)}T00:00:00-06:00`;

test.beforeAll(async () => {
  // El helper puede esperar hasta 60 s si el login está throttled (5 req/min).
  test.setTimeout(240_000);
  evento = await crearYAprobarEvento(fecha, HORA_INICIO, HORA_FIN);
  cerrado = await crearEventoCerrado(fecha, '10:00', '11:00');
});

test('API: el feed del inquilino trae la solicitud aprobada una sola vez y en UTC correcto', async () => {
  const items = await feedCalendario(CUENTAS.inquilino, `${fecha}T00:00:00-06:00`, `${fecha}T23:59:59-06:00`);
  const mios = items.filter((i) => i.extendedProps.solicitudId === evento.solicitudId);
  expect(mios, JSON.stringify(mios, null, 2)).toHaveLength(1);
  const [unico] = mios;
  expect(unico?.extendedProps.tipo).toBe('evento');
  // 15:42 America/El_Salvador (UTC-6) == 21:42Z
  expect(unico?.start).toBe(`${fecha}T21:42:00.000Z`);
  // El número de solicitud encabeza el título.
  expect(unico?.title.startsWith(`${unico?.extendedProps.solicitudCodigo} · `)).toBe(true);
});

for (const rol of ['inquilino', 'admin'] as const) {
  test(`API ${rol}: la solicitud CERRADA sigue en el calendario con estado cerrada`, async () => {
    const items = await feedCalendario(CUENTAS[rol], `${fecha}T00:00:00-06:00`, `${fecha}T23:59:59-06:00`);
    const mios = items.filter((i) => i.extendedProps.solicitudId === cerrado.solicitudId);
    expect(mios, JSON.stringify(mios, null, 2)).toHaveLength(1);
    expect(mios[0]?.extendedProps.tipo).toBe('evento');
    expect(mios[0]?.extendedProps.estado).toBe('cerrada');
  });
}

/** Códigos `SOL-…` de las solicitudes del feed cuyo inicio cae en la semana visible. */
function codigosEsperados(items: FeedItem[], ini: Date, fin: Date): string[] {
  return [
    ...new Set(
      items
        .filter((i) => i.extendedProps.tipo === 'evento' || i.extendedProps.tipo === 'solicitud')
        .filter((i) => {
          const s = new Date(i.start).getTime();
          const e = i.end ? new Date(i.end).getTime() : s;
          return s < fin.getTime() && e > ini.getTime();
        })
        .map((i) => i.extendedProps.solicitudCodigo as string),
    ),
  ].sort();
}

async function codigosEnPantalla(page: Page): Promise<string[]> {
  const textos = await page.locator('.fc-list-event .cal-evt-codigo').allInnerTexts();
  return [...new Set(textos.map((t) => t.trim()))].sort();
}

for (const rol of ['inquilino', 'admin'] as const) {
  test(`UI ${rol}: un solo evento, hora en 12 h y número de solicitud visible`, async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await paginaAutenticada(browser, CUENTAS[rol]);
    await page.goto(`/${rol}/calendario?tz=plaza`);
    await irASemanaDe(page, fecha, hoy);
    // Etiquetas del eje horario en 12 h (vista semana).
    await expect(page.locator('.fc-timegrid-slot-label-cushion').first()).toHaveText(HORA_12H_RE);
    // La vista semana apila máx. 1 evento solapado ("+N"); la agenda los lista todos.
    await page.locator('.fc-listWeek-button').click();
    const ev = page.locator('.fc-list-event', { hasText: evento.titulo });
    await expect(ev).toHaveCount(1);
    await expect(ev.locator('.fc-list-event-time')).toHaveText(HORA_RE);
    await expect(ev.locator('.cal-evt-codigo')).toHaveText(/^SOL-/);

    // Modal: número de solicitud explícito y rango en 12 h.
    await ev.locator('.cal-evt').click();
    const modal = page.getByRole('dialog');
    await expect(modal).toContainText(/N\.º solicitud:\s*SOL-/);
    await expect(modal).toContainText(/3:42 pm — .*5:42 pm/);
    await expect(modal).not.toContainText('15:42');
  });

  test(`UI ${rol}: la solicitud cerrada se ve con su número`, async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await paginaAutenticada(browser, CUENTAS[rol]);
    await page.goto(`/${rol}/calendario?tz=plaza`);
    await irASemanaDe(page, fecha, hoy);
    await page.locator('.fc-listWeek-button').click();
    const ev = page.locator('.fc-list-event', { hasText: cerrado.titulo });
    await expect(ev).toHaveCount(1);
    await expect(ev.locator('.cal-evt-codigo')).toHaveText(/^SOL-/);
    await ev.locator('.cal-evt').click();
    await expect(page.getByRole('dialog')).toContainText('Cerrada');
  });

  test(`UI ${rol}: la vista lista muestra TODAS las solicitudes del feed de la semana`, async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const page = await paginaAutenticada(browser, CUENTAS[rol]);
    await page.goto(`/${rol}/calendario?tz=plaza`);
    await irASemanaDe(page, fecha, hoy);
    await page.locator('.fc-listWeek-button').click();
    await expect(page.locator('.fc-list')).toBeVisible();
    // Rango visible (lunes-domingo de la semana de `fecha`, hora de la plaza).
    const d = new Date(`${fecha}T00:00:00-06:00`);
    const dow = (new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7;
    const ini = new Date(d.getTime() - dow * 86_400_000);
    const fin = new Date(ini.getTime() + 7 * 86_400_000);
    const esperados = codigosEsperados(await feedCalendario(CUENTAS[rol], desdeSemana, hastaSemana), ini, fin);
    expect(esperados.length).toBeGreaterThan(0);
    await expect.poll(() => codigosEnPantalla(page), { timeout: 15_000 }).toEqual(esperados);
    await page.screenshot({ path: `test-results/calendario-${rol}-lista.png`, fullPage: true });
  });
}
