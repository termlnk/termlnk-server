import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'end';
  side?: 'top' | 'bottom';
  className?: string;
}

export function DropdownMenu({ trigger, children, align = 'start', side = 'bottom', className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="tm:relative" ref={containerRef}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            'tm:absolute tm:z-50 tm:min-w-[12rem] tm:rounded-lg tm:border tm:border-border tm:bg-popover tm:text-popover-foreground tm:p-1 tm:shadow-lg',
            side === 'top' && 'tm:bottom-full tm:mb-1',
            side === 'bottom' && 'tm:top-full tm:mt-1',
            align === 'start' && 'tm:left-0',
            align === 'end' && 'tm:right-0',
            className
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('tm:px-2 tm:py-1.5 tm:text-xs tm:font-medium tm:text-muted-foreground', className)} {...props} />;
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn('tm:my-1 tm:h-px tm:bg-border', className)} />;
}

interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive';
}

export function DropdownMenuItem({ className, variant = 'default', ...props }: DropdownMenuItemProps) {
  return (
    <button
      className={cn(
        'tm:flex tm:w-full tm:items-center tm:gap-2 tm:rounded-md tm:px-2 tm:py-1.5 tm:text-sm tm:transition-colors tm:cursor-pointer',
        variant === 'default' && 'tm:hover:bg-accent tm:hover:text-accent-foreground',
        variant === 'destructive' && 'tm:text-destructive tm:hover:bg-destructive/10',
        className
      )}
      {...props}
    />
  );
}
