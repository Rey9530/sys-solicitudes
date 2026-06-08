import Link from 'next/link';

/** Paginación numérica del sistema (`.pager`). */
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
      <div className="pager">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <Link key={p} href={hrefFor(p)} className={p === page ? 'on' : undefined}>
            {p}
          </Link>
        ))}
      </div>
    </div>
  );
}
