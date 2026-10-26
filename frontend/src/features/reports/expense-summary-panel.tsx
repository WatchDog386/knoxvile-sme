import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { apiErrorMessage } from '@/api/client';
import { reportsApi } from '@/api/endpoints';
import { Alert } from '@/components/ui/alert';
import { PageLoader } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { formatKES } from '@/lib/utils';

/** Approved expenses for the range, grouped by category. */
export function ExpenseSummaryPanel({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'expenses', { from, to }],
    queryFn: () => reportsApi.expenseSummary({ from, to }),
  });

  if (error) {
    return <Alert variant="error" title="Could not load expenses" inline>{apiErrorMessage(error)}</Alert>;
  }

  if (isLoading || !data) {
    return <PageLoader inline message="Loading" />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No approved expenses in this period"
        description="Try a wider date range."
      />
    );
  }

  const total = data.reduce((acc, row) => acc + row.amount, 0);
  const max = Math.max(...data.map((row) => row.amount));

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-edge bg-surface p-4">
        <p className="text-xs text-foreground-4">Total approved expenses</p>
        <p className="mt-1 text-2xl font-medium tabular-nums text-foreground">{formatKES(total)}</p>
        <p className="mt-1 text-xs text-foreground-5">
          {data.length} {data.length === 1 ? 'category' : 'categories'} · pending and rejected expenses are excluded
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="px-1 text-[13px] font-medium tracking-tight text-foreground">By category</h2>
        <ul className="space-y-3 rounded-3xl border border-edge bg-surface p-4">
          {data.map((row) => {
            const share = total > 0 ? Math.round((row.amount / total) * 100) : 0;
            return (
              <li key={row.category}>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-foreground">{row.category}</span>
                  <span className="shrink-0 tabular-nums text-foreground-2">
                    {formatKES(row.amount)} <span className="text-foreground-5">· {share}%</span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                  <div
                    className="h-full rounded-full bg-brand-600"
                    style={{ width: `${max > 0 ? (row.amount / max) * 100 : 0}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
