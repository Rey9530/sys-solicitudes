'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { UnsubscribeOutput } from '@app/contracts';
import { Button } from '@/components/ui/button';
import { resetUnsubscribeAction } from '@/app/(admin-plaza)/admin/notificaciones/actions';

/** Desuscripciones de la plaza con reseteo manual (T-125/T-127). */
export function UnsubscribesList({ unsubscribes }: { unsubscribes: UnsubscribeOutput[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (unsubscribes.length === 0) {
    return <p className="text-sm text-gray-500">No hay desuscripciones registradas.</p>;
  }

  const reset = (id: string) =>
    startTransition(async () => {
      setError(null);
      const res = await resetUnsubscribeAction(id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="divide-y rounded-lg border bg-white">
        {unsubscribes.map((u) => (
          <li key={u.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <span>
              <span className="font-medium">{u.email}</span>{' '}
              <span className="text-gray-500">· {u.plantilla}</span>{' '}
              <span className="text-xs text-gray-400">({u.createdAt.slice(0, 10)})</span>
            </span>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => reset(u.id)}>
              Resetear
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
