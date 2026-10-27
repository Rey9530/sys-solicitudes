import fs from 'node:fs';
import path from 'node:path';
import { API_URL, CUENTAS, apiLogin } from './api';

/**
 * Catálogo de pantallas por rol para las suites de rutas y responsive.
 * Las rutas dinámicas se resuelven con IDs reales (primer registro de cada
 * listado) vía API y se cachean 10 min para no gastar logins (5 req/min).
 */
export type Rol = 'admin' | 'inquilino' | 'superadmin';

export interface Pantalla {
  ruta: string;
  /** Nombre corto para reportes y capturas. */
  nombre: string;
}

const CACHE_FILE = path.join(process.cwd(), 'test-results', '.e2e-rutas.json');
const TTL_MS = 10 * 60_000;

interface Ids {
  solicitudAdmin: Record<string, string>;
  solicitudInquilino: Record<string, string>;
  borradorInquilino: string | null;
  contrato: string | null;
  contratoInquilino: string | null;
  inquilino: string | null;
  local: string | null;
  categoria: string | null;
  tipoSolicitud: string | null;
  usuarioPlaza: string | null;
  solicitudSuperadmin: string | null;
}

interface Pagina<T> {
  items: T[];
  total: number;
}

async function primero<T extends { id: string }>(
  ctx: Awaited<ReturnType<typeof apiLogin>>,
  ruta: string,
): Promise<T | null> {
  const res = await ctx.get(`${API_URL}/${ruta}`);
  if (!res.ok()) return null;
  const body = (await res.json()) as Pagina<T> | T[];
  const items = Array.isArray(body) ? body : body.items;
  return items[0] ?? null;
}

/** Un ID de solicitud por estado (para cubrir las variantes del detalle). */
async function solicitudesPorEstado(
  ctx: Awaited<ReturnType<typeof apiLogin>>,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const estados = [
    'borrador',
    'enviada',
    'asignado',
    'en_revision',
    'requerida_subsanacion',
    'aprobada',
    'rechazada',
    'cerrada',
    'cancelada',
  ];
  for (const estado of estados) {
    const s = await primero<{ id: string }>(ctx, `solicitudes?page=1&pageSize=1&estado=${estado}`);
    if (s) out[estado] = s.id;
  }
  return out;
}

async function resolverIds(): Promise<Ids> {
  try {
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as Ids & { at: number };
    if (Date.now() - cache.at < TTL_MS) return cache;
  } catch {
    /* sin caché */
  }
  const adm = await apiLogin(CUENTAS.admin);
  const inq = await apiLogin(CUENTAS.inquilino);
  const sa = await apiLogin(CUENTAS.superadmin);
  try {
    const solicitudInquilino = await solicitudesPorEstado(inq);
    const ids: Ids = {
      solicitudAdmin: await solicitudesPorEstado(adm),
      solicitudInquilino,
      borradorInquilino: solicitudInquilino.borrador ?? null,
      contrato: (await primero(adm, 'contratos?page=1&pageSize=1'))?.id ?? null,
      contratoInquilino: (await primero(inq, 'contratos?page=1&pageSize=1'))?.id ?? null,
      inquilino: (await primero(adm, 'inquilinos?page=1&pageSize=1'))?.id ?? null,
      local: (await primero(adm, 'locales?page=1&pageSize=1'))?.id ?? null,
      categoria: (await primero(adm, 'categorias?page=1&pageSize=1'))?.id ?? null,
      tipoSolicitud: (await primero(adm, 'admin/tipos-solicitud'))?.id ?? null,
      usuarioPlaza: (await primero(adm, 'usuarios?page=1&pageSize=1'))?.id ?? null,
      solicitudSuperadmin: (await primero(sa, 'admin/solicitudes?page=1&pageSize=1'))?.id ?? null,
    };
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ ...ids, at: Date.now() }));
    return ids;
  } finally {
    await Promise.all([adm.dispose(), inq.dispose(), sa.dispose()]);
  }
}

export const PANTALLAS_PUBLICAS: Pantalla[] = [
  { ruta: '/login', nombre: 'login' },
  { ruta: '/reset-password', nombre: 'reset-solicitar' },
  { ruta: '/reset-password/token-invalido-e2e', nombre: 'reset-confirmar' },
];

export async function pantallasPorRol(): Promise<Record<Rol, Pantalla[]>> {
  const ids = await resolverIds();
  const conId = (base: string, id: string | null, nombre: string): Pantalla[] =>
    id ? [{ ruta: base.replace(':id', id), nombre }] : [];

  const admin: Pantalla[] = [
    { ruta: '/admin/dashboard', nombre: 'dashboard' },
    { ruta: '/admin/solicitudes', nombre: 'solicitudes' },
    ...Object.entries(ids.solicitudAdmin).map(([estado, id]) => ({
      ruta: `/admin/solicitudes/${id}`,
      nombre: `solicitud-${estado}`,
    })),
    { ruta: '/admin/calendario', nombre: 'calendario' },
    { ruta: '/admin/locales', nombre: 'locales' },
    { ruta: '/admin/locales/nuevo', nombre: 'local-nuevo' },
    ...conId('/admin/locales/:id', ids.local, 'local-detalle'),
    { ruta: '/admin/inquilinos', nombre: 'inquilinos' },
    { ruta: '/admin/inquilinos/nuevo', nombre: 'inquilino-nuevo' },
    ...conId('/admin/inquilinos/:id', ids.inquilino, 'inquilino-detalle'),
    { ruta: '/admin/contratos', nombre: 'contratos' },
    { ruta: '/admin/contratos/nuevo', nombre: 'contrato-nuevo' },
    { ruta: '/admin/contratos/importar', nombre: 'contratos-importar' },
    ...conId('/admin/contratos/:id', ids.contrato, 'contrato-detalle'),
    { ruta: '/admin/categorias', nombre: 'categorias' },
    { ruta: '/admin/categorias/nueva', nombre: 'categoria-nueva' },
    ...conId('/admin/categorias/:id', ids.categoria, 'categoria-detalle'),
    ...conId('/admin/categorias/:id/subcategorias', ids.categoria, 'subcategorias'),
    { ruta: '/admin/catalogos/tipos-solicitud', nombre: 'tipos-solicitud' },
    ...conId('/admin/catalogos/tipos-solicitud/:id', ids.tipoSolicitud, 'tipo-solicitud-detalle'),
    { ruta: '/admin/usuarios-plaza', nombre: 'usuarios-plaza' },
    { ruta: '/admin/usuarios-plaza/permisos', nombre: 'permisos' },
    ...conId('/admin/usuarios-plaza/:id', ids.usuarioPlaza, 'usuario-plaza-detalle'),
    { ruta: '/admin/reportes', nombre: 'reportes' },
    { ruta: '/admin/notificaciones', nombre: 'notificaciones' },
    { ruta: '/admin/auditoria', nombre: 'auditoria' },
    { ruta: '/admin/configuracion', nombre: 'configuracion' },
  ];

  const inquilino: Pantalla[] = [
    { ruta: '/inquilino/solicitudes', nombre: 'solicitudes' },
    { ruta: '/inquilino/solicitudes/nueva', nombre: 'solicitud-nueva' },
    ...Object.entries(ids.solicitudInquilino).map(([estado, id]) => ({
      ruta: `/inquilino/solicitudes/${id}`,
      nombre: `solicitud-${estado}`,
    })),
    ...conId('/inquilino/solicitudes/:id/editar', ids.borradorInquilino, 'solicitud-editar'),
    { ruta: '/inquilino/contratos', nombre: 'contratos' },
    ...conId('/inquilino/contratos/:id', ids.contratoInquilino, 'contrato-detalle'),
    { ruta: '/inquilino/calendario', nombre: 'calendario' },
  ];

  const superadmin: Pantalla[] = [
    { ruta: '/superadmin/plazas', nombre: 'plazas' },
    { ruta: '/superadmin/dashboard', nombre: 'dashboard' },
    { ruta: '/superadmin/solicitudes', nombre: 'solicitudes' },
    ...conId('/superadmin/solicitudes/:id', ids.solicitudSuperadmin, 'solicitud-detalle'),
  ];

  return { admin, inquilino, superadmin };
}
