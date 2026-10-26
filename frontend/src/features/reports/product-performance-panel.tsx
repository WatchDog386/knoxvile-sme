import { useQuery } from '@tanstack/react-query';
import { apiErrorMessage } from '@/api/client';
import { reportsApi } from '@/api/endpoints';
import { Alert } from '@/components/ui/alert';
import { PageLoader } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Package } from 'lucide-react';
import { formatKES } from '@/lib/utils';

export function ProductPerformancePanel({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'products', { from, to }],
    queryFn: () => reportsApi.productPerformance({ from, to }),
  });

  if (error) {
    return <Alert variant="error" title="Could not load product performance" inline>{apiErrorMessage(error)}</Alert>;
  }

  if (isLoading || !data) {
    return <PageLoader inline message="Loading" />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No product sales in this period"
        description="Try a wider date range."
      />
    );
  }

  const sorted = [...data].sort((a, b) => b.profit - a.profit);

  return (
    <div className="space-y-2">
      <h2 className="px-1 text-[13px] font-medium tracking-tight text-foreground">Top products by profit</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-[11px] font-medium uppercase tracking-wider text-foreground-4">
              <th className="px-1 py-2">Product</th>
              <th className="px-1 py-2 text-right">Sold</th>
              <th className="px-1 py-2 text-right">Revenue</th>
              <th className="px-1 py-2 text-right">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge max-lg:divide-y-0">
            {sorted.map((row) => (
              <tr key={row.name} className="hover:bg-surface-2 transition-colors">
                <td className="px-1 py-3 text-xs font-medium text-foreground">{row.name}</td>
                <td className="px-1 py-3 text-right text-xs tabular-nums text-foreground-2">{row.quantity}</td>
                <td className="px-1 py-3 text-right text-xs font-medium tabular-nums text-foreground">{formatKES(row.revenue)}</td>
                <td className={`px-1 py-3 text-right text-xs font-medium tabular-nums ${row.profit >= 0 ? 'text-success' : 'text-danger'}`}>
                  {row.profit < 0 ? `−${formatKES(-row.profit)}` : formatKES(row.profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
