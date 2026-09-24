import fs from 'node:fs';
import path from 'node:path';
import { request, type APIRequestContext } from '@playwright/test';

/** Cuentas seed de desarrollo (backend/prisma/seed.ts). */
export const CUENTAS = {
  inquilino: { email: 'inquilino@demo.com', password: 'Plazapp2026!' },
  admin: { email: 'admin@demo.com', password: 'Plazapp2026!' },
} as const;

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * Login contra la API con caché de tokens en disco. El backend limita
 * `POST /auth/login` a 5 req/min por IP (CLAUDE.md §Seguridad); la suite hace
 * varios logins (API + UI) y un reinicio de worker repetiría el `beforeAll`,
 * así que el access token (15 min) se reutiliza mientras siga vigente.
 */
const CACHE_FILE = path.join(process.cwd(), 'test-results', '.e2e-tokens.json');
const TOKEN_TTL_MS = 10 * 60_000; // margen frente a los 15 min del access token

function leerCache(): Record<string, { token: string; exp: number }> {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as Record<
      string,
      { token: string; exp: number }
    >;
  } catch {
    return {};
  }
}

function guardarCache(cache: Record<string, { token: string; exp: number }>) {
  fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
}

async function obtenerToken(cuenta: { email: string; password: string }): Promise<string> {
  const cache = leerCache();
  const hit = cache[cuenta.email];
  if (hit && hit.exp > Date.now()) return hit.token;

  const ctx = await request.newContext();
  try {
    for (let intento = 0; intento < 2; intento++) {
      const res = await ctx.post(`${API_URL}/auth/login`, { data: cuenta });
      if (res.status() === 429 && intento === 0) {
        const espera = Number(res.headers()['retry-after'] ?? 60) * 1000;
        console.warn(`login ${cuenta.email} throttled; esperando ${espera / 1000}s`);
        await new Promise((r) => setTimeout(r, espera + 500));
        continue;
      }
      if (!res.ok()) {
        throw new Error(`login ${cuenta.email} → ${res.status()} ${await res.text()}`);
      }
      const { accessToken } = (await res.json()) as { accessToken: string };
      cache[cuenta.email] = { token: accessToken, exp: Date.now() + TOKEN_TTL_MS };
      guardarCache(cache);
      return accessToken;
    }
    throw new Error(`login ${cuenta.email}: sin respuesta válida`);
  } finally {
    await ctx.dispose();
  }
}

export async function apiLogin(cuenta: { email: string; password: string }) {
  const accessToken = await obtenerToken(cuenta);
  return request.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
  });
}

async function json<T>(res: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  if (!res.ok()) throw new Error(`${res.url()} → ${res.status()} ${await res.text()}`);
  return (await res.json()) as T;
}

/** Fecha civil YYYY-MM-DD en hora de El Salvador, `dias` días adelante. */
export function fechaPlazaMasDias(dias: number): string {
  const ahora = new Date(Date.now() + dias * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

export interface EventoSembrado {
  solicitudId: string;
  titulo: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
}

/**
 * Crea una solicitud de tipo `evento` como inquilino, la envía, y la aprueba
 * como admin (tomar desde `enviada` → aprobar). Reproduce el flujo real que
 * inserta la fila en `evento_calendario`.
 */
export async function crearYAprobarEvento(
  fecha: string,
  horaInicio: string,
  horaFin: string,
): Promise<EventoSembrado> {
  // Reutilizar el evento sembrado hace < 10 min (un worker reiniciado tras un
  // fallo vuelve a ejecutar `beforeAll`; evita sembrar N veces por corrida).
  const seedFile = path.join(process.cwd(), 'test-results', '.e2e-cal-seed.json');
  try {
    const prev = JSON.parse(fs.readFileSync(seedFile, 'utf8')) as EventoSembrado & { at: number };
    if (prev.fecha === fecha && prev.horaInicio === horaInicio && Date.now() - prev.at < 10 * 60_000) {
      return prev;
    }
  } catch {
    /* sin caché */
  }
  const sembrado = await sembrarEvento(fecha, horaInicio, horaFin);
  fs.mkdirSync(path.dirname(seedFile), { recursive: true });
  fs.writeFileSync(seedFile, JSON.stringify({ ...sembrado, at: Date.now() }));
  return sembrado;
}

async function sembrarEvento(
  fecha: string,
  horaInicio: string,
  horaFin: string,
): Promise<EventoSembrado> {
  const inq = await apiLogin(CUENTAS.inquilino);
  const locales = await json<{ items: { id: string }[] }>(
    await inq.get(`${API_URL}/locales`, { params: { page: 1, pageSize: 1 } }),
  );
  const categorias = await json<{ items: { id: string; nombre: string }[] }>(
    await inq.get(`${API_URL}/categorias`, { params: { page: 1, pageSize: 50 } }),
  );
  const categoria =
    categorias.items.find((c) => /evento/i.test(c.nombre)) ?? categorias.items[0];
  if (!locales.items[0] || !categoria) throw new Error('Faltan datos seed (local/categoría)');
  const subcats = await json<{ items: { id: string; activo: boolean }[] }>(
    await inq.get(`${API_URL}/categorias/${categoria.id}/subcategorias`),
  );
  const sub = subcats.items.find((s) => s.activo) ?? subcats.items[0];
  if (!sub) throw new Error('La categoría no tiene subcategorías');

  const titulo = `E2E-CAL-${Date.now()}`;
  const creada = await json<{ id: string }>(
    await inq.post(`${API_URL}/solicitudes`, {
      data: {
        localId: locales.items[0].id,
        tipo: 'evento',
        titulo,
        descripcion: 'Solicitud creada por la suite e2e del calendario.',
        fechaEventoInicio: fecha,
        fechaEventoFin: fecha,
        horaInicio,
        horaFin,
        categoriaId: categoria.id,
        subcategoriaId: sub.id,
        empresaNombre: 'E2E Eventos S.A.',
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
    }),
  );
  await json(await inq.post(`${API_URL}/solicitudes/${creada.id}/enviar`, { data: {} }));
  await inq.dispose();

  const adm = await apiLogin(CUENTAS.admin);
  await json(await adm.post(`${API_URL}/solicitudes/${creada.id}/tomar`, { data: {} }));
  await json(
    await adm.post(`${API_URL}/solicitudes/${creada.id}/aprobar`, {
      data: { comentario: 'Aprobada por la suite e2e.' },
    }),
  );
  await adm.dispose();

  return { solicitudId: creada.id, titulo, fecha, horaInicio, horaFin };
}

export interface FeedItem {
  id: string;
  title: string;
  start: string;
  end: string | null;
  extendedProps: { tipo: string; solicitudId?: string };
}

/** Feed del calendario vía API directa (mismo endpoint que usa el BFF). */
export async function feedCalendario(
  cuenta: { email: string; password: string },
  from: string,
  to: string,
): Promise<FeedItem[]> {
  const ctx = await apiLogin(cuenta);
  const items = await json<FeedItem[]>(await ctx.get(`${API_URL}/calendario`, { params: { from, to } }));
  await ctx.dispose();
  return items;
}
