import { test, expect, type Page } from '@playwright/test';
import { CUENTAS } from './helpers/api';
import { paginaAutenticada } from './helpers/ui';

/**
 * Superadmin: plazas, selector de plaza (impersonación del tenant), vista
 * cross-plaza de solicitudes con filtros, detalle y export CSV, y la
 * validación del alta de plaza (sin crear datos).
 */
test.describe.configure({ mode: 'serial' });

let page: Page;
test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  page = await paginaAutenticada(browser, CUENTAS.superadmin);
});
test.afterAll(async () => {
  await page?.context().close();
});

test('plazas: el listado muestra la plaza demo', async () => {
  await page.goto('/superadmin/plazas');
  await expect(page.locator('main').getByText(/demo/i).first()).toBeVisible();
});

test('plazas: el alta valida los campos obligatorios', async () => {
  await page.goto('/superadmin/plazas');
  await page.getByRole('button', { name: 'Nueva plaza' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('button[type=submit]').click();
  await expect(dialog.locator('.err, .text-red-600').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('selector de plaza: elegir demo da acceso a sus pantallas de admin', async () => {
  await page.goto('/superadmin/plazas');
  await page.locator('.tt-name').first().click();
  await page.getByRole('menuitemradio').filter({ hasText: /demo/i }).first().click();
  await page.goto('/admin/locales');
  await expect(page).toHaveURL(/\/admin\/locales/);
  await expect(page.locator('main').getByText(/Local|Módulo/).first()).toBeVisible();
});

test('solicitudes cross-plaza: filtra por estado y abre el detalle', async () => {
  await page.goto('/superadmin/solicitudes?estado=aprobada');
  await expect(page.locator('#f-estado')).toHaveValue('aprobada');
  const enlace = page.locator('main a[href^="/superadmin/solicitudes/"]').first();
  await expect(enlace).toBeVisible();
  await enlace.click();
  await expect(page).toHaveURL(/\/superadmin\/solicitudes\/[0-9a-f-]{36}/);
  await expect(page.locator('main').getByText(/SOL-/).first()).toBeVisible();
});

test('solicitudes cross-plaza: exportar CSV descarga un archivo', async () => {
  await page.goto('/superadmin/solicitudes');
  const descarga = page.waitForEvent('download', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const archivo = await descarga;
  expect(archivo.suggestedFilename()).toMatch(/\.csv$/);
});

test('dashboard global carga', async () => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto('/superadmin/dashboard');
  await expect(page.locator('main')).toBeVisible();
  expect(errores).toEqual([]);
});
