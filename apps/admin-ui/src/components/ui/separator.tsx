import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Separator({ className, orientation = 'horizontal', ...props }: SeparatorProps) {
  return (
    <div
      className={cn(
        'tm:shrink-0 tm:bg-border',
        orientation === 'horizontal' ? 'tm:h-px tm:w-full' : 'tm:h-full tm:w-px',
        className
      )}
      {...props}
    />
  );
}
