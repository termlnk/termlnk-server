import { cn } from '../../lib/cn';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('tm:animate-pulse tm:rounded-md tm:bg-muted', className)} />
  );
}
