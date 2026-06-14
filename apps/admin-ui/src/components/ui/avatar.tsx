import { cn } from '../../lib/cn';

interface AvatarProps {
  src?: string | null;
  fallback: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'tm:h-7 tm:w-7 tm:text-xs',
  md: 'tm:h-9 tm:w-9 tm:text-sm',
  lg: 'tm:h-12 tm:w-12 tm:text-base',
};

export function Avatar({ src, fallback, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={fallback}
        className={cn(
          'tm:rounded-full tm:object-cover',
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'tm:flex tm:items-center tm:justify-center tm:rounded-full tm:bg-muted tm:font-medium tm:text-muted-foreground',
        sizeClasses[size],
        className
      )}
    >
      {fallback}
    </div>
  );
}
