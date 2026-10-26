import { cn } from '@/lib/utils';

export function LoadingSpinner({
  className,
  size = 'md',
  text,
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}) {
  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  return (
    <span
      className={cn(
        'inline-block animate-pulse text-current',
        sizeMap[size],
        className,
      )}
    >
      {text}
    </span>
  );
}

export function LoadingSkeleton({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeMap = {
    sm: 'h-8 w-8 rounded-sm',
    md: 'h-12 w-12 rounded-full',
    lg: 'h-16 w-16 rounded-full',
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-surface-3 rounded-sm',
        sizeMap[size],
        className,
      )}
    />
  );
}