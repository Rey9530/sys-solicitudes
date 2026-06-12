'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, type TabItem } from '@/components/client/tabs';

interface UsuariosPlazaTabsProps {
  tabs: TabItem[];
  /** Nombre del query param que lleva la pestaña activa (default: 'tab'). */
  param?: string;
}

/**
 * Wrapper de `Tabs` que sincroniza la pestaña activa con el query param de la
 * URL (default `?tab=...`). Permite que el back/forward y los links
 * compartidos preserven la pestaña actual.
 */
export function UsuariosPlazaTabs({ tabs, param = 'tab' }: UsuariosPlazaTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeKey = searchParams.get(param) ?? tabs[0]?.key ?? 'usuarios';

  const onChange = useCallback(
    (key: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set(param, key);
      // Reset paginación al cambiar de tab para no mostrar paginación residual
      next.delete('page');
      router.push(`?${next.toString()}`, { scroll: false });
    },
    [router, searchParams, param],
  );

  return <Tabs tabs={tabs} activeKey={activeKey} onChange={onChange} />;
}
