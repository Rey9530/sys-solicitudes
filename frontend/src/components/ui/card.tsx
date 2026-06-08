import * as React from 'react';
import { cn } from '@/lib/utils';

/** Tarjeta del sistema (`.card`). Componer con CardHead/CardBody/CardFoot o
 *  usar `.card-pad` vía la prop `pad`. */
export function Card({
  className,
  pad,
  hoverable,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { pad?: boolean; hoverable?: boolean }) {
  return (
    <div className={cn('card', pad && 'card-pad', hoverable && 'hoverable', className)} {...props} />
  );
}

export function CardHead({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card-head', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card-body', className)} {...props} />;
}

export function CardFoot({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card-foot', className)} {...props} />;
}
