'use client';

import { useState } from 'react';

/** Tabs ligeras para las pantallas de detalle (T-057/T-059/T-060). */
export function Tabs({
  tabs,
}: {
  tabs: Array<{ key: string; label: string; content: React.ReactNode }>;
}) {
  const [active, setActive] = useState(tabs[0]?.key);
  return (
    <div>
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              active === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-4">{tabs.find((t) => t.key === active)?.content}</div>
    </div>
  );
}
