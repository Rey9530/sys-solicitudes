import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

const ENTIDADES = new Set(['solicitudes', 'locales', 'inquilinos']);
const FORMATOS = new Set(['csv', 'xlsx', 'pdf']);

/**
 * T-144: proxy BFF de descarga de reportes (`?entidad=&formato=&...filtros`).
 * Route handler porque la descarga binaria necesita headers de attachment.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const rol = session?.user?.rol;
  if (rol !== 'admin_plaza' && rol !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const params = new URLSearchParams(req.nextUrl.searchParams);
  const entidad = params.get('entidad') ?? '';
  const formato = params.get('formato') ?? '';
  params.delete('entidad');
  params.delete('formato');
  if (!ENTIDADES.has(entidad) || !FORMATOS.has(formato)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  const qs = params.toString();
  const res = await apiFetch(`/reportes/${entidad}/export.${formato}${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    return NextResponse.json(
      { error: err.message ?? 'No se pudo generar el reporte' },
      { status: res.status },
    );
  }
  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/octet-stream',
      'Content-Disposition':
        res.headers.get('Content-Disposition') ?? `attachment; filename="reporte.${formato}"`,
    },
  });
}
