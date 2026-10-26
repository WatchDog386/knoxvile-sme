import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from './label';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, placeholder, children, ...props }, ref) => (
    <div className="w-full">
      {label && <Label>{label}</Label>}
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'h-11 w-full appearance-none rounded-full border border-edge bg-field pl-4 pr-9 text-sm text-foreground shadow-sm',
            'transition-colors focus:border-edge-2 focus:ring-0 focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-surface-2',
            'aria-[invalid=true]:border-danger',
            placeholder && !props.value && 'text-foreground-5',
            className,
          )}
          aria-invalid={error ? true : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-5"
          aria-hidden
        />
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  ),
);
Select.displayName = 'Select';