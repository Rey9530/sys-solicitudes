'use server';

import { getToken } from 'next-auth/jwt';
import { headers } from 'next/headers';
import { signOut } from '@/auth';

/**
 * Cierra sesión: revoca el refresh token en el backend (T-028) y limpia la
 * cookie de Auth.js. El token se lee server-side; nunca llega al cliente.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function logoutAction(): Promise<void> {
  try {
    const token = await getToken({
      req: { headers: await headers() },
      secret: process.env.AUTH_SECRET ?? '',
      secureCookie: process.env.NODE_ENV === 'production',
    });
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
  await signOut({ redirectTo: '/login' });
}
