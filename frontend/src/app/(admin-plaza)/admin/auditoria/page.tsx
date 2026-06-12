import type { Metadata } from 'next';
import type { AuditoriaOutput } from '@app/contracts';
import { ListAuditoriaQuerySchema } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { AuditoriaFiltros } from '@/components/client/auditoria-filtros';
import { AuditoriaTabla } from '@/components/client/auditoria-tabla';
import { PageHeader } from '@/components/ui/page-header';
import { Pager } from '@/components/ui/pager';

export const metadata: Metadata = { title: 'Auditoría' };

interface PaginatedAuditoria {
  items: AuditoriaOutput[];
  total: number;
  page: number;
  totalPages: number;
}

type SearchParams = Record<string, string | undefined>;

export default async function AdminAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  // T-161: validamos los searchParams contra el Zod del backend. Si llegan
  // datos inválidos (p. ej. fecha mal formada), caemos a defaults en lugar
  // de 500 al construir el querystring.
  const parsed = ListAuditoriaQuerySchema.safeParse({
    page: sp.page ?? '1',
    pageSize: sp.pageSize ?? '20',
    ...(sp.accion ? { accion: sp.accion } : {}),
    ...(sp.entidadTipo ? { entidadTipo: sp.entidadTipo } : {}),
    ...(sp.entidadId ? { entidadId: sp.entidadId } : {}),
    ...(sp.usuarioId ? { usuarioId: sp.usuarioId } : {}),
    ...(sp.fechaDesde ? { fechaDesde: sp.fechaDesde } : {}),
    ...(sp.fechaHasta ? { fechaHasta: sp.fechaHasta } : {}),
  });
  const query = parsed.success ? parsed.data : { page: 1, pageSize: 20 };

  const qs = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.accion) qs.set('accion', query.accion);
  if (query.entidadTipo) qs.set('entidadTipo', query.entidadTipo);
  if (query.entidadId) qs.set('entidadId', query.entidadId);
  if (query.usuarioId) qs.set('usuarioId', query.usuarioId);
  if (query.fechaDesde) qs.set('fechaDesde', query.fechaDesde);
  if (query.fechaHasta) qs.set('fechaHasta', query.fechaHasta);

  const res = await apiFetch(`/auditoria?${qs.toString()}`);
  const data: PaginatedAuditoria = res.ok
    ? ((await res.json()) as PaginatedAuditoria)
    : { items: [], total: 0, page: 1, totalPages: 0 };

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v) params.set(k, v);
    }
    params.set('page', String(page));
    return `/admin/auditoria?${params.toString()}`;
  };

  return (
    <div className="page wide">
      <PageHeader
        title="Auditoría"
        subtitle={`${data.total} eventos · quién hizo qué y cuándo en la plaza.`}
      />
      <div className="mb-4">
        <AuditoriaFiltros
          accion={sp.accion}
          entidadTipo={sp.entidadTipo}
          fechaDesde={sp.fechaDesde}
          fechaHasta={sp.fechaHasta}
        />
      </div>
      <AuditoriaTabla items={data.items} />
      <div className="mt-4">
        <Pager page={data.page} totalPages={data.totalPages} hrefFor={hrefFor} />
      </div>
    </div>
  );
}
