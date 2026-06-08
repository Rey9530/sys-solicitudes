import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type KpiTint = 'ok' | 'info' | 'warn' | 'danger' | 'violet' | 'primary';

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tint?: KpiTint;
  /** Texto del delta (ej. "+12%"). */
  delta?: string;
  deltaDir?: 'up' | 'down';
  /** Sparkline u otro contenido al pie de la card. */
  spark?: React.ReactNode;
  className?: string;
}

/** KPI card: label + icono tintado + valor grande + delta/sparkline opcionales. */
export function KpiCard({
  label,
  value,
  icon: Icon,
  tint = 'primary',
  delta,
  deltaDir,
  spark,
  className,
}: KpiCardProps) {
  return (
    <div className={cn('card kpi', className)}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className={cn('kpi-ic', `tint-${tint}`)}>
          <Icon />
        </span>
      </div>
      <div className="kpi-val">{value}</div>
      {delta && (
        <div className={cn('kpi-delta', deltaDir === 'down' ? 'down' : 'up')}>
          {deltaDir === 'down' ? <TrendingDown /> : <TrendingUp />}
          {delta}
        </div>
      )}
      {spark && <div className="kpi-spark">{spark}</div>}
    </div>
  );
}
