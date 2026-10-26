import { forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useActiveBusiness } from '@/stores/business';
import { businessToday } from '@/lib/business-date';

/** Today in the business's timezone, for a date field's default and limit. */
export function useBusinessToday(): string {
  return businessToday(useActiveBusiness()?.timezone);
}

/** Zod-style check: a YYYY-MM-DD that is today or earlier. Returns an error message, or null. */
export function recordDateError(value: string | undefined, today: string): string | null {
  if (!value) return 'Pick the date.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Pick a valid date.';
  if (value > today) return "The date can't be later than today.";
  if (value < '2000-01-01') return 'Pick a valid date.';
  return null;
}

/**
 * The day a sale or expense happened: day, month and year from the phone's
 * date picker. Defaults to today; any earlier day is allowed, never a future one.
 */
export const RecordDateField = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; labelClassName?: string }
>(({ label = 'Date', error, id = 'record-date', className, labelClassName, ...props }, ref) => {
  const today = useBusinessToday();
  return (
    <div>
      <Label htmlFor={id} className={labelClassName}>
        {label}
      </Label>
      <div>
        <Input
          ref={ref}
          id={id}
          type="date"
          max={today}
          min="2000-01-01"
          required
          aria-invalid={error ? true : undefined}
          className={className}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
});
RecordDateField.displayName = 'RecordDateField';
