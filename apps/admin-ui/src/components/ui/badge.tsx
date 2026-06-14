import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const variants = {
  default: 'tm:bg-primary tm:text-primary-foreground',
  secondary: 'tm:bg-secondary tm:text-secondary-foreground',
  destructive: 'tm:bg-destructive tm:text-destructive-foreground',
  outline: 'tm:text-foreground tm:border',
  success: 'tm:bg-success tm:text-success-foreground',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'tm:inline-flex tm:items-center tm:rounded-md tm:px-2 tm:py-0.5 tm:text-xs tm:font-medium tm:transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
