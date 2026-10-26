import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEFAULT_FROM, DEFAULT_TO } from './constants';

export function useDateRange() {
  const [from, setFrom] = useState(DEFAULT_FROM);
  const [to, setTo] = useState(DEFAULT_TO);

  useEffect(() => {
    if (from && to && from > to) setTo(from);
  }, [from, to]);

  return {
    from,
    to,
    setFrom,
    setTo,
  };
}

export function DateRangeField({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor="report-from" className="text-[11px] font-medium text-foreground-4">
          From
        </Label>
        <Input
          id="report-from"
          type="date"
          value={from}
          onChange={(event) => onFromChange(event.target.value)}
          className="h-9 w-auto rounded-full bg-field px-3 text-xs"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Label htmlFor="report-to" className="text-[11px] font-medium text-foreground-4">
          To
        </Label>
        <Input
          id="report-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => onToChange(event.target.value)}
          className="h-9 w-auto rounded-full bg-field px-3 text-xs"
        />
      </div>
    </div>
  );
}
