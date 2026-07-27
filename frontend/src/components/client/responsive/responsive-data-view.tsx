'use client';

/**
 * Vista responsive de datos: en móvil muestra tarjetas por registro; desde
 * 768 px (`md`) muestra la tabla accesible.
 *
 * Implementación: usamos un estado cliente con `matchMedia` para decidir qué
 * vista renderizar. Esto evita el hydration mismatch: el servidor siempre
 * renderiza la vista de TARJETAS (mobile-first), y tras la hidratación en
 * cliente, si el viewport es >=768 px cambiamos a la vista de TABLA.
 *
 * Trade-off: en SSR la tabla no está en el DOM, pero como todo es client-side
 * ('use client'), el "primer paint" muestra siempre las cards. Luego cambia a
 * tabla en <1 frame. Eso evita duplicar el DOM y previene el bug donde el
 * media query CSS no oculta correctamente las cards (que era el problema
 * observado en desktop: cards y tabla visibles a la vez).
 */
import * as React from 'react';
import { useEffect, useState } from 'react';

export interface ResponsiveColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  cardLabel?: React.ReactNode;
  primary?: boolean;
  hideOnCard?: boolean;
  className?: string;
  actions?: (row: T) => React.ReactNode;
}

export interface ResponsiveDataViewProps<T> {
  rows: readonly T[];
  columns: readonly ResponsiveColumn<T>[];
  rowKey: (row: T) => string;
  emptyState?: React.ReactNode;
  cardsDisabled?: boolean;
}

const TABLET_QUERY = '(min-width: 768px)';

export function ResponsiveDataView<T>({
  rows,
  columns,
  rowKey,
  emptyState,
  cardsDisabled = false,
}: ResponsiveDataViewProps<T>) {
  // SSR-safe: empieza como `false` (cards). Tras mount, leemos matchMedia.
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(TABLET_QUERY);
    const update = () => setIsDesktop(mql.matches);
    update();
    // Soporte Safari < 14
    if (mql.addEventListener) {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);

  if (rows.length === 0) {
    return <>{emptyState}</>;
  }

  const primaryKey = columns.find((c) => c.primary)?.key ?? columns[0]?.key;
  const primary = columns.find((c) => c.key === primaryKey) ?? columns[0];

  // ── Vista de tarjetas (móvil) ──
  const cardsView = !cardsDisabled && !isDesktop && (
    <ul className="responsive-data-cards" role="list">
      {rows.map((row) => {
        const visible = columns.filter(
          (c) => c.key !== primary?.key && !c.hideOnCard,
        );
        const primaryActions = primary?.actions;
        const otherActions = columns.filter(
          (c) => c.actions && c.key !== primary?.key,
        );
        return (
          <li key={rowKey(row)} className="rdv-card">
            <div className="rdv-card-head">
              <div className="rdv-primary">{primary?.cell(row)}</div>
              {primaryActions && <div className="row-actions">{primaryActions(row)}</div>}
            </div>
            {visible.length > 0 && (
              <dl className="rdv-card-meta">
                {visible.map((c) => (
                  <div key={c.key} className="rdv-meta-row">
                    {c.cardLabel && <dt>{c.cardLabel}</dt>}
                    <dd>{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {otherActions.length > 0 && (
              <div className="rdv-card-actions row-actions">
                {otherActions.map((c) => (
                  <React.Fragment key={c.key}>{c.actions!(row)}</React.Fragment>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  // ── Vista de tabla (desktop) ──
  const tableView = isDesktop && (
    <div className="responsive-data-table table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.className}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key} className={c.className}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      {cardsView}
      {tableView}
    </>
  );
}