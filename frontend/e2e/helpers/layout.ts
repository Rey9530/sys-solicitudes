import type { Page } from '@playwright/test';

/** Anchos auditados: teléfono, tablet y PC (alto típico de cada dispositivo). */
export const VIEWPORTS = [
  { nombre: 'tel-360', width: 360, height: 740, tipo: 'telefono' },
  { nombre: 'tel-390', width: 390, height: 844, tipo: 'telefono' },
  { nombre: 'tab-768', width: 768, height: 1024, tipo: 'tablet' },
  { nombre: 'tab-1024', width: 1024, height: 768, tipo: 'tablet' },
  { nombre: 'pc-1280', width: 1280, height: 800, tipo: 'pc' },
  { nombre: 'pc-1440', width: 1440, height: 900, tipo: 'pc' },
] as const;

export interface Hallazgo {
  tipo:
    | 'scroll-horizontal'
    | 'fuera-de-pantalla'
    | 'texto-desbordado'
    | 'objetivo-tactil'
    | 'control-sin-etiqueta';
  selector: string;
  detalle: string;
}

/**
 * Mide el layout real en el navegador:
 *  - scroll horizontal del documento;
 *  - elementos visibles cortados por el borde del viewport (los que viven
 *    dentro de un contenedor con scroll propio, p. ej. `.table-wrap`, se
 *    excluyen: ese contenedor es el que se mide);
 *  - texto que se sale de su caja sin `text-overflow: ellipsis`;
 *  - en táctil (< 900 px): objetivos interactivos menores de 24×24 (WCAG 2.2
 *    2.5.8). Se reporta como aviso, no como fallo;
 *  - campos de formulario sin nombre accesible (label/aria-label). Aviso.
 */
export async function auditarLayout(page: Page, tactil: boolean): Promise<Hallazgo[]> {
  return page.evaluate((esTactil) => {
    const out: { tipo: string; selector: string; detalle: string }[] = [];
    const vw = document.documentElement.clientWidth;

    const describir = (el: Element): string => {
      const partes: string[] = [];
      let n: Element | null = el;
      for (let i = 0; n && i < 4; i++, n = n.parentElement) {
        let p = n.tagName.toLowerCase();
        if (n.id) p += `#${n.id}`;
        const cls = (n.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 2);
        if (cls.length) p += `.${cls.join('.')}`;
        partes.unshift(p);
      }
      const texto = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return `${partes.join(' > ')}${texto ? ` «${texto}»` : ''}`;
    };

    const visible = (el: Element): boolean => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) {
        return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    /** ¿Algún ancestro recorta horizontalmente (scroll propio u overflow oculto)? */
    const recortadoPorAncestro = (el: Element): boolean => {
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
      }
      return false;
    };

    const enCapaOculta = (el: Element): boolean =>
      !!el.closest('[aria-hidden="true"], [inert], [data-state="closed"]');

    if (document.documentElement.scrollWidth > vw + 1) {
      out.push({
        tipo: 'scroll-horizontal',
        selector: 'html',
        detalle: `scrollWidth ${document.documentElement.scrollWidth} > ${vw}`,
      });
    }

    const todos = Array.from(document.body.querySelectorAll('*'));
    for (const el of todos) {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      if (!visible(el) || enCapaOculta(el)) continue;
      const r = el.getBoundingClientRect();

      // Cortado por el viewport: intersecta la pantalla pero se sale por un lado.
      const intersecta = r.right > 0 && r.left < vw;
      if (intersecta && (r.right > vw + 1 || r.left < -1) && !recortadoPorAncestro(el)) {
        out.push({
          tipo: 'fuera-de-pantalla',
          selector: describir(el),
          detalle: `left ${Math.round(r.left)} right ${Math.round(r.right)} (vw ${vw})`,
        });
      }

      // Texto que desborda su caja (solo nodos con texto propio).
      const tieneTextoPropio = Array.from(el.childNodes).some(
        (c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? '').trim().length > 0,
      );
      if (tieneTextoPropio && el instanceof HTMLElement) {
        const cs = getComputedStyle(el);
        const desborda = el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0;
        if (desborda && cs.overflowX === 'visible' && cs.textOverflow !== 'ellipsis' && cs.display !== 'inline') {
          out.push({
            tipo: 'texto-desbordado',
            selector: describir(el),
            detalle: `scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`,
          });
        }
      }

      if (el.matches('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea')) {
        const id = el.getAttribute('id');
        const etiquetado =
          el.hasAttribute('aria-label') ||
          el.hasAttribute('aria-labelledby') ||
          !!el.closest('label') ||
          (!!id && !!document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
          (el.getAttribute('type') === 'file' && !!el.closest('[aria-label]'));
        if (!etiquetado) {
          out.push({
            tipo: 'control-sin-etiqueta',
            selector: describir(el),
            detalle: `${el.tagName.toLowerCase()}${el.getAttribute('placeholder') ? ` placeholder="${el.getAttribute('placeholder')}"` : ''}`,
          });
        }
      }

      if (
        esTactil &&
        el.matches('a[href], button, [role="button"], input:not([type=hidden]):not([type=file]), select, textarea')
      ) {
        // Enlaces dentro de un párrafo están exentos (WCAG 2.5.8 excepción "inline").
        const enLinea = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
        // Checkbox/radio con etiqueta asociada: la etiqueta también activa el control,
        // así que el área táctil real es la de la etiqueta.
        const id = el.getAttribute('id');
        const conEtiqueta =
          el.matches('input[type=checkbox], input[type=radio]') &&
          (!!el.closest('label') || (!!id && !!document.querySelector(`label[for="${CSS.escape(id)}"]`)));
        if (!enLinea && !conEtiqueta && (r.width < 24 || r.height < 24)) {
          out.push({
            tipo: 'objetivo-tactil',
            selector: describir(el),
            detalle: `${Math.round(r.width)}×${Math.round(r.height)} px`,
          });
        }
      }
    }

    // Un mismo problema se repite en hijos: deduplicar por selector+tipo.
    const vistos = new Set<string>();
    return out.filter((h) => {
      const k = `${h.tipo}|${h.selector}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    }) as Hallazgo[];
  }, tactil) as Promise<Hallazgo[]>;
}

/** Espera a que la página termine de pintar datos (sin spinners ni skeletons visibles). */
export async function esperarEstable(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
  await page
    .locator('[aria-busy="true"], .animate-spin, .skeleton')
    .first()
    .waitFor({ state: 'hidden', timeout: 10_000 })
    .catch(() => undefined);
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(250);
}
