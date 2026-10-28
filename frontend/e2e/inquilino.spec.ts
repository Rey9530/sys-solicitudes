import { test, expect, type Page } from '@playwright/test';
import { API_URL, CUENTAS, apiLogin, categoriaConSubcategoria, fechaPlazaMasDias } from './helpers/api';
import { esperarHidratacion, paginaAutenticada } from './helpers/ui';

/**
 * Portal del inquilino: contratos, calendario + iCal, adjuntos (subida válida
 * y rechazo de MIME no permitido), duplicar y editar un borrador.
 */
test.describe.configure({ mode: 'serial' });

let page: Page;
let borradorId = '';

// PNG de 1×1 px.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  page = await paginaAutenticada(browser, CUENTAS.inquilino);

  // Borrador sembrado por API para las pruebas de adjuntos/edición.
  const inq = await apiLogin(CUENTAS.inquilino);
  const locales = (await (await inq.get(`${API_URL}/locales?page=1&pageSize=1`)).json()) as {
    items: { id: string }[];
  };
  const { categoriaId, subcategoriaId } = await categoriaConSubcategoria(inq);
  const fecha = fechaPlazaMasDias(3);
  const res = await inq.post(`${API_URL}/solicitudes`, {
    data: {
      localId: locales.items[0]!.id,
      tipo: 'otro',
      titulo: `E2E-INQ-${Date.now()}`,
      descripcion: 'Borrador de la suite e2e del inquilino.',
      fechaEventoInicio: fecha,
      fechaEventoFin: fecha,
      horaInicio: '10:00',
      horaFin: '11:00',
      categoriaId,
      subcategoriaId,
      empresaNombre: 'E2E S.A.',
      empresaResponsable: 'Responsable E2E',
      empresaTelefono: '+503 7000 0000',
      empresaEmail: 'e2e@example.com',
      emergenciaContacto: 'Contacto E2E',
      emergenciaTelefono: '+503 7000 0001',
      esEmergencia: false,
      camposExtra: {
        asistentes_estimados: 1,
        asistentes: [{ nombre: 'Asistente E2E', documento: '00000000-0' }],
      },
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  borradorId = ((await res.json()) as { id: string }).id;
  await inq.dispose();
});
test.afterAll(async () => {
  await page?.context().close();
});

test('contratos: listado y detalle del contrato propio', async () => {
  await page.goto('/inquilino/contratos');
  const enlace = page.locator('main a[href^="/inquilino/contratos/"]').first();
  await expect(enlace).toBeVisible();
  await enlace.click();
  await expect(page).toHaveURL(/\/inquilino\/contratos\/[0-9a-f-]{36}/);
  await expect(page.locator('main').getByText(/Local|Vigencia|Inicio/).first()).toBeVisible();
});

test('calendario: se pinta y el iCal se descarga', async () => {
  await page.goto('/inquilino/calendario');
  await expect(page.locator('.fc').first()).toBeVisible({ timeout: 15_000 });
  const res = await page.request.get('/api/calendario/export.ics');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('BEGIN:VCALENDAR');
});

test('adjuntos: sube una imagen y rechaza un tipo no permitido', async () => {
  await page.goto(`/inquilino/solicitudes/${borradorId}`);
  await page.getByRole('tab', { name: /Adjuntos/ }).click();
  const input = page.locator('[role=tabpanel] input[type=file]');

  await input.setInputFiles({ name: 'foto-e2e.png', mimeType: 'image/png', buffer: PNG_1PX });
  await expect(page.getByText('foto-e2e.png').first()).toBeVisible({ timeout: 20_000 });

  await input.setInputFiles({
    name: 'script-e2e.exe',
    mimeType: 'application/x-msdownload',
    buffer: Buffer.from('MZ'),
  });
  await expect(page.getByText(/no permitido|no se permite|tipo de archivo/i).first()).toBeVisible({
    timeout: 10_000,
  });
});

test('borrador: se edita desde el wizard y conserva los cambios', async () => {
  await page.goto(`/inquilino/solicitudes/${borradorId}/editar`);
  await esperarHidratacion(page, 'main');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  const nuevo = `E2E-INQ-EDITADA-${Date.now()}`;
  await page.locator('#wz-titulo').fill(nuevo);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page).toHaveURL(new RegExp(`/inquilino/solicitudes/${borradorId}$`), { timeout: 20_000 });
  await expect(page.getByText(nuevo).first()).toBeVisible();
});

test('duplicar crea una solicitud nueva en borrador', async () => {
  await page.goto(`/inquilino/solicitudes/${borradorId}`);
  await page.getByRole('button', { name: 'Duplicar' }).click();
  await expect(page).not.toHaveURL(new RegExp(borradorId), { timeout: 20_000 });
  await expect(page).toHaveURL(/\/inquilino\/solicitudes\/[0-9a-f-]{36}$/);
  await expect(page.locator('main').getByText('Borrador', { exact: true }).first()).toBeVisible();
});

test('cancelar con motivo deja la solicitud cancelada', async () => {
  await page.goto(`/inquilino/solicitudes/${borradorId}`);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const popup = page.locator('.swal2-popup');
  await popup.locator('textarea').fill('Ya no es necesaria (e2e).');
  await popup.getByRole('button', { name: 'Sí, cancelar' }).click();
  await expect(page.locator('main').getByText('Cancelada', { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
});
