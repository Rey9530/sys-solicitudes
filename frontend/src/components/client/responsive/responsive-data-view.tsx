'use client';

/**
 * Vista responsive de datos: en móvil muestra tarjetas por registro; desde
 * 768 px (`md`) muestra la tabla accesible. La colección `rows` se recibe una
 * sola vez y se renderiza en paralelo; la visibilidad la controla CSS
 * (`.responsive-data-cards` / `.responsive-data-table`).
 *
 * No se hace `matchMedia` aquí para evitar hydration mismatch y layout shifts.
 * La tabla y la lista se renderizan como una sola pasada y el navegador
 * decide qué enseñar, siguiendo los principios mobile-first de Bootstrap 5.
 */
import * as React from 'react';

export interface ResponsiveColumn<T> {
  /** Identificador estable de la columna (debe ser único en la tabla). */
  key: string;
  header: React.ReactNode;
  /** Renderiza la celda (o la fila en la vista tarjeta si `primary`). */
  cell: (row: T) => React.ReactNode;
  /** Etiqueta visible para el campo en la vista tarjeta (`dt`). */
  cardLabel?: React.ReactNode;
  /** Si la celda debe ser el "lead" de la tarjeta (título). Por defecto la primera columna. */
  primary?: boolean;
  /** Si la columna no debe mostrarse en la vista tarjeta. */
  hideOnCard?: boolean;
  /** Clases adicionales para la celda `td` o el bloque equivalente. */
  className?: string;
  /** Acciones contextuales para esta columna. Solo en vista tarjeta. */
  actions?: (row: T) => React.ReactNode;
}

export interface ResponsiveDataViewProps<T> {
  rows: readonly T[];
  columns: readonly ResponsiveColumn<T>[];
  rowKey: (row: T) => string;
  emptyState?: React.ReactNode;
  /** Si la lista no debe tener `.responsive-data-cards` (ej. matriz). */
  cardsDisabled?: boolean;
}

export function ResponsiveDataView<T>({
  rows,
  columns,
  rowKey,
  emptyState,
  cardsDisabled = false,
}: ResponsiveDataViewProps<T>) {
  if (rows.length === 0) {
    return <>{emptyState}</>;
  }

  const primaryKey = columns.find((c) => c.primary)?.key ?? columns[0]?.key;

  return (
    <>
      {!cardsDisabled && (
        <ul className="responsive-data-cards" role="list">
          {rows.map((row) => {
            const primary = columns.find((c) => c.key === primaryKey) ?? columns[0];
            const visible = columns.filter(
              (c) => c.key !== primary?.key && !c.hideOnCard,
            );
            // Acciones: las de la columna primaria en la cabecera;
            // el resto se agrupa en una barra inferior de acciones.
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
                      <React.Fragment key={c.key}>
                        {c.actions!(row)}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

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
    </>
  );
}
