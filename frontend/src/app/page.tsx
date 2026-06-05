import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold text-primary">Plazapp</h1>
        <p className="mt-4 text-lg text-gray-600">
          Plataforma de gestión de solicitudes para centros comerciales
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Tareas de setup base en construcción. Ver{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            login
          </Link>{' '}
          (pendiente, T-034 en <code>PLANIFICACION/02-autenticacion-usuarios.md</code>).
        </p>
        <div className="mt-8 text-xs text-gray-400">
          <p>
            Ver <code className="rounded bg-gray-100 px-1">PLANIFICACION/00-INDICE.md</code> para el estado de las tareas.
          </p>
        </div>
      </div>
    </main>
  );
}
