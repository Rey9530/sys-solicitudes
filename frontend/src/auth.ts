import NextAuth, { CredentialsSignin, type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { RolGlobal } from '@app/contracts';

/**
 * Configuración de Auth.js (NextAuth v5) · T-032.
 *
 * Credentials Provider que consume `POST /api/v1/auth/login` del backend NestJS.
 * El JWT del backend (access + refresh) se guarda en el token de NextAuth (cookie
 * httpOnly cifrada con AUTH_SECRET), NUNCA se expone al JavaScript del cliente
 * (S-ARQ-F). La sesión solo expone datos de `user`, no los tokens.
 *
 * Renovación: el callback `jwt` refresca el access token contra
 * `POST /api/v1/auth/refresh` cuando está por expirar (rotación, T-027).
 *
 * T-RBAC-1: persistimos `permisos: string[]` desde el `TokenResponse.user.permisos`
 * del backend y lo exponemos en `session.user.permisos` para que el frontend
 * pueda gating fino (helpers `can()`, `<Can>`, `assertCan()`).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Error específico para cuenta bloqueada (lockout 10/15, T-V13). */
class AccountLockedError extends CredentialsSignin {
  override code = 'locked';
}

interface BackendLoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    nombre: string;
    rol: RolGlobal;
    plazaId: string | null;
    rolStaffId: string | null;
    inquilinoId: string | null;
    /** T-RBAC-1: permisos efectivos del usuario (wildcard `['*']` para superadmin). */
    permisos: string[];
  };
}

async function refreshAccessToken(refreshToken: string): Promise<BackendLoginResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as BackendLoginResponse;
  } catch {
    return null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? '');
        const password = String(credentials?.password ?? '');
        if (!email || !password) return null;

        const res = await fetch(`${API_URL}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          cache: 'no-store',
        });

        if (res.status === 429) {
          // Cuenta bloqueada por lockout.
          throw new AccountLockedError();
        }
        if (!res.ok) {
          // Credenciales inválidas u otro error → null = CredentialsSignin genérico.
          return null;
        }

        const data = (await res.json()) as BackendLoginResponse;
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.nombre,
          rol: data.user.rol,
          plazaId: data.user.plazaId,
          rolStaffId: data.user.rolStaffId,
          inquilinoId: data.user.inquilinoId,
          permisos: data.user.permisos,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresIn: data.expiresIn,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Login inicial: persistimos tokens y metadatos en el JWT de NextAuth.
      if (user) {
        if (!user.accessToken || !user.refreshToken || !user.expiresIn) {
          return { ...token, error: 'RefreshTokenError' };
        }
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpires = Date.now() + user.expiresIn * 1000;
        token.rol = user.rol;
        token.plazaId = user.plazaId;
        token.rolStaffId = user.rolStaffId;
        token.inquilinoId = user.inquilinoId;
        token.permisos = user.permisos ?? [];
        return token;
      }

      // Token aún válido (margen de 60s): se reutiliza.
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires - 60_000) {
        return token;
      }

      // Access expirado → rotar contra el backend.
      const refreshed = token.refreshToken
        ? await refreshAccessToken(token.refreshToken)
        : null;
      if (!refreshed) {
        // Refresh falló (token revocado/expirado). Devolvemos un token sin
        // datos de usuario para que la sesión quede como "no autenticada" y
        // los layouts (`!session?.user`) redirijan a /login. El cookie se
        // reescribe con este contenido en la próxima respuesta.
        return {
          sub: undefined,
          email: undefined,
          name: undefined,
          rol: undefined,
          plazaId: null,
          rolStaffId: null,
          inquilinoId: null,
          permisos: [],
          accessToken: undefined,
          refreshToken: undefined,
          accessTokenExpires: 0,
          error: 'RefreshTokenError',
        };
      }
      token.accessToken = refreshed.accessToken;
      token.refreshToken = refreshed.refreshToken;
      token.accessTokenExpires = Date.now() + refreshed.expiresIn * 1000;
      // Actualizar permisos en refresh (pueden haber cambiado desde el último login).
      token.permisos = refreshed.user.permisos ?? [];
      token.rol = refreshed.user.rol;
      token.plazaId = refreshed.user.plazaId;
      token.rolStaffId = refreshed.user.rolStaffId;
      token.inquilinoId = refreshed.user.inquilinoId;
      token.error = undefined;
      return token;
    },
    session({ session, token }) {
      // Solo exponemos datos de usuario; NUNCA los tokens del backend.
      session.user.id = token.sub ?? '';
      session.user.rol = token.rol;
      session.user.plazaId = token.plazaId;
      session.user.rolStaffId = token.rolStaffId;
      session.user.inquilinoId = token.inquilinoId;
      session.user.permisos = token.permisos ?? [];
      session.error = token.error;
      return session;
    },
  },
});

declare module 'next-auth' {
  interface User {
    rol?: RolGlobal;
    plazaId?: string | null;
    rolStaffId?: string | null;
    inquilinoId?: string | null;
    /** T-RBAC-1: permisos efectivos al momento del login. */
    permisos?: string[];
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  }
  interface Session {
    user: {
      id: string;
      rol?: RolGlobal;
      plazaId?: string | null;
      rolStaffId?: string | null;
      inquilinoId?: string | null;
      /** T-RBAC-1: permisos efectivos (pueden quedar desactualizados respecto al backend hasta el próximo refresh; el JWT del backend es la fuente de verdad). */
      permisos?: string[];
    } & DefaultSession['user'];
    error?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    rol?: RolGlobal;
    plazaId?: string | null;
    rolStaffId?: string | null;
    inquilinoId?: string | null;
    /** T-RBAC-1: array de códigos de permiso efectivos. */
    permisos?: string[];
    error?: string;
  }
}