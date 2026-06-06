import 'server-only';
import { decode } from 'next-auth/jwt';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * BFF ligero (T-033, S-ARQ-E/F). Helper server-only para llamar al backend
 * NestJS inyectando el `Authorization: Bearer <accessToken>` desde el JWT de
 * NextAuth (cookie httpOnly). El token NUNCA se expone al cliente.
 *
 * T-V01: no se inyecta `x-plaza-slug`; el `plaza_id` viaja dentro del JWT.
 *
 * Si el backend responde 401, intenta refrescar una vez contra
 * `POST /api/v1/auth/refresh` y reintenta; si falla, redirige a /login.
 *
 * ⚠️ Limitación conocida (v1): el token rotado por este reintento no se
 * re-persiste en la cookie de NextAuth (eso lo hace el callback `jwt` en la
 * siguiente navegación). Con access TTL de 1h el camino de 401 es excepcional.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface AuthTokens {
  accessToken?: string;
  refreshToken?: string;
}

async function readTokens(): Promise<AuthTokens> {
  // Lee y descifra directamente la cookie de sesión de Auth.js (JWE) server-side.
  // El JWT del backend (access/refresh) vive dentro; nunca se expone al cliente.
  const secure = process.env.NODE_ENV === 'production';
  const cookieName = secure ? '__Secure-authjs.session-token' : 'authjs.session-token';
  const raw = (await cookies()).get(cookieName)?.value;
  if (!raw) return {};
  try {
    const token = await decode({
      token: raw,
      secret: process.env.AUTH_SECRET ?? '',
      salt: cookieName,
    });
    return {
      accessToken: token?.accessToken,
      refreshToken: token?.refreshToken,
    };
  } catch {
    return {};
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { accessToken, refreshToken } = await readTokens();
  const url = `${API_URL}/api/v1${path.startsWith('/') ? path : `/${path}`}`;

  // T-062: con FormData NO se fija Content-Type — fetch agrega el boundary
  // multipart correcto; forzar application/json rompería la subida.
  const isFormData = init.body instanceof FormData;
  const doFetch = (bearer: string | undefined): Promise<Response> =>
    fetch(url, {
      ...init,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...init.headers,
      },
      cache: 'no-store',
    });

  let res = await doFetch(accessToken);

  if (res.status === 401 && refreshToken) {
    const refreshRes = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (!refreshRes.ok) {
      redirect('/login');
    }
    const data = (await refreshRes.json()) as { accessToken: string };
    res = await doFetch(data.accessToken);
  }

  return res;
}
