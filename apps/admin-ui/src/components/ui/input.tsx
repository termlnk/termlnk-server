import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'tm:flex tm:h-9 tm:w-full tm:rounded-md tm:border tm:border-input tm:bg-transparent tm:px-3 tm:py-1 tm:text-sm tm:shadow-sm',
        'tm:transition-colors tm:placeholder:text-muted-foreground',
        'tm:focus-visible:outline-none tm:focus-visible:ring-1 tm:focus-visible:ring-ring',
        'tm:disabled:cursor-not-allowed tm:disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}
