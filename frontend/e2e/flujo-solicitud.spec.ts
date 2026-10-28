import { test, expect, type Page } from '@playwright/test';
import { API_URL, CUENTAS, apiLogin, fechaPlazaMasDias } from './helpers/api';
import { esperarHidratacion, paginaAutenticada } from './helpers/ui';

/**
 * Ciclo de vida completo de una solicitud por la UI (dos sesiones: inquilino
 * y admin de la misma plaza), tal como lo usa el cliente:
 *
 *   wizard → borrador → enviar → (admin) tomar → pedir subsanación
 *   → (inquilino) reenviar → (admin) tomar → aprobar → cerrar
 *
 * Verifica en cada paso el estado mostrado y, al final, el historial, los
 * comentarios cruzados y el PDF del permiso. Los datos creados llevan el
 * prefijo `E2E-FLUJO-` para identificarlos.
 */
test.describe.configure({ mode: 'serial' });

const TITULO = `E2E-FLUJO-${Date.now()}`;
let solicitudId = '';
let inq: Page;
let adm: Page;

/** Estado visible en el panel lateral de la solicitud. */
async function esperarEstado(page: Page, etiqueta: string) {
  await expect(page.locator('.side-panel')).toBeVisible();
  await expect(page.locator('main').getByText(etiqueta, { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
}

async function abrir(page: Page, ruta: string) {
  await page.goto(ruta);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await esperarHidratacion(page, 'main');
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  inq = await paginaAutenticada(browser, CUENTAS.inquilino);
  adm = await paginaAutenticada(browser, CUENTAS.admin);
});

test.afterAll(async () => {
  await inq?.context().close();
  await adm?.context().close();
});

test('inquilino: el wizard valida cada paso y guarda un borrador', async () => {
  await abrir(inq, '/inquilino/solicitudes/nueva');

  // Paso 1 sin categoría → no avanza.
  await inq.getByRole('button', { name: 'Siguiente' }).click();
  await expect(inq.locator('#wz-categoria')).toBeVisible();

  await inq.locator('#wz-tipo').selectOption('mantenimiento');
  // Única categoría seed con subcategoría activa en la plaza demo.
  await inq.locator('#wz-categoria').selectOption({ label: 'Eventos' });
  await inq.locator('#wz-subcategoria').selectOption({ index: 1 });
  await inq.getByRole('button', { name: 'Siguiente' }).click();

  // Paso 2.
  await expect(inq.locator('#wz-local')).toBeVisible();
  await inq.locator('#wz-local').selectOption({ index: 1 });
  await inq.locator('#wz-titulo').fill(TITULO);
  await inq.locator('#wz-descripcion').fill('Fuga de agua en el baño del local. Creada por la suite e2e.');
  await inq.locator('#empresa-nombre').fill('Fontanería E2E S.A.');
  await inq.locator('#empresa-responsable').fill('Responsable E2E');
  await inq.locator('#empresa-telefono').fill('+503 7000 0000');
  await inq.locator('#empresa-email').fill('e2e@example.com');
  await inq.locator('#emergencia-contacto').fill('Contacto E2E');
  await inq.locator('#emergencia-telefono').fill('+503 7000 0001');
  const fecha = fechaPlazaMasDias(3);
  await inq.locator('#wz-fecha-inicio').fill(fecha);
  await inq.locator('#wz-fecha-fin').fill(fecha);
  await inq.locator('#wz-hora-inicio').fill('09:00');
  await inq.locator('#wz-hora-fin').fill('12:00');
  await inq.locator('#wz-area-afectada').fill('Baño del local');
  // Asistentes: obligatorio en todos los tipos (mínimo 1, T-V22).
  await inq.locator('#asistentes-estimados').fill('1');
  await inq.locator('#asistente-0-nombre').fill('Técnico E2E');
  await inq.locator('#asistente-0-documento').fill('00000000-0');
  await inq.getByRole('button', { name: 'Siguiente' }).click();

  // Paso 3: resumen + guardar borrador.
  await expect(inq.getByText(TITULO).first()).toBeVisible();
  await inq.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(inq).toHaveURL(/\/inquilino\/solicitudes\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  solicitudId = inq.url().split('/').pop()!;
  await esperarEstado(inq, 'Borrador');
});

test('inquilino: cancelar el diálogo de cancelación NO cancela la solicitud (regresión prompt)', async () => {
  await inq.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const popup = inq.locator('.swal2-popup');
  await expect(popup).toBeVisible();
  await popup.getByRole('button', { name: 'Volver' }).click();
  await expect(popup).toBeHidden();
  await inq.reload();
  await esperarEstado(inq, 'Borrador');
});

test('inquilino: envía el borrador', async () => {
  await inq.getByRole('button', { name: 'Enviar', exact: true }).click();
  await esperarEstado(inq, 'Enviada');
});

test('admin: toma la solicitud y pide subsanación (comentario obligatorio)', async () => {
  await abrir(adm, `/admin/solicitudes/${solicitudId}`);
  await esperarEstado(adm, 'Enviada');
  await adm.getByRole('button', { name: 'Tomar', exact: true }).click();
  await esperarEstado(adm, 'En revisión');

  await adm.getByRole('button', { name: 'Pedir subsanación' }).click();
  const dialog = adm.getByRole('dialog');
  const confirmar = dialog.getByRole('button', { name: 'Pedir subsanación' });
  await expect(confirmar).toBeDisabled();
  await dialog.getByRole('textbox').fill('Adjunta una foto del daño, por favor.');
  await confirmar.click();
  await esperarEstado(adm, 'Requiere subsanación');
});

test('inquilino: ve el comentario y reenvía subsanada', async () => {
  await abrir(inq, `/inquilino/solicitudes/${solicitudId}`);
  await esperarEstado(inq, 'Requiere subsanación');
  await expect(inq.getByText('Adjunta una foto del daño, por favor.').first()).toBeVisible();
  await inq.getByRole('button', { name: 'Reenviar subsanada' }).click();
  await esperarEstado(inq, 'Enviada');
});

test('admin: toma, comenta, aprueba y cierra', async () => {
  await abrir(adm, `/admin/solicitudes/${solicitudId}`);
  await adm.getByRole('button', { name: 'Tomar', exact: true }).click();
  await esperarEstado(adm, 'En revisión');

  await adm.getByRole('tab', { name: /Comentarios/ }).click();
  await adm.getByPlaceholder('Comentario para el inquilino…').fill('Revisado, todo en orden.');
  await adm.getByRole('button', { name: 'Comentar', exact: true }).click();
  await expect(adm.getByText('Revisado, todo en orden.').first()).toBeVisible({ timeout: 15_000 });

  await adm.getByRole('button', { name: 'Aprobar', exact: true }).click();
  await adm.getByRole('dialog').getByRole('button', { name: 'Aprobar solicitud' }).click();
  await esperarEstado(adm, 'Aprobada');

  await adm.getByRole('button', { name: 'Cerrar solicitud' }).click();
  const dialog = adm.getByRole('dialog');
  await dialog.locator('select').selectOption('exitoso');
  await dialog.locator('textarea').fill('Trabajo terminado y verificado.');
  await dialog.getByRole('button', { name: /Cerrar solicitud/ }).click();
  await esperarEstado(adm, 'Cerrada');
});

test('historial registra cada transición y el PDF del permiso se descarga', async () => {
  await abrir(adm, `/admin/solicitudes/${solicitudId}`);
  await adm.getByRole('tab', { name: /Historial/ }).click();
  const panel = adm.getByRole('tabpanel');
  for (const etiqueta of ['Enviada', 'En revisión', 'Requiere subsanación', 'Aprobada', 'Cerrada']) {
    await expect(panel.getByText(etiqueta).first()).toBeVisible();
  }

  const res = await inq.request.get(`/api/solicitudes/${solicitudId}/permiso-pdf`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/pdf');
  expect((await res.body()).subarray(0, 4).toString()).toBe('%PDF');
});

test('API: el estado final es cerrada y el inquilino lo ve igual', async () => {
  const ctx = await apiLogin(CUENTAS.inquilino);
  const res = await ctx.get(`${API_URL}/solicitudes/${solicitudId}`);
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { estado: string; titulo: string };
  expect(body.estado).toBe('cerrada');
  expect(body.titulo).toBe(TITULO);
  await ctx.dispose();
});
