import fs from 'node:fs';
import path from 'node:path';
import { expect, type Browser, type Page } from '@playwright/test';

const STATE_DIR = path.join(process.cwd(), 'test-results');
const STATE_TTL_MS = 10 * 60_000;

/**
 * Página autenticada vía formulario de login (Auth.js, cookie httpOnly).
 * El `storageState` se cachea 10 min en disco para no repetir logins: el
 * backend limita `POST /auth/login` a 5 req/min por IP y cada login del
 * formulario cuenta igual que uno de la API.
 */
export async function paginaAutenticada(
  browser: Browser,
  cuenta: { email: string; password: string },
): Promise<Page> {
  const file = path.join(STATE_DIR, `.e2e-state-${cuenta.email.replace(/[^a-z0-9]/gi, '_')}.json`);
  let state: string | undefined;
  try {
    if (Date.now() - fs.statSync(file).mtimeMs < STATE_TTL_MS) state = file;
  } catch {
    /* sin caché */
  }
  const context = await browser.newContext(state ? { storageState: state } : {});
  const page = await context.newPage();
  if (state) {
    // Verificar que la sesión cacheada sigue viva; si no, hacer login.
    await page.goto('/');
    if (!/\/login/.test(page.url())) return page;
  }
  await loginUI(page, cuenta.email, cuenta.password);
  fs.mkdirSync(STATE_DIR, { recursive: true });
  await context.storageState({ path: file });
  return page;
}

export async function loginUI(page: Page, email: string, password: string) {
  for (let intento = 0; intento < 2; intento++) {
    await page.goto('/login');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('button[type=submit]').click();
    try {
      await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
      return;
    } catch (err) {
      if (intento === 1) throw err;
      console.warn(`login UI ${email} no redirigió (¿throttle 5 req/min?); reintento en 60s`);
      await page.waitForTimeout(61_000);
    }
  }
}

/** Lunes (00:00) de la semana civil que contiene `yyyyMmDd`. */
function lunesDe(yyyyMmDd: string): number {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // lunes=0
  return d.getTime() - dow * 86_400_000;
}

/**
 * Cambia a la vista semanal y navega hasta la semana que contiene `fecha`.
 * FullCalendar arranca en la semana actual; se calcula el delta en semanas.
 */
export async function irASemanaDe(page: Page, fecha: string, hoy: string) {
  await page.locator('.fc-timeGridWeek-button').click();
  await expect(page.locator('.fc-timegrid')).toBeVisible();
  const delta = Math.round((lunesDe(fecha) - lunesDe(hoy)) / (7 * 86_400_000));
  const boton = delta > 0 ? '.fc-next-button' : '.fc-prev-button';
  for (let i = 0; i < Math.abs(delta); i++) {
    await page.locator(boton).click();
  }
  // Esperar a que el feed de la semana termine de cargar.
  await expect(page.locator('.fc-timegrid-event, .fc-event').first()).toBeVisible({
    timeout: 15_000,
  });
}
