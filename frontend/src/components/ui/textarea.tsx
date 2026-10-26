import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[88px] w-full rounded-2xl border border-edge bg-field px-4 py-3 text-sm text-foreground placeholder:text-foreground-5',
        'transition-colors focus:border-edge-2 focus:ring-0 focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-surface-2',
        'aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';