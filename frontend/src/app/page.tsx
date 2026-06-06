import Link from 'next/link';
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

  // Demostración del BFF: el perfil se obtiene server-side vía apiFetch (/auth/me).
  let me: MeResponse | null = null;
  const res = await apiFetch('/auth/me');
  if (res.ok) {
    me = (await res.json()) as MeResponse;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-primary">Plazapp</h1>
        <p className="mt-4 text-gray-700">
          Hola, <span className="font-semibold">{me?.nombre ?? session.user.name}</span>
        </p>
        <p className="mt-1 text-sm text-gray-500">{me?.email ?? session.user.email}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">
          Rol: {me?.rol ?? session.user.rol}
        </p>

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
