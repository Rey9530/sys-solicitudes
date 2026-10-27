import { test, expect } from '@playwright/test';
import { API_URL, CUENTAS, apiLogin } from './helpers/api';
import { paginaAutenticada } from './helpers/ui';

/**
 * Accesos: rutas públicas, protección de rutas privadas, separación por rol
 * en el frontend y aislamiento multi-tenant + permisos en la API.
 *
 * El intento de login fallido usa un correo inexistente para no sumar
 * intentos al bloqueo (10) de una cuenta real.
 */

test.describe('público', () => {
  test('sin sesión, una ruta privada redirige a /login con callbackUrl', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin%2Fdashboard/);
    await expect(page.locator('#email')).toBeVisible();
  });

  test('la raíz sin sesión lleva al login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login: valida formato y muestra error con credenciales inválidas', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('no-es-correo');
    await page.locator('#password').fill('x');
    await page.locator('button[type=submit]').click();
    await expect(page.locator('.err').first()).toBeVisible();

    await page.locator('#email').fill('no-existe-e2e@demo.com');
    await page.locator('#password').fill('ClaveIncorrecta123!');
    await page.locator('button[type=submit]').click();
    // 30 s: en `next dev` el primer uso de la acción de login la compila. Con el
    // límite de 5 logins/min el web muestra "Cuenta bloqueada…" (trata todo 429 igual).
    await expect(
      page.getByText(/incorrectos|No se pudo iniciar sesión|demasiados|bloqueada/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('reset: la solicitud responde igual exista o no el correo', async ({ page }) => {
    await page.goto('/reset-password');
    await page.locator('input[type=email]').fill('no-existe-e2e@demo.com');
    await page.locator('button[type=submit]').click();
    await expect(page.locator('.banner-ok')).toBeVisible({ timeout: 15_000 });
  });

  test('reset: un token inválido muestra el aviso y no cambia nada', async ({ page }) => {
    await page.goto('/reset-password/token-invalido-e2e');
    await page.locator('input[type=password]').nth(0).fill('NuevaClave2026!x');
    await page.locator('input[type=password]').nth(1).fill('NuevaClave2026!x');
    await page.locator('button[type=submit]').click();
    await expect(page.getByText(/inválid|expir/i).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('separación por rol (frontend)', () => {
  test('el inquilino no entra al panel de admin ni al de superadmin', async ({ browser }) => {
    const page = await paginaAutenticada(browser, CUENTAS.inquilino);
    for (const ruta of ['/admin/dashboard', '/admin/usuarios-plaza', '/superadmin/plazas']) {
      await page.goto(ruta);
      await expect(page, ruta).toHaveURL(/\/inquilino\/solicitudes/);
    }
    await page.context().close();
  });

  test('el admin de plaza no entra al portal de inquilino ni al superadmin', async ({ browser }) => {
    const page = await paginaAutenticada(browser, CUENTAS.admin);
    for (const ruta of ['/inquilino/solicitudes', '/superadmin/plazas']) {
      await page.goto(ruta);
      await expect(page, ruta).toHaveURL(/\/admin\/dashboard/);
    }
    await page.context().close();
  });
});

test.describe('API: multi-tenant y permisos', () => {
  test('un admin de otra plaza no ve ni modifica solicitudes de demo', async () => {
    const demo = await apiLogin(CUENTAS.admin);
    const lista = (await (await demo.get(`${API_URL}/solicitudes?page=1&pageSize=5`)).json()) as {
      items: { id: string }[];
    };
    await demo.dispose();
    const ajena = lista.items[0];
    test.skip(!ajena, 'demo no tiene solicitudes');

    const otra = await apiLogin(CUENTAS.adminOtraPlaza);
    const det = await otra.get(`${API_URL}/solicitudes/${ajena!.id}`);
    expect([403, 404]).toContain(det.status());
    const tomar = await otra.post(`${API_URL}/solicitudes/${ajena!.id}/tomar`, { data: {} });
    expect([403, 404]).toContain(tomar.status());
    const propias = (await (await otra.get(`${API_URL}/solicitudes?page=1&pageSize=100`)).json()) as {
      items: { id: string }[];
    };
    expect(propias.items.map((s) => s.id)).not.toContain(ajena!.id);
    await otra.dispose();
  });

  test('el inquilino no accede a endpoints de administración', async () => {
    const inq = await apiLogin(CUENTAS.inquilino);
    for (const ruta of ['usuarios', 'auditoria', 'configuracion', 'admin/solicitudes', 'plazas']) {
      const res = await inq.get(`${API_URL}/${ruta}`);
      expect([401, 403], `${ruta} → ${res.status()}`).toContain(res.status());
    }
    await inq.dispose();
  });

  test('el inquilino solo ve solicitudes de su propio inquilino', async () => {
    const inq = await apiLogin(CUENTAS.inquilino);
    const res = await inq.get(`${API_URL}/solicitudes?page=1&pageSize=100`);
    const body = (await res.json()) as { items: { inquilinoId: string }[] };
    const ids = new Set(body.items.map((s) => s.inquilinoId));
    expect(ids.size).toBeLessThanOrEqual(1);
    await inq.dispose();
  });

  test('sin token la API responde 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/solicitudes`);
    expect(res.status()).toBe(401);
  });
});
