'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Ancho real (px) del contenedor referenciado, actualizado con `ResizeObserver`.
 *
 * Devuelve `null` hasta el primer layout en cliente (SSR-safe). Se usa para
 * decisiones "container-driven" (no viewport-driven): el ancho útil de una
 * tabla depende del sidebar, del padding del `.main` y de la tarjeta que la
 * envuelve, no del ancho de la ventana.
 */
export function useContainerWidth<T extends HTMLElement>(ref: RefObject<T | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Lectura síncrona antes del primer paint para evitar el parpadeo
    // tarjetas → tabla en escritorio.
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = Math.round(entry.contentRect.width);
      setWidth((prev) => (prev === next ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}
