import { defineConfig, devices } from '@playwright/test';

/**
 * Suite e2e opcional (Playwright). Asume el stack local levantado:
 * frontend en :3000 y backend en :4000 (docker-compose + npm run dev).
 * No arranca servidores por sí misma (misma filosofía que la verificación
 * manual de docs/02-stack-tecnologico.md §2.11).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    timezoneId: 'America/El_Salvador',
    locale: 'es-SV',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
