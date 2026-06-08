import { AlertTriangle, CheckCircle2, Info, type LucideIcon, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type BannerTone = 'warn' | 'danger' | 'info' | 'ok';

const TONE_ICON: Record<BannerTone, LucideIcon> = {
  warn: AlertTriangle,
  danger: XCircle,
  info: Info,
  ok: CheckCircle2,
};

interface BannerProps {
  tone: BannerTone;
  icon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}

/** Aviso contextual (vencimiento, SC-4, subsanación…). */
export function Banner({ tone, icon, className, children }: BannerProps) {
  const Icon = icon ?? TONE_ICON[tone];
  return (
    <div className={cn('banner', `banner-${tone}`, className)} role="alert">
      <Icon />
      <div>{children}</div>
    </div>
  );
}
