'use client';

/**
 * Vista responsive de datos: tabla accesible cuando CABE en su contenedor,
 * tarjetas por registro cuando no cabe.
 *
 * Decisión "content-driven" (2026-09-16, fix responsive):
 *
 * La versión anterior cambiaba a tabla a partir de 768 px de *viewport*. Las
 * tablas del sistema tienen 6-11 columnas y necesitan 750-1100 px de ancho
 * natural, así que entre 768 y ~1280 px (tablets, teléfonos en horizontal,
 * laptops con el sidebar abierto) la tabla desbordaba su tarjeta y quedaba
 * cortada. Un breakpoint fijo nunca sirve porque el ancho útil depende del
 * sidebar (256/76 px), del padding del `.main` y de la tarjeta.
 *
 * Ahora el componente:
 *  1. Mide el ancho del contenedor con `ResizeObserver` (`useContainerWidth`).
 *  2. Mide el ancho NATURAL de la tabla con una "sonda": una copia de la tabla
 *     renderizada oculta (`visibility: hidden`, altura 0, `width: max-content`)
 *     solo mientras no tenga medida para el juego de columnas/filas actual.
 *  3. Renderiza la tabla si `contenedor >= natural`. Si no cabe:
 *     - contenedor >= `CARDS_MAX_WIDTH` (laptops con sidebar): tabla densa con
 *       scroll horizontal (un escritorio espera una tabla, no tarjetas);
 *     - contenedor menor (teléfonos, tablets): tarjetas.
 *     Se re-mide cuando cambian columnas/filas y cuando terminan de cargar
 *     las fuentes web (cambian las métricas de texto).
 *
 * SSR: el servidor y el primer render en cliente pintan tarjetas (mobile
 * first); las medidas se toman en `useLayoutEffect`, antes del primer paint
 * tras la hidratación, por lo que en escritorio no hay parpadeo visible.
 */
import * as React from 'react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useContainerWidth } from './use-container-width';

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
  /** Fuerza la tabla siempre (con scroll horizontal como último recurso). */
  cardsDisabled?: boolean;
  /**
   * Ancho mínimo (px) que debe tener el contenedor para mostrar la tabla.
   * Si se indica, sustituye a la medición automática.
   */
  minTableWidth?: number;
}

/** Holgura para no quedar justo en el límite (bordes, scrollbar, redondeos). */
const SLACK_PX = 8;
/** A partir de este ancho de contenedor (px) nunca se muestran tarjetas: si la
 *  tabla no cabe se muestra densa y con scroll horizontal. */
const CARDS_MAX_WIDTH = 900;

export function ResponsiveDataView<T>({
  rows,
  columns,
  rowKey,
  emptyState,
  cardsDisabled = false,
  minTableWidth,
}: ResponsiveDataViewProps<T>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLTableElement>(null);
  const containerWidth = useContainerWidth(wrapRef);

  // Clave del contenido que afecta al ancho natural de la tabla.
  const measureKey = useMemo(
    () => `${columns.map((c) => c.key).join('|')}::${rows.map(rowKey).join('|')}`,
    [columns, rows, rowKey],
  );
  const [measured, setMeasured] = useState<{ key: string; width: number } | null>(null);
  const [fontsTick, setFontsTick] = useState(0);

  const needsMeasure =
    !cardsDisabled && minTableWidth === undefined && measured?.key !== measureKey;

  // Mide la sonda en cuanto está en el DOM (antes del paint).
  useLayoutEffect(() => {
    if (!needsMeasure) return;
    const probe = probeRef.current;
    if (!probe) return;
    const width = Math.ceil(probe.getBoundingClientRect().width) + SLACK_PX;
    setMeasured({ key: measureKey, width });
  }, [needsMeasure, measureKey, fontsTick]);

  // Las fuentes web cambian las métricas: re-medir cuando terminen de cargar.
  useLayoutEffect(() => {
    if (typeof document === 'undefined' || !('fonts' in document)) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      setMeasured(null);
      setFontsTick((t) => t + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows.length === 0) {
    return <>{emptyState}</>;
  }

  const requiredWidth = minTableWidth ?? (measured?.key === measureKey ? measured.width : null);
  const fits = requiredWidth !== null && containerWidth !== null && containerWidth >= requiredWidth;
  const wideContainer = containerWidth !== null && containerWidth >= CARDS_MAX_WIDTH;
  const showTable = cardsDisabled || fits || wideContainer;
  const dense = showTable && !fits && !cardsDisabled;

  const primaryKey = columns.find((c) => c.primary)?.key ?? columns[0]?.key;
  const primary = columns.find((c) => c.key === primaryKey) ?? columns[0];

  const table = (
    <table className={dense ? 'tbl tbl-dense' : 'tbl'}>
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
  );

  // ── Vista de tarjetas (contenedor estrecho) ──
  const cardsView = !showTable && (
    <ul className="responsive-data-cards" role="list">
      {rows.map((row) => {
        // Las columnas con `actions` se pintan en el pie de la tarjeta; si
        // también entraran aquí, los botones aparecerían duplicados.
        const visible = columns.filter(
          (c) => c.key !== primary?.key && !c.hideOnCard && !c.actions,
        );
        const primaryActions = primary?.actions;
        const otherActions = columns.filter((c) => c.actions && c.key !== primary?.key);
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

  // ── Vista de tabla (contenedor ancho) ──
  const tableView = showTable && <div className="responsive-data-table table-wrap">{table}</div>;

  return (
    <div ref={wrapRef} className="rdv">
      {cardsView}
      {tableView}
      {needsMeasure && (
        <div className="rdv-probe" aria-hidden="true">
          <table ref={probeRef} className="tbl" style={{ width: 'max-content' }}>
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
      )}
    </div>
  );
}
