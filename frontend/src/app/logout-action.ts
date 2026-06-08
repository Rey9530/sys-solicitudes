'use server';

import { decode } from 'next-auth/jwt';
import { cookies } from 'next/headers';
import { signOut } from '@/auth';

/**
 * Cierra sesión: revoca el refresh token en el backend (T-028) y limpia la
 * cookie de Auth.js. El token se lee server-side; nunca llega al cliente.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function logoutAction(): Promise<void> {
  try {
    const secure = process.env.NODE_ENV === 'production';
    const cookieName = secure ? '__Secure-authjs.session-token' : 'authjs.session-token';
    const raw = (await cookies()).get(cookieName)?.value;
    const token = raw
      ? await decode({ token: raw, secret: process.env.AUTH_SECRET ?? '', salt: cookieName })
      : null;
    if (token?.refreshToken && token.accessToken) {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.accessToken}`,
        },
        body: JSON.stringify({ refreshToken: token.refreshToken }),
        cache: 'no-store',
      });
    }
  } catch {
    // Aunque falle la revocación remota, cerramos la sesión local igualmente.
  }
  // Limpia la plaza seleccionada por un superadmin (no arrastrar entre sesiones).
  (await cookies()).delete('sa_plaza');
  await signOut({ redirectTo: '/login' });
}
