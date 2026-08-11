import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { homeForRole } from '@/lib/home-redirect';

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Usuario autenticado: entrar directo al sistema según rol (sin pantalla-hub intermedia).
  redirect(homeForRole(session.user.rol));
}
