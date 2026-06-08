import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { auth } from '@/auth';
import { homeForRole } from '@/lib/home-redirect';
import { ThemeToggle } from '@/components/client/theme-toggle';

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="home-entry">
        <div className="home-theme">
          <ThemeToggle />
        </div>
        <div className="card card-pad home-card text-center">
          <div className="side-logo mx-auto mb-4" style={{ width: 44, height: 44, fontSize: 18 }}>
            P
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
            Plazapp
          </h1>
          <p className="muted mt-2 text-sm">
            Plataforma de gestión de solicitudes para centros comerciales.
          </p>
          <Link href="/login" className="btn btn-primary btn-lg mt-6">
            Iniciar sesión
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  // Usuario autenticado: entrar directo al sistema según rol (sin pantalla-hub intermedia).
  redirect(homeForRole(session.user.rol));
}
