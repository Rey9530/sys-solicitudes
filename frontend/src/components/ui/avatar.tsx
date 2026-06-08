import { cn } from '@/lib/utils';
import { initials } from '@/components/shell/nav-config';

/** Avatar de iniciales con gradiente derivado por hash del nombre. */
export function Avatar({
  name,
  sm,
  className,
}: {
  name: string | null | undefined;
  sm?: boolean;
  className?: string;
}) {
  const seed = name ?? '?';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return (
    <span
      className={cn('avatar', sm && 'avatar-sm', className)}
      style={{
        background: `linear-gradient(150deg, hsl(${hue} 58% 56%), hsl(${(hue + 28) % 360} 62% 44%))`,
      }}
      title={name ?? undefined}
    >
      {initials(name)}
    </span>
  );
}
