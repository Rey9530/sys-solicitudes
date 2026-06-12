import { auth } from '@/auth';
import { NextResponse } from 'next/server';

/**
 * Middleware de Next.js (T-033). Protege las rutas privadas: si no hay sesión,
 * redirige a /login. Las rutas públicas (login, reset-password) y los assets se
 * excluyen vía `matcher`.
 *
 * T-V01: no hay resolución de tenant por host/slug ni header `x-plaza-slug`;
 * el `plaza_id` viaja dentro del JWT. El middleware solo verifica la sesión.
 */
const PUBLIC_PATHS = ['/login', '/reset-password'];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === '/' || PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) {
    return NextResponse.next();
  }

  if (!req.auth || !req.auth.user?.id) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    if (!req.auth?.user?.id) loginUrl.searchParams.set('expired', '1');
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Excluye assets estáticos, imágenes y las rutas internas de Auth.js.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
