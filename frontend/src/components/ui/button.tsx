import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Botón del sistema de diseño (handoff). Usa las clases `.btn*` de globals.css
 * para tematizar claro/oscuro y acento por-tenant. Se conservan los nombres de
 * variante previos (default/outline/ghost/destructive) y se añaden los nuevos.
 */
const buttonVariants = cva('btn', {
  variants: {
    variant: {
      default: 'btn-primary',
      primary: 'btn-primary',
      outline: 'btn-secondary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      destructive: 'btn-danger-solid',
      danger: 'btn-danger',
      'danger-solid': 'btn-danger-solid',
      success: 'btn-success',
    },
    size: {
      default: '',
      sm: 'btn-sm',
      lg: 'btn-lg',
      icon: 'btn-icon',
      block: 'btn-block',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = 'Button';

export { buttonVariants };
