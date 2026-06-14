import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const variants = {
  default: 'tm:bg-primary tm:text-primary-foreground tm:hover:bg-primary/90',
  destructive: 'tm:bg-destructive tm:text-destructive-foreground tm:hover:bg-destructive/90',
  outline: 'tm:border tm:border-input tm:bg-background tm:hover:bg-accent tm:hover:text-accent-foreground',
  secondary: 'tm:bg-secondary tm:text-secondary-foreground tm:hover:bg-secondary/80',
  ghost: 'tm:hover:bg-accent tm:hover:text-accent-foreground',
  link: 'tm:text-primary tm:underline-offset-4 tm:hover:underline',
};

const sizes = {
  default: 'tm:h-9 tm:px-4 tm:py-2',
  sm: 'tm:h-8 tm:rounded-md tm:px-3 tm:text-xs',
  lg: 'tm:h-10 tm:rounded-md tm:px-8',
  icon: 'tm:h-9 tm:w-9',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export function Button({ className, variant = 'default', size = 'default', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'tm:inline-flex tm:items-center tm:justify-center tm:gap-2 tm:whitespace-nowrap tm:rounded-md tm:text-sm tm:font-medium tm:transition-colors',
        'tm:focus-visible:outline-none tm:focus-visible:ring-1 tm:focus-visible:ring-ring',
        'tm:disabled:pointer-events-none tm:disabled:opacity-50',
        'tm:cursor-pointer',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
