'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Refresco periódico del Server Component padre (T-106). Mantiene el BFF:
 * `router.refresh()` re-ejecuta el fetch server-side (cookie httpOnly),
 * sin exponer el API al cliente.
 */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
