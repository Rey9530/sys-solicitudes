import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <div className="breadcrumb">
      {items.map((c, i) => (
        <span key={`${c.label}-${i}`} className="inline-flex items-center gap-[7px]">
          {i > 0 && <ChevronRight />}
          {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
        </span>
      ))}
    </div>
  );
}

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Badges/chips junto al título. */
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: Crumb[];
}

export function PageHeader({ title, subtitle, badges, actions, breadcrumb }: PageHeaderProps) {
  return (
    <>
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="page-head">
        <div className="ph-main">
          <h1 className="page-title">
            {title}
            {badges}
          </h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </>
  );
}
