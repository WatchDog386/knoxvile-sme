import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { Customer } from '@/api/types';

export function CustomerPicker({
  customers,
  value,
  onChange,
}: {
  customers: Customer[];
  value: string | null;
  onChange: (customerId: string | null) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? customers.filter(
        (customer) =>
          customer.name.toLowerCase().includes(search.toLowerCase()) ||
          (customer.phone ?? '').includes(search),
      )
    : customers;

  const selected = customers.find((customer) => customer.id === value);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            value === null
              ? 'border-accent bg-accent text-white'
              : 'border-edge text-foreground-2 hover:bg-surface-2',
          )}
        >
          Walk-in customer
        </button>
        {selected && value !== null && (
          <button
            type="button"
            className="rounded-full border border-accent-border bg-accent-soft px-3 py-1.5 text-xs font-medium text-accent"
          >
            {selected.name} ✓
          </button>
        )}
      </div>

      {value === null && customers.length > 0 && (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-5" aria-hidden />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers..."
              className="h-9 pl-9 text-sm"
            />
          </div>
          <div className="max-h-44 overflow-y-auto rounded-xl border border-edge">
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-center text-xs text-foreground-5">
                No customers match "{search}".
              </p>
            )}
            <ul className="divide-y divide-edge max-lg:divide-y-0">
              {filtered.slice(0, 20).map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    onClick={() => onChange(customer.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent-soft"
                  >
                    <span className="truncate font-medium text-foreground">
                      {customer.name}
                    </span>
                    {customer.outstanding_balance > 0 && (
                      <span className="shrink-0 text-xs font-medium text-danger">
                        owes {customer.outstanding_balance.toLocaleString('en-KE')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {filtered.length > 20 && (
            <p className="text-center text-xs text-foreground-5">
              Showing first 20 — type to search more
            </p>
          )}
        </>
      )}

      {value === null && customers.length === 0 && (
        <p className="flex items-center gap-1 text-xs text-foreground-5">
          <Check className="h-3 w-3" />
          No customers yet — you can add them later.
        </p>
      )}
    </div>
  );
}
