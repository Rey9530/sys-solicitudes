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
    return <p className="muted text-sm">No hay desuscripciones registradas.</p>;
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
      {error && <div className="banner banner-danger">{error}</div>}
      <div className="card">
        {unsubscribes.map((u) => (
          <div key={u.id} className="list-row" style={{ padding: '10px 16px' }}>
            <span className="flex-1 text-sm">
              <span className="font-medium">{u.email}</span>{' '}
              <span className="muted">· {u.plantilla}</span>{' '}
              <span className="tl-time">({u.createdAt.slice(0, 10)})</span>
            </span>
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => reset(u.id)}>
              Resetear
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
