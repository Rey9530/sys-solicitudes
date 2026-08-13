import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  SolicitudDetailOutputSchema,
  type PlazaRef,
  type SolicitudDetailOutput,
} from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { PageHeader } from '@/components/ui/page-header';
import {
  SolicitudEstadoBadge,
  PrioridadBadge,
  SlaSemaforo,
  SOLICITUD_ESTADO_LABEL,
} from '@/components/estado-badge';
import { Card } from '@/components/ui/card';
import { formatDateInPlazaTz } from '@/lib/datetime';

export const metadata: Metadata = { title: 'Detalle de solicitud (plataforma)' };

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * T-V25 · Detalle cross-plaza de una solicitud (solo lectura, SC-5).
 *
 * Reutiliza el shape de `SolicitudDetailOutput` y le añade `plaza: PlazaRef`
 * (que viene del endpoint `/admin/solicitudes/:id`). No expone acciones de
 * workflow: el superadmin no opera negocio.
 *
 * Es deliberadamente más simple que `SolicitudDetailAdmin` (panel admin):
 * sin tabs de comentarios/historial interactivos, sin diálogos de acción, sin
 * adjuntos descargables. Para inspección rápida cross-plaza es suficiente.
 */
export default async function SuperadminSolicitudDetallePage({ params }: PageProps) {
  const { id } = await params;

  const res = await apiFetch(`/admin/solicitudes/${id}`);
  if (res.status === 404) notFound();
  if (!res.ok) {
    return (
      <div className="page wide">
        <div className="banner banner-danger">
          No se pudo cargar la solicitud (HTTP {res.status}).
        </div>
      </div>
    );
  }
  const data = (await res.json()) as SolicitudDetailOutput & { plaza: PlazaRef };

  // Validación defensiva: confirma shape mínimo (no rompe la página si el
  // backend cambia un campo no crítico).
  const parse = SolicitudDetailOutputSchema.safeParse(data);
  if (!parse.success) {
    return (
      <div className="page wide">
        <div className="banner banner-danger">
          La respuesta del backend no tiene el formato esperado.
        </div>
      </div>
    );
  }
  const s = parse.data;
  const plaza = data.plaza;

  return (
    <div className="page wide">
      <PageHeader
        title={
          <>
            <span className="mono">{s.codigo}</span>
            <SolicitudEstadoBadge estado={s.estado} />
            <PrioridadBadge prioridad={s.prioridad} />
            <SlaSemaforo status={s.slaStatus} />
          </>
        }
        subtitle={
          <>
            {s.titulo} · Local {s.localCodigo ?? '—'} · {s.inquilinoRazonSocial ?? '—'}
          </>
        }
        breadcrumb={[
          { label: 'Solicitudes globales', href: '/superadmin/solicitudes' },
          { label: s.codigo },
        ]}
      />

      <div className="banner banner-info mb-4">
        <b>Vista de plataforma (superadmin):</b> solo lectura. Para operar esta
        solicitud, impersone la plaza <code>{plaza.nombreComercial || plaza.id}</code>{' '}
        desde el selector del topbar.
      </div>

      <Card className="card-pad mb-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Identificación
        </h3>
        <dl className="dl c2">
          <div>
            <div className="dt">Estado</div>
            <div className="dd">{SOLICITUD_ESTADO_LABEL[s.estado]}</div>
          </div>
          <div>
            <div className="dt">Plaza</div>
            <div className="dd">
              <span className="mono">{plaza.slug || '—'}</span> · {plaza.nombreComercial || '—'}
            </div>
          </div>
          <div>
            <div className="dt">Categoría / Subcategoría</div>
            <div className="dd">
              {s.categoriaNombre ?? '—'} / {s.subcategoriaNombre ?? '—'}
            </div>
          </div>
          <div>
            <div className="dt">Admin asignado</div>
            <div className="dd">{s.adminAsignado?.nombre ?? '—'}</div>
          </div>
          <div>
            <div className="dt">Enviada</div>
            <div className="dd">{s.enviadaAt ? formatDateInPlazaTz(s.enviadaAt) : '—'}</div>
          </div>
          <div>
            <div className="dt">Decisión</div>
            <div className="dd">{s.decisionAt ? formatDateInPlazaTz(s.decisionAt) : '—'}</div>
          </div>
          <div className="full">
            <div className="dt">Fechas del permiso</div>
            <div className="dd">
              {s.fechaEventoInicio} → {s.fechaEventoFin ?? '—'}
              {s.horaInicio ? ` (${s.horaInicio}–${s.horaFin})` : ''}
            </div>
          </div>
        </dl>
      </Card>

      <Card className="card-pad mb-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Descripción
        </h3>
        <p className="whitespace-pre-wrap" style={{ color: 'var(--text-2)' }}>
          {s.descripcion}
        </p>
      </Card>

      <Card className="card-pad mb-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Empresa ejecutante
        </h3>
        <dl className="dl c2">
          <div>
            <div className="dt">Empresa</div>
            <div className="dd">{s.empresaNombre || '—'}</div>
          </div>
          <div>
            <div className="dt">Responsable</div>
            <div className="dd">{s.empresaResponsable || '—'}</div>
          </div>
          <div>
            <div className="dt">Tel. empresa</div>
            <div className="dd">{s.empresaTelefono || '—'}</div>
          </div>
          <div>
            <div className="dt">Email empresa</div>
            <div className="dd">{s.empresaEmail || '—'}</div>
          </div>
        </dl>
      </Card>
    </div>
  );
}
