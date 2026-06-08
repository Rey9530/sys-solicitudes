import type { Metadata } from 'next';
import type { EmailLogOutput, UnsubscribeOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { NotificacionesFiltros } from '@/components/client/notificaciones-filtros';
import { NotificacionesTable } from '@/components/client/notificaciones-table';
import { UnsubscribesList } from '@/components/client/unsubscribes-list';
import { PageHeader } from '@/components/ui/page-header';
import { Pager } from '@/components/ui/pager';

export const metadata: Metadata = { title: 'Notificaciones' };

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

/** Log de emails + desuscripciones (T-127, CU-NE-6). */
export default async function AdminNotificacionesPage({
  searchParams,
}: {
  searchParams: Promise<{
    estado?: string;
    plantilla?: string;
    destinatario?: string;
    fechaDesde?: string;
    fechaHasta?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ page: sp.page ?? '1', pageSize: '20' });
  if (sp.estado) qs.set('estado', sp.estado);
  if (sp.plantilla) qs.set('plantilla', sp.plantilla);
  if (sp.destinatario) qs.set('destinatario', sp.destinatario);
  if (sp.fechaDesde) qs.set('fechaDesde', sp.fechaDesde);
  if (sp.fechaHasta) qs.set('fechaHasta', sp.fechaHasta);

  const [res, unsubRes] = await Promise.all([
    apiFetch(`/notificaciones?${qs.toString()}`),
    apiFetch('/notificaciones/unsubscribes?page=1&pageSize=50'),
  ]);
  const data: Paginated<EmailLogOutput> = res.ok
    ? ((await res.json()) as Paginated<EmailLogOutput>)
    : { items: [], total: 0, page: 1, totalPages: 0 };
  const unsubscribes = unsubRes.ok
    ? ((await unsubRes.json()) as Paginated<UnsubscribeOutput>).items
    : [];

  const hrefFor = (page: number) =>
    `/admin/notificaciones?${new URLSearchParams({ ...sp, page: String(page) }).toString()}`;

  return (
    <div className="page wide">
      <PageHeader
        title="Notificaciones"
        subtitle={`${data.total} emails en el log. Los fallidos se pueden reintentar manualmente.`}
      />
      <div className="mb-4">
        <NotificacionesFiltros
          estado={sp.estado}
          plantilla={sp.plantilla}
          destinatario={sp.destinatario}
          fechaDesde={sp.fechaDesde}
          fechaHasta={sp.fechaHasta}
        />
      </div>
      <NotificacionesTable emails={data.items} />
      <div className="mt-4">
        <Pager page={data.page} totalPages={data.totalPages} hrefFor={hrefFor} />
      </div>
      <section className="mt-8 space-y-2">
        <h2 className="text-[15px] font-semibold">Desuscripciones</h2>
        <p className="muted text-sm">
          Direcciones que pidieron no recibir un tipo de email. Resetear vuelve a habilitarlo.
        </p>
        <UnsubscribesList unsubscribes={unsubscribes} />
      </section>
    </div>
  );
}
