import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Browser } from '@playwright/test';
import { CUENTAS } from './helpers/api';
import { VIEWPORTS, auditarLayout, esperarEstable, type Hallazgo } from './helpers/layout';
import { PANTALLAS_PUBLICAS, pantallasPorRol, type Pantalla, type Rol } from './helpers/rutas';
import { paginaAutenticada } from './helpers/ui';

/**
 * Barrido responsive (teléfono, tablet, PC) de TODAS las pantallas por rol.
 * Para cada pantalla × ancho: carga la ruta en un contexto con el viewport y
 * el modo táctil del dispositivo, mide el layout real (helpers/layout.ts) y
 * guarda una captura de página completa en e2e-capturas/responsive/ para
 * revisión visual. Falla si hay scroll horizontal, elementos cortados por el
 * borde o texto desbordado; los objetivos táctiles < 24 px solo se reportan.
 *
 * Ejecutar: `npx playwright test e2e/responsive.spec.ts` (stack local arriba).
 * Tema oscuro: `E2E_TEMA=dark npx playwright test e2e/responsive.spec.ts`
 * (las capturas van a e2e-capturas/responsive-dark/).
 */
const TEMA = process.env.E2E_TEMA === 'dark' ? 'dark' : 'light';
// Fuera de test-results/: Playwright vacía esa carpeta al empezar cada corrida.
const OUT_DIR = path.join(process.cwd(), 'e2e-capturas', TEMA === 'dark' ? 'responsive-dark' : 'responsive');
const BLOQUEANTES: Hallazgo['tipo'][] = ['scroll-horizontal', 'fuera-de-pantalla', 'texto-desbordado'];

const CUENTA_POR_ROL = {
  admin: CUENTAS.admin,
  inquilino: CUENTAS.inquilino,
  superadmin: CUENTAS.superadmin,
} as const;

const STATE_DIR = path.join(process.cwd(), 'test-results');
const stateFile = (email: string) =>
  path.join(STATE_DIR, `.e2e-state-${email.replace(/[^a-z0-9]/gi, '_')}.json`);

async function barrer(
  browser: Browser,
  rol: Rol | 'publico',
  pantallas: Pantalla[],
  vp: (typeof VIEWPORTS)[number],
) {
  let storageState: string | undefined;
  if (rol !== 'publico') {
    const cuenta = CUENTA_POR_ROL[rol];
    // Garantiza la sesión cacheada (login UI con caché de 10 min).
    const p = await paginaAutenticada(browser, cuenta);
    await p.context().close();
    storageState = stateFile(cuenta.email);
  }
  const tactil = vp.tipo !== 'pc';
  const context = await browser.newContext({
    storageState,
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.tipo === 'telefono',
    hasTouch: tactil,
  });
  // El tema se fija antes del primer paint (mismo mecanismo que el toggle: localStorage).
  await context.addInitScript((tema) => {
    try {
      localStorage.setItem('theme', tema);
    } catch {
      /* sin almacenamiento */
    }
  }, TEMA);
  const page = await context.newPage();
  const resultados: { pantalla: string; ruta: string; hallazgos: Hallazgo[] }[] = [];
  const dir = path.join(OUT_DIR, rol, vp.nombre);
  fs.mkdirSync(dir, { recursive: true });

  for (const p of pantallas) {
    const res = await page.goto(p.ruta, { waitUntil: 'domcontentloaded' });
    expect.soft(res?.status() ?? 0, `${p.ruta} respondió ${res?.status()}`).toBeLessThan(400);
    if (rol !== 'publico') {
      expect.soft(page.url(), `${p.ruta} redirigió a login`).not.toMatch(/\/login/);
    }
    await esperarEstable(page);
    const hallazgos = await auditarLayout(page, tactil && vp.width < 900);
    resultados.push({ pantalla: p.nombre, ruta: p.ruta, hallazgos });
    await page.screenshot({ path: path.join(dir, `${p.nombre}.png`), fullPage: true });
  }
  await context.close();

  fs.writeFileSync(path.join(dir, 'reporte.json'), JSON.stringify(resultados, null, 2));
  for (const r of resultados) {
    const bloqueantes = r.hallazgos.filter((h) => BLOQUEANTES.includes(h.tipo));
    expect
      .soft(bloqueantes, `${rol} ${vp.nombre} ${r.ruta}\n${JSON.stringify(bloqueantes, null, 2)}`)
      .toEqual([]);
  }
}

let pantallas: Awaited<ReturnType<typeof pantallasPorRol>>;
test.beforeAll(async () => {
  test.setTimeout(240_000);
  pantallas = await pantallasPorRol();
});

for (const vp of VIEWPORTS) {
  test(`publico @ ${vp.nombre}`, async ({ browser }) => {
    await barrer(browser, 'publico', PANTALLAS_PUBLICAS, vp);
  });
  for (const rol of ['admin', 'inquilino', 'superadmin'] as const) {
    test(`${rol} @ ${vp.nombre}`, async ({ browser }) => {
      test.setTimeout(15 * 60_000);
      await barrer(browser, rol, pantallas[rol], vp);
    });
  }
}
