import { useQuery } from '@tanstack/react-query';
import { apiErrorMessage } from '@/api/client';
import { reportsApi } from '@/api/endpoints';
import { Alert } from '@/components/ui/alert';
import { PageLoader } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { BarChart3 } from 'lucide-react';
import { formatKES } from '@/lib/utils';

export function DailySummaryPanel({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'daily-summary', { from, to }],
    queryFn: () => reportsApi.dailySummary({ from, to }),
  });

  if (error) {
    return <Alert variant="error" title="Could not load the daily summary" inline>{apiErrorMessage(error)}</Alert>;
  }

  if (isLoading || !data) {
    return <PageLoader inline message="Loading" />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No sales in this period"
        description="Try a wider date range."
      />
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="px-1 text-[13px] font-medium tracking-tight text-foreground">Daily breakdown</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-[11px] font-medium uppercase tracking-wider text-foreground-4">
              <th className="px-1 py-2">Day</th>
              <th className="px-1 py-2 text-right">Revenue</th>
              <th className="px-1 py-2 text-right">COGS</th>
              <th className="px-1 py-2 text-right">Expenses</th>
              <th className="px-1 py-2 text-right">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge max-lg:divide-y-0">
            {data.map((row) => (
              <tr key={row.date} className="hover:bg-surface-2 transition-colors">
                <td className="px-1 py-3 text-xs font-medium text-foreground">{row.date}</td>
                <td className="px-1 py-3 text-right text-xs font-medium tabular-nums text-foreground">{formatKES(row.revenue)}</td>
                <td className="px-1 py-3 text-right text-xs tabular-nums text-danger">−{formatKES(row.cogs)}</td>
                <td className="px-1 py-3 text-right text-xs tabular-nums text-danger">−{formatKES(row.expenses)}</td>
                <td className={`px-1 py-3 text-right text-xs font-medium tabular-nums ${row.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                  {row.netProfit < 0 ? `−${formatKES(-row.netProfit)}` : formatKES(row.netProfit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
