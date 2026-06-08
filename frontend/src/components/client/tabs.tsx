'use client';

import { useState } from 'react';

export interface TabItem {
  key: string;
  label: string;
  /** Contador opcional mostrado como chip (ej. nº de adjuntos). */
  count?: number;
  content: React.ReactNode;
}

/** Tabs del sistema de diseño (subrayado de acento + chip de conteo). */
export function Tabs({ tabs }: { tabs: TabItem[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  return (
    <div>
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
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
