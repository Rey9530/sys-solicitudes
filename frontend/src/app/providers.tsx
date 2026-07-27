'use client';

import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';

/**
 * Wrapper client-side para proveedores globales. Por ahora solo expone el
 * `SessionProvider` de next-auth/react, requisito obligatorio para que los
 * Client Components que llaman `useSession()` (e.g. `<Can permiso="...">`
 * en `components/client/can.tsx`) funcionen sin lanzar
 * "`useSession` must be wrapped in a <SessionProvider />".
 *
 * `refetchOnWindowFocus={false}` evita refetchs agresivos en una SPA de
 * back-office (el JWT dura 1h y el refresh lo gestiona el callback `jwt`
 * de `auth.ts`).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>
  );
}