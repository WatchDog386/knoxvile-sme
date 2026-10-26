import { useQuery } from '@tanstack/react-query';
import { Banknote, Building, CreditCard, Smartphone } from 'lucide-react';
import { apiErrorMessage } from '@/api/client';
import { reportsApi } from '@/api/endpoints';
import { Alert } from '@/components/ui/alert';
import { PageLoader } from '@/components/ui/spinner';
import { formatKES } from '@/lib/utils';

export function ProfitLossPanel({ from, to }: { from: string; to: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'profit-loss', { from, to }],
    queryFn: () => reportsApi.profitLoss({ from, to }),
  });

  if (error) {
    return <Alert variant="error" title="Could not load the profit report" inline>{apiErrorMessage(error)}</Alert>;
  }

  if (isLoading || !data) {
    return <PageLoader inline message="Loading" />;
  }

  const rows: Array<{ label: string; value: number; tone?: 'emerald' | 'red' | 'bold' }> = [
    { label: 'Sales revenue', value: data.revenue, tone: 'emerald' },
    { label: 'Cost of goods sold (stock you used)', value: -data.cogs, tone: 'red' },
    { label: 'Gross profit', value: data.grossProfit, tone: 'bold' },
    { label: 'Operating expenses (rent, salaries...)', value: -data.operatingExpenses, tone: 'red' },
    { label: 'Net profit (your actual profit)', value: data.netProfit, tone: 'bold' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-purple-600 px-4 py-4 text-white shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Gross margin</p>
          <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-white">{data.grossMargin.toFixed(1)}%</p>
          <p className="mt-1 text-[11px] text-white/70">Revenue efficiency</p>
        </div>
        <div className="rounded-xl bg-brand-700 px-4 py-4 text-white shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Net margin</p>
          <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-white">{data.netMargin.toFixed(1)}%</p>
          <p className="mt-1 text-[11px] text-white/70">Bottom line</p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="px-1 text-[13px] font-medium tracking-tight text-foreground">Breakdown</h2>
        <ul className="divide-y divide-edge max-lg:divide-y-0">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between px-1 py-3 hover:bg-surface-2 transition-colors">
              <span className="text-sm text-foreground-2">{row.label}</span>
              <span className={`text-sm font-medium tabular-nums ${row.tone === 'emerald' ? 'text-success' : row.tone === 'red' ? 'text-danger' : 'text-foreground'}`}>
                {row.value < 0 ? `−${formatKES(-row.value)}` : formatKES(row.value)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between px-1 py-3 border-t border-edge">
          <span className="text-sm font-medium text-foreground">Net profit {data.netProfit >= 0 ? 'made' : 'loss'}</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">{data.netProfit < 0 ? `−${formatKES(-data.netProfit)}` : formatKES(data.netProfit)}</span>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="px-1 text-[13px] font-medium tracking-tight text-foreground">Summary</h2>
        <div className="grid grid-cols-3 gap-3 px-1">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-4">Sales</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{data.salesCount}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-4">Average sale</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-foreground">{formatKES(data.averageSaleValue)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-4">Period</p>
            <p className="mt-1 text-xs font-medium text-foreground">{new Date(data.from).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            <p className="text-xs font-medium text-foreground">→ {new Date(data.to).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
        {data.revenueByMethod.length > 0 && (
          <div className="space-y-1.5">
            <p className="px-1 text-[11px] font-medium uppercase tracking-wider text-foreground-4">Revenue by payment method</p>
            <ul className="divide-y divide-edge max-lg:divide-y-0">
              {data.revenueByMethod.map((entry) => {
                const pct = data.revenue > 0 ? (entry.total / data.revenue) * 100 : 0;
                const Icon = entry.method === 'M-PESA' ? Smartphone : entry.method === 'CASH' ? Banknote : entry.method === 'CARD' ? CreditCard : Building;
                return (
                  <li key={entry.method} className="flex items-center gap-3 px-1 py-2.5 hover:bg-surface-2 transition-colors">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${entry.method === 'M-PESA' ? 'bg-emerald-500' : entry.method === 'CASH' ? 'bg-amber-500' : entry.method === 'CARD' ? 'bg-sky-500' : 'bg-purple-500'}`}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{entry.method === 'M-PESA' ? 'M-Pesa' : entry.method.charAt(0) + entry.method.slice(1).toLowerCase()}</p>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{formatKES(entry.total)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
