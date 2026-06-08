import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';

/**
 * Proxy BFF de descarga del PDF "Permiso de Trabajos" de una solicitud.
 * Accesible por inquilino (su propia solicitud, el backend valida el scope),
 * admin_plaza y superadmin. Route handler porque la descarga binaria necesita
 * headers de attachment.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const rol = session?.user?.rol;
  if (rol !== 'inquilino' && rol !== 'admin_plaza' && rol !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const res = await apiFetch(`/reportes/solicitudes/${id}/permiso.pdf`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    return NextResponse.json(
      { error: err.message ?? 'No se pudo generar el permiso' },
      { status: res.status },
    );
  }
  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/pdf',
      'Content-Disposition':
        res.headers.get('Content-Disposition') ?? `attachment; filename="permiso-${id}.pdf"`,
    },
  });
}
