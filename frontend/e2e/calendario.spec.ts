import { test, expect } from '@playwright/test';
import { CUENTAS, crearYAprobarEvento, feedCalendario, fechaPlazaMasDias } from './helpers/api';
import { paginaAutenticada, irASemanaDe } from './helpers/ui';

/**
 * Regresión: una solicitud de evento aprobada debe verse UNA sola vez en el
 * calendario y a la hora pedida (hora de la plaza, America/El_Salvador).
 *
 * Bug reportado 2026-09-24: el inquilino veía 2 eventos, uno de ellos 6 h
 * antes (15:42 → 09:42). Causa: el feed emitía la misma solicitud como item
 * `evento` (evento_calendario) y como item `solicitud`, y este último
 * interpretaba "HH:MM" de la plaza como UTC (calendario.service.ts).
 */
const HORA_INICIO = '15:42';
const HORA_FIN = '17:42';
const HORA_RE = /\b(15|3):42\b/; // "15:42" (es) o "3:42 p. m." según formato de FullCalendar

let evento: Awaited<ReturnType<typeof crearYAprobarEvento>>;
const hoy = fechaPlazaMasDias(0);
// Modo estándar: inicio ∈ [ahora + 48 h, ahora + 5 d] (CreateSolicitudSchema).
const fecha = fechaPlazaMasDias(3);

test.beforeAll(async () => {
  // El helper puede esperar hasta 60 s si el login está throttled (5 req/min).
  test.setTimeout(180_000);
  evento = await crearYAprobarEvento(fecha, HORA_INICIO, HORA_FIN);
});

test('API: el feed del inquilino trae la solicitud aprobada una sola vez y en UTC correcto', async () => {
  const items = await feedCalendario(CUENTAS.inquilino, `${fecha}T00:00:00-06:00`, `${fecha}T23:59:59-06:00`);
  const mios = items.filter((i) => i.extendedProps.solicitudId === evento.solicitudId);
  expect(mios, JSON.stringify(mios, null, 2)).toHaveLength(1);
  const [unico] = mios;
  expect(unico?.extendedProps.tipo).toBe('evento');
  // 15:42 America/El_Salvador (UTC-6) == 21:42Z
  expect(unico?.start).toBe(`${fecha}T21:42:00.000Z`);
});

test('UI inquilino: un solo evento a la hora solicitada', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await paginaAutenticada(browser, CUENTAS.inquilino);
  await page.goto('/inquilino/calendario?tz=plaza');
  await irASemanaDe(page, fecha, hoy);
  const ev = page.locator('.fc-event', { hasText: evento.titulo });
  await expect(ev).toHaveCount(1);
  await expect(ev.locator('.fc-event-time')).toHaveText(HORA_RE);
});

test('UI admin: un solo evento a la hora solicitada', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await paginaAutenticada(browser, CUENTAS.admin);
  await page.goto('/admin/calendario?tz=plaza');
  await irASemanaDe(page, fecha, hoy);
  const ev = page.locator('.fc-event', { hasText: evento.titulo });
  await expect(ev).toHaveCount(1);
  await expect(ev.locator('.fc-event-time')).toHaveText(HORA_RE);
});
