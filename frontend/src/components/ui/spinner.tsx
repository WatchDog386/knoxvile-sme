import { SpeedWheel } from './workspace-loader';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('h-5 w-5 animate-spin text-accent', className)}
      aria-label="Loading"
    />
  );
}

/** Speeding-wheel loader (advanced KUCCPS style, see SpeedWheel). */
export function BrandLoader({ message = 'Loading' }: { message?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center">
      <SpeedWheel />
      <span className="sr-only">{message}</span>
    </div>
  );
}

export function PageLoader({
  message = 'Loading',
  inline = false,
}: {
  message?: string;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4 py-12">
        <BrandLoader message={message} />
      </div>
    );
  }

  // On <body>, so an animating page wrapper can't move it: every full-screen
  // load (workspace, then dashboard data) shows the wheel in the same spot.
  return createPortal(
    <div className="fixed inset-0 z-[99] flex items-center justify-center bg-surface">
      <BrandLoader message={message} />
    </div>,
    document.body,
  );
}
