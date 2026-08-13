import type { Metadata } from 'next';
import { RefreshCw } from 'lucide-react';
import {
  ListSolicitudesPlataformaQuerySchema,
  type ListSolicitudesPlataformaQuery,
  type PaginatedSolicitudesPlataforma,
  type SolicitudPlataformaListItem,
} from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { SolicitudesTable } from '@/components/client/solicitudes-table';
import { AutoRefresh } from '@/components/client/auto-refresh';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Pager } from '@/components/ui/pager';
import { SOLICITUD_ESTADO_LABEL, SOLICITUD_ESTADO_OPCIONES } from '@/components/estado-badge';
import { ExportarCsvButton } from './_components/exportar-csv-button';

export const metadata: Metadata = { title: 'Solicitudes globales' };

interface SearchParams {
  estado?: string;
  tipo?: string;
  prioridad?: string;
  plazaId?: string;
  categoriaId?: string;
  subcategoriaId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  search?: string;
  page?: string;
}

/** Convierte strings de URLSearchParams a los tipos del schema Zod.
 *  Descarta silenciosamente valores inválidos (defensa contra URL maliciosa). */
function parseFiltros(sp: SearchParams): ListSolicitudesPlataformaQuery {
  const candidate = {
    page: sp.page ? Number(sp.page) : 1,
    pageSize: 20,
    ...(sp.estado && { estado: sp.estado }),
    ...(sp.tipo && { tipo: sp.tipo }),
    ...(sp.prioridad && { prioridad: sp.prioridad }),
    ...(sp.plazaId && { plazaId: sp.plazaId }),
    ...(sp.categoriaId && { categoriaId: sp.categoriaId }),
    ...(sp.subcategoriaId && { subcategoriaId: sp.subcategoriaId }),
    ...(sp.fechaDesde && { fechaDesde: sp.fechaDesde }),
    ...(sp.fechaHasta && { fechaHasta: sp.fechaHasta }),
    ...(sp.search && { search: sp.search }),
  };
  const parsed = ListSolicitudesPlataformaQuerySchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  // Fallback mínimo: solo paginación. El resto ya fue validado server-side
  // por el backend (ZodValidationPipe), pero los enums aquí ayudan a TS.
  return { page: 1, pageSize: 20 };
}

/**
 * T-V25 · Bandeja cross-plaza para el `superadmin` (solo lectura, SC-5).
 *
 * El endpoint `/admin/solicitudes` usa `PrismaAdminService` (bypass RLS) y
 * está restringido por `@Roles('superadmin')` en el backend. La vista replica
 * los filtros del listado `admin_plaza` + añade `plazaId` y `search` libre,
 * y permite exportar el resultado a CSV.
 */
export default async function SuperadminSolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const qs = new URLSearchParams({ page: sp.page ?? '1', pageSize: '20' });
  for (const k of [
    'estado',
    'tipo',
    'prioridad',
    'plazaId',
    'categoriaId',
    'subcategoriaId',
    'fechaDesde',
    'fechaHasta',
    'search',
  ] as const) {
    if (sp[k]) qs.set(k, sp[k] as string);
  }

  // Carga paralela: solicitudes (paginadas) + catálogo ligero de plazas
  // para el dropdown de filtro. Las plazas ya vienen en el shell del layout
  // pero las volvemos a pedir porque Server Components no comparten estado.
  const [solicitudesRes, plazasRes] = await Promise.all([
    apiFetch(`/admin/solicitudes?${qs.toString()}`),
    apiFetch('/plazas?page=1&pageSize=100'),
  ]);

  const data: PaginatedSolicitudesPlataforma = solicitudesRes.ok
    ? ((await solicitudesRes.json()) as PaginatedSolicitudesPlataforma)
    : { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };

  type PlazaLite = { id: string; nombreComercial: string };
  const plazas: PlazaLite[] = plazasRes.ok
    ? ((await plazasRes.json()) as { items: PlazaLite[] }).items
    : [];

  // Narrow los searchParams (strings) a los enums/tipos del schema compartido.
  // Si el usuario manipuló la URL, `parseSeguro` lo descarta silenciosamente
  // (la fila simplemente sale vacía, sin 500).
  const filtrosParaCsv: ListSolicitudesPlataformaQuery = parseFiltros(sp);

  const hrefFor = (page: number) =>
    `/superadmin/solicitudes?${new URLSearchParams({ ...sp, page: String(page) }).toString()}`;

  return (
    <div className="page wide">
      {/* Auto-refresh: 2 min — vista cross-plaza pesada si hay muchas plazas. */}
      <AutoRefresh intervalMs={2 * 60_000} />

      <PageHeader
        title="Solicitudes globales"
        subtitle={`${data.total} resultados en todas las plazas · solo lectura · sin acciones de workflow.`}
        actions={
          <>
            <span className="badge b-neutral">
              <RefreshCw className="h-3 w-3" />
              2 min
            </span>
            <ExportarCsvButton filtros={filtrosParaCsv} />
          </>
        }
      />

      <Card className="mb-4">
        <form className="filters" action="/superadmin/solicitudes">
          <div className="field">
            <label htmlFor="f-search">Buscar</label>
            <input
              id="f-search"
              name="search"
              type="search"
              defaultValue={sp.search ?? ''}
              placeholder="Código, título o local"
              className="input"
              maxLength={100}
            />
          </div>
          <div className="field">
            <label htmlFor="f-estado">Estado</label>
            <select id="f-estado" name="estado" defaultValue={sp.estado ?? ''} className="select">
              <option value="">Todos los estados</option>
              {SOLICITUD_ESTADO_OPCIONES.map((e) => (
                <option key={e} value={e}>
                  {SOLICITUD_ESTADO_LABEL[e]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-tipo">Tipo</label>
            <select id="f-tipo" name="tipo" defaultValue={sp.tipo ?? ''} className="select">
              <option value="">Todos</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="evento">Evento</option>
              <option value="remodelacion">Remodelación</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-prioridad">Prioridad</label>
            <select
              id="f-prioridad"
              name="prioridad"
              defaultValue={sp.prioridad ?? ''}
              className="select"
            >
              <option value="">Toda</option>
              {['A', 'B', 'C', 'D', 'F'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-plazaId">Plaza</label>
            <select
              id="f-plazaId"
              name="plazaId"
              defaultValue={sp.plazaId ?? ''}
              className="select"
            >
              <option value="">Todas las plazas</option>
              {plazas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombreComercial}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-fechaDesde">Desde</label>
            <input
              id="f-fechaDesde"
              name="fechaDesde"
              type="date"
              defaultValue={sp.fechaDesde ?? ''}
              className="input"
            />
          </div>
          <div className="field">
            <label htmlFor="f-fechaHasta">Hasta</label>
            <input
              id="f-fechaHasta"
              name="fechaHasta"
              type="date"
              defaultValue={sp.fechaHasta ?? ''}
              className="input"
            />
          </div>
          <button type="submit" className="btn btn-secondary btn-sm">
            Filtrar
          </button>
        </form>
      </Card>

      <SolicitudesTable<SolicitudPlataformaListItem>
        solicitudes={data.items}
        baseHref="/superadmin/solicitudes"
        showSla
        showAsignado
        showPlaza
      />

      <div className="mt-4">
        <Pager page={data.page} totalPages={data.totalPages} hrefFor={hrefFor} />
      </div>
    </div>
  );
}
