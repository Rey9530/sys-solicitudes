'use client';

import { useState } from 'react';

export interface TabItem {
  key: string;
  label: string;
  /** Contador opcional mostrado como chip (ej. nº de adjuntos). */
  count?: number;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  /**
   * Controlled: si se pasa, fuerza la pestaña activa y llama a `onChange`
   * cuando el usuario hace click. Útil para tabs driven por URL (`?tab=...`).
   */
  activeKey?: string;
  onChange?: (key: string) => void;
}

/** Tabs del sistema de diseño (subrayado de acento + chip de conteo). */
export function Tabs({ tabs, activeKey, onChange }: TabsProps) {
  const [internal, setInternal] = useState(tabs[0]?.key);
  const isControlled = activeKey !== undefined;
  const active = isControlled ? activeKey : internal;
  const handleClick = (key: string) => {
    if (!isControlled) setInternal(key);
    onChange?.(key);
  };
  return (
    <div>
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => handleClick(t.key)}
            className={active === t.key ? 'tab active' : 'tab'}
          >
            {t.label}
            {typeof t.count === 'number' && <span className="cnt">{t.count}</span>}
          </button>
        ))}
      </div>
      <div>{tabs.find((t) => t.key === active)?.content}</div>
    </div>
  );
}
