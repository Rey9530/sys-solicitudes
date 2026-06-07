import type { Metadata } from 'next';
import Link from 'next/link';
import type { EmailLogOutput, UnsubscribeOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { NotificacionesFiltros } from '@/components/client/notificaciones-filtros';
import { NotificacionesTable } from '@/components/client/notificaciones-table';
import { UnsubscribesList } from '@/components/client/unsubscribes-list';

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
        <p className="text-sm text-gray-500">
          {data.total} emails en el log. Los fallidos se pueden reintentar manualmente.
        </p>
      </div>
      <NotificacionesFiltros
        estado={sp.estado}
        plantilla={sp.plantilla}
        destinatario={sp.destinatario}
        fechaDesde={sp.fechaDesde}
        fechaHasta={sp.fechaHasta}
      />
      <NotificacionesTable emails={data.items} />
      {data.totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/notificaciones?${new URLSearchParams({ ...sp, page: String(p) }).toString()}`}
              className={`rounded px-3 py-1 ${p === data.page ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Desuscripciones</h2>
        <p className="text-sm text-gray-500">
          Direcciones que pidieron no recibir un tipo de email. Resetear vuelve a habilitarlo.
        </p>
        <UnsubscribesList unsubscribes={unsubscribes} />
      </section>
    </div>
  );
}
