import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

/**
 * T-130/T-133: proxy BFF de descarga del iCal. Route handler (no server
 * action) porque la descarga necesita headers de attachment; el JWT sigue
 * sin tocar el cliente (apiFetch lo inyecta server-side).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const qs = req.nextUrl.searchParams.toString();
  const res = await apiFetch(`/calendario/export.ics${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    return NextResponse.json({ error: 'No se pudo generar el iCal' }, { status: res.status });
  }
  const contenido = await res.text();
  return new NextResponse(contenido, {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'text/calendar; charset=utf-8',
      'Content-Disposition':
        res.headers.get('Content-Disposition') ?? 'attachment; filename="plazapp.ics"',
    },
  });
}
