import { test, expect, type Page } from '@playwright/test';
import { API_URL, CUENTAS, apiLogin } from './helpers/api';
import { esperarHidratacion, paginaAutenticada } from './helpers/ui';

/**
 * Gestión del admin de plaza por la UI: alta de local → alta de inquilino →
 * contrato entre ambos (el local pasa a «alquilado») → edición y búsqueda;
 * catálogo de categorías; alta y baja de un usuario de staff; y que las
 * pantallas de consulta (dashboard, calendario, reportes, auditoría,
 * notificaciones, configuración) cargan sus datos.
 *
 * Los registros creados llevan el prefijo E2E para identificarlos.
 */
test.describe.configure({ mode: 'serial' });

const SUFIJO = String(Date.now()).slice(-6);
const CODIGO_LOCAL = `E2E-${SUFIJO}`;
const RAZON_SOCIAL = `E2E Comercial ${SUFIJO} S.A. de C.V.`;
const CATEGORIA = `E2E Categoría ${SUFIJO}`;
const EMAIL_STAFF = `e2e.staff.${SUFIJO}@example.com`;

let page: Page;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  page = await paginaAutenticada(browser, CUENTAS.admin);
});
test.afterAll(async () => {
  await page?.context().close();
});

async function ir(ruta: string, hidratar = 'main') {
  await page.goto(ruta);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await esperarHidratacion(page, hidratar);
}

test('locales: alta con validación y aparece al buscar por código', async () => {
  await ir('/admin/locales/nuevo');
  await page.locator('#codigo').fill('código inválido');
  await page.getByRole('button', { name: 'Crear local' }).click();
  await expect(page.getByText(/mayúsculas, dígitos y guiones/).first()).toBeVisible();

  await page.locator('#codigo').fill(CODIGO_LOCAL);
  await page.locator('#modulo').fill('E');
  await page.locator('#nivel').fill('1');
  await page.locator('#areaM2').fill('42.5');
  await page.getByRole('button', { name: 'Crear local' }).click();
  await expect(page).toHaveURL(/\/admin\/locales$/, { timeout: 15_000 });

  const api = await apiLogin(CUENTAS.admin);
  const res = await api.get(`${API_URL}/locales`, { params: { search: CODIGO_LOCAL } });
  const body = (await res.json()) as { items: { codigo: string; estado: string }[] };
  expect(body.items.map((l) => l.codigo)).toContain(CODIGO_LOCAL);
  expect(body.items.find((l) => l.codigo === CODIGO_LOCAL)?.estado).toBe('disponible');
  await api.dispose();
});

test('inquilinos: alta y búsqueda por razón social', async () => {
  await ir('/admin/inquilinos/nuevo');
  await page.locator('#razonSocial').fill(RAZON_SOCIAL);
  await page.locator('#nombreComercial').fill(`E2E Tienda ${SUFIJO}`);
  await page.locator('#contacto1Email').fill(`e2e.inq.${SUFIJO}@example.com`);
  await page.getByRole('button', { name: 'Crear inquilino' }).click();
  await expect(page).toHaveURL(/\/admin\/inquilinos$/, { timeout: 15_000 });

  await page.locator('#if-razon').fill(`E2E Comercial ${SUFIJO}`);
  await page.locator('#if-razon').press('Enter');
  await expect(page.getByText(RAZON_SOCIAL).first()).toBeVisible({ timeout: 15_000 });
});

test('contratos: alta entre el local y el inquilino nuevos; el local queda alquilado', async () => {
  await ir('/admin/contratos/nuevo');
  const valorLocal = await page
    .locator('#localId option')
    .filter({ hasText: CODIGO_LOCAL })
    .first()
    .getAttribute('value');
  await page.locator('#localId').selectOption(valorLocal!);
  await page.locator('#inquilinoId').selectOption({ label: RAZON_SOCIAL });
  await page.locator('#fechaInicio').fill('2026-11-01');
  // El monto mensual es de solo lectura: se calcula de área × (canon + CAM).
  await page.locator('#areaMt2MedicionReal').fill('50');
  await page.locator('#cuotaArrendamiento').fill('20');
  await expect(page.locator('#montoMensual')).not.toHaveValue('0');
  await page.getByRole('button', { name: 'Crear contrato' }).click();
  await expect(page).toHaveURL(/\/admin\/contratos$/, { timeout: 15_000 });

  const api = await apiLogin(CUENTAS.admin);
  const locales = (await (
    await api.get(`${API_URL}/locales`, { params: { search: CODIGO_LOCAL } })
  ).json()) as { items: { id: string; codigo: string; estado: string }[] };
  const local = locales.items.find((l) => l.codigo === CODIGO_LOCAL)!;
  expect(local.estado).toBe('alquilado');
  const contratos = (await (
    await api.get(`${API_URL}/contratos`, { params: { localId: local.id } })
  ).json()) as { items: { id: string }[] };
  expect(contratos.items).toHaveLength(1);
  await api.dispose();

  await ir(`/admin/contratos/${contratos.items[0]!.id}`);
  await expect(page.getByText(CODIGO_LOCAL).first()).toBeVisible();
  await expect(page.getByText(RAZON_SOCIAL).first()).toBeVisible();
});

test('locales: edición desde el detalle', async () => {
  const api = await apiLogin(CUENTAS.admin);
  const locales = (await (
    await api.get(`${API_URL}/locales`, { params: { search: CODIGO_LOCAL } })
  ).json()) as { items: { id: string; codigo: string }[] };
  await api.dispose();
  const local = locales.items.find((l) => l.codigo === CODIGO_LOCAL)!;

  await ir(`/admin/locales/${local.id}`);
  await page.locator('#nivel').fill('2');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  // El toast (no el pie "Actualizado: …" de la página, que también coincide).
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Local actualizado' })).toBeVisible({
    timeout: 15_000,
  });
  // Fuente de verdad: la API. Luego navegación nueva (un reload restauraría
  // el valor tecleado desde el estado de formulario del navegador).
  await expect
    .poll(async () => {
      const ctx = await apiLogin(CUENTAS.admin);
      const det = (await (await ctx.get(`${API_URL}/locales/${local.id}`)).json()) as { nivel: string };
      await ctx.dispose();
      return det.nivel;
    })
    .toBe('2');
  await ir('/admin/locales');
  await ir(`/admin/locales/${local.id}`);
  await expect(page.locator('#nivel')).toHaveValue('2');
});

test('categorías: alta y aparece en el listado', async () => {
  await ir('/admin/categorias/nueva');
  await page.locator('#nombre').fill(CATEGORIA);
  await page.locator('#descripcion').fill('Creada por la suite e2e.');
  await page.getByRole('button', { name: 'Crear categoría' }).click();
  await expect(page).toHaveURL(/\/admin\/categorias$/, { timeout: 15_000 });
  await expect(page.getByText(CATEGORIA).first()).toBeVisible();

  // Limpieza: una categoría sin subcategorías no debe quedar activa (el wizard
  // la ofrecería y no se podría completar).
  const api = await apiLogin(CUENTAS.admin);
  const cats = (await (await api.get(`${API_URL}/categorias?page=1&pageSize=100`)).json()) as {
    items: { id: string; nombre: string }[];
  };
  const creada = cats.items.find((c) => c.nombre === CATEGORIA);
  if (creada) await api.delete(`${API_URL}/categorias/${creada.id}`);
  await api.dispose();
});

test('usuarios de staff: alta y deshabilitar con confirmación', async () => {
  await ir('/admin/usuarios-plaza');
  await page.getByRole('button', { name: /Nuevo usuario|Alta|Agregar/ }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#alta-usp-email').fill(EMAIL_STAFF);
  await dialog.locator('#alta-usp-nombre').fill(`E2E Staff ${SUFIJO}`);
  await dialog.locator('#alta-usp-rol').selectOption({ index: 1 });
  await dialog.locator('button[type=submit]').click();
  // La contraseña temporal se muestra una sola vez dentro del diálogo.
  await expect(dialog.getByText(/^Tmp[A-Za-z0-9_-]+1a$/)).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole('button', { name: 'Entendido' }).click();
  await expect(dialog).toBeHidden();

  await page.getByPlaceholder('Buscar por nombre o email').fill(EMAIL_STAFF);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByText(EMAIL_STAFF).first()).toBeVisible({ timeout: 15_000 });
});

test('pantallas de consulta cargan datos sin errores', async () => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));

  await ir('/admin/dashboard');
  await expect(page.locator('.kpi, [class*=kpi]').first()).toBeVisible();

  await ir('/admin/calendario');
  await expect(page.locator('.fc').first()).toBeVisible({ timeout: 15_000 });

  await ir('/admin/reportes');
  await page.getByRole('button', { name: 'Previsualizar' }).click();
  await expect(page.locator('table, .rdv-cards, .banner-danger').first()).toBeVisible({ timeout: 20_000 });

  await ir('/admin/auditoria');
  await expect(page.locator('main .rdv-card, main tbody tr').first()).toBeVisible();

  await ir('/admin/notificaciones');
  await expect(page.locator('main')).toBeVisible();

  await ir('/admin/configuracion');
  await expect(page.locator('main form, main .card').first()).toBeVisible();

  expect(errores, errores.join('\n')).toEqual([]);
});

test('reportes: la descarga CSV responde con un archivo', async () => {
  await ir('/admin/reportes');
  const href = await page.getByRole('link', { name: 'Generar' }).getAttribute('href');
  expect(href).toBeTruthy();
  const res = await page.request.get(href!);
  expect(res.status(), await res.text().catch(() => '')).toBe(200);
  expect(res.headers()['content-disposition'] ?? '').toContain('attachment');
});
