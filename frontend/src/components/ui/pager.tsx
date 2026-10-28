import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Páginas a mostrar: primera, última, la actual y sus vecinas, con "…" en los
 * huecos (un hueco de una sola página muestra esa página en vez del "…").
 * Antes se listaban TODAS las páginas y con 20+ el pager se salía de la
 * pantalla en teléfonos (auditoría responsive 2026-10-27).
 */
function paginasVisibles(page: number, total: number): (number | 'gap')[] {
  const candidatas = [1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total);
  const ordenadas = Array.from(new Set(candidatas)).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  let anterior = 0;
  for (const p of ordenadas) {
    if (p - anterior === 2) out.push(anterior + 1);
    else if (p - anterior > 2) out.push('gap');
    out.push(p);
    anterior = p;
  }
  return out;
}

/** Paginación numérica del sistema (`.pager`). En teléfonos solo ‹ actual ›. */
export function Pager({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="tbl-foot">
      <span>
        Página {page} de {totalPages}
      </span>
      <nav className="pager" aria-label="Paginación">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} aria-label="Página anterior">
            <ChevronLeft size={16} />
          </Link>
        ) : (
          <span className="pager-off" aria-hidden="true">
            <ChevronLeft size={16} />
          </span>
        )}
        {paginasVisibles(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={hrefFor(p)}
              className={cn('pager-num', p === page && 'on')}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </Link>
          ),
        )}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} aria-label="Página siguiente">
            <ChevronRight size={16} />
          </Link>
        ) : (
          <span className="pager-off" aria-hidden="true">
            <ChevronRight size={16} />
          </span>
        )}
      </nav>
    </div>
  );
}
