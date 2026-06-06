import Link from 'next/link';
import type { PlazaOutput } from '@app/contracts';
import { auth } from '@/auth';
import { apiFetch } from '@/lib/api';
import { logoutAction } from './logout-action';

interface MeResponse {
  email: string;
  nombre: string;
  rol: string;
  plazaId: string | null;
}

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-4xl font-bold text-primary">Plazapp</h1>
          <p className="mt-4 text-lg text-gray-600">
            Plataforma de gestión de solicitudes para centros comerciales
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  // Perfil vía BFF (/auth/me).
  let me: MeResponse | null = null;
  const meRes = await apiFetch('/auth/me');
  if (meRes.ok) me = (await meRes.json()) as MeResponse;

  // Branding por plaza (T-042): admin_plaza ve el color/logo de su plaza.
  // T-V01: la plaza se resuelve por el JWT (no por slug en la URL).
  let plaza: PlazaOutput | null = null;
  if (session.user.rol === 'admin_plaza' && session.user.plazaId) {
    const plazaRes = await apiFetch(`/plazas/${session.user.plazaId}`);
    if (plazaRes.ok) plaza = (await plazaRes.json()) as PlazaOutput;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      {/* Inyección del color primario de la plaza (branding dinámico). */}
      {plaza && (
        <style>{`:root{--color-primary:${plaza.colorPrimario};}`}</style>
      )}
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        {plaza?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={plaza.logoUrl} alt={plaza.nombreComercial} className="mx-auto mb-3 h-12 object-contain" />
        ) : null}
        <h1 className="text-2xl font-bold text-primary">
          {plaza?.nombreComercial ?? 'Plazapp'}
        </h1>
        <p className="mt-4 text-gray-700">
          Hola, <span className="font-semibold">{me?.nombre ?? session.user.name}</span>
        </p>
        <p className="mt-1 text-sm text-gray-500">{me?.email ?? session.user.email}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">
          Rol: {me?.rol ?? session.user.rol}
        </p>

        {session.user.rol === 'superadmin' && (
          <Link
            href="/superadmin/plazas"
            className="mt-6 inline-block rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Administrar plazas
          </Link>
        )}

        <form action={logoutAction} className="mt-6">
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
