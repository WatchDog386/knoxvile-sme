import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, CalendarDays, Coins, FileDown, Trophy, Wallet } from 'lucide-react';
import { businessesApi, customersApi, dashboardApi, reportsApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { DailyChart, chartDayLabel } from '@/components/desktop/daily-chart';
import { KpiCard } from '@/components/desktop/kpi-card';
import { ToolbarButton, ToolbarSelect } from '@/components/desktop/list-toolbar';
import { RailBars, RailLayout, RailStat } from '@/components/desktop/side-rail';
import { TableEmpty } from '@/components/desktop/table-empty';
import { periodRange } from '@/features/expenses/expenses-overview';
import { useRole } from '@/hooks/use-role';
import { cn, formatKES } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { useActiveBusiness } from '@/stores/business';

type Period = '7' | '14' | '30';

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
];

const METHOD_LABEL: Record<string, string> = {
  'M-PESA': 'M-Pesa',
  MPESA: 'M-Pesa',
  CASH: 'Cash',
  BANK: 'Bank',
  CARD: 'Card',
  CREDIT: 'On credit',
};

const RANK_BADGE = [
  'bg-amber-100 text-amber-800 [.dark_&]:bg-amber-500/20 [.dark_&]:text-amber-300',
  'bg-slate-200 text-slate-700 [.dark_&]:bg-slate-500/25 [.dark_&]:text-slate-300',
  'bg-orange-100 text-orange-800 [.dark_&]:bg-orange-500/20 [.dark_&]:text-orange-300',
];

/** Desktop reports (lg and up): period overview with KPI cards, daily revenue, best sellers and a figures panel. */
export function DesktopReportsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const business = useActiveBusiness();
  const { canApprove, canManage } = useRole();
  const [period, setPeriod] = useState<Period>('30');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const n = Number(period);
  const { from, to } = periodRange(n);

  const pl = useQuery({
    queryKey: ['reports', 'profit-loss', from, to],
    queryFn: () => reportsApi.profitLoss({ from, to }),
    enabled: canApprove,
  });
  const history = useQuery({
    queryKey: ['daily-report-history', to, n],
    queryFn: () => reportsApi.dayHistory(n, to),
    enabled: canApprove,
  });
  const products = useQuery({
    queryKey: ['reports', 'products', from, to],
    queryFn: () => reportsApi.productPerformance({ from, to, limit: 8 }),
    enabled: canApprove,
  });
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });
  const customers = useQuery({
    queryKey: ['customers', 'count'],
    queryFn: () => customersApi.list({ page: 1, limit: 1 }),
  });
  const members = useQuery({
    queryKey: ['business', business?.id, 'members'],
    queryFn: () => businessesApi.members(),
    enabled: canManage && Boolean(business?.id),
  });

  const firstName = user?.fullName?.split(' ')[0] ?? 'there';
  const p = pl.data;
  const expensesTotal = (history.data ?? []).reduce((sum, r) => sum + r.expenses, 0);
  const points = (history.data ?? []).map((r) => ({ label: chartDayLabel(r.date), value: Math.max(0, r.revenue) }));
  const rows = products.data ?? [];
  const topRevenue = Math.max(...rows.map((r) => r.revenue), 0);
  const methods = (p?.revenueByMethod ?? [])
    .map((m) => ({ label: METHOD_LABEL[m.method] ?? m.method, value: m.total }))
    .sort((a, b) => a.value - b.value);
  const roles = (members.data ?? []).reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {});

  const downloadPl = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await reportsApi.download('profit-loss/export.xlsx', { from, to }, `profit-loss-${from}-to-${to}.xlsx`);
    } catch (err) {
      setDownloadError(apiErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  if (!canApprove) {
    return (
      <div className="rounded-md border border-edge bg-surface">
        <TableEmpty title="Reports are for admins" description="Ask an owner, manager or accountant to share the figures." />
      </div>
    );
  }

  const error = pl.error ?? history.error ?? products.error;

  return (
    <RailLayout
      rail={
        <>
          <RailStat
            label="Customers"
            value={customers.data?.total ?? '—'}
            note={
              dashboard.data
                ? `${dashboard.data.recentCustomers.filter((c) => c.outstanding_balance > 0).length} recent with balances`
                : undefined
            }
          />
          <RailStat
            label="Owed by customers"
            value={dashboard.data ? formatKES(dashboard.data.outstandingDebts) : '—'}
            note="Credit sales awaiting payment"
          />
          <RailBars title="Payment methods" rows={methods} format={formatKES} empty="No payments in this period." />
          {canManage && (
            <section className="px-5 py-6 text-center">
              <p className="text-[13.5px] text-foreground-2">People</p>
              <p className="mt-3 text-[19px] font-semibold tabular-nums text-foreground">{members.data?.length ?? '—'}</p>
              {members.data && (
                <p className="mt-2 text-[12.5px] text-foreground-4">
                  {Object.entries(roles)
                    .map(([role, count]) => `${count} ${role.toLowerCase()}${count === 1 ? '' : 's'}`)
                    .join(' · ')}
                </p>
              )}
              <Link to="/staff" className="mt-3 inline-block text-[12.5px] font-medium text-accent hover:underline">
                Manage team →
              </Link>
            </section>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Welcome back, {firstName}</h1>
            <p className="mt-1 text-[13px] text-foreground-3">
              How {business?.name ?? 'the business'} did over the {PERIODS.find((o) => o.value === period)?.label.toLowerCase()}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ToolbarSelect label="Period" value={period} onChange={setPeriod} options={PERIODS} />
            <ToolbarButton variant="outline" onClick={() => navigate('/reports?view=daily')}>
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              Daily report
            </ToolbarButton>
            <ToolbarButton onClick={() => void downloadPl()} disabled={downloading}>
              <FileDown className="h-3.5 w-3.5" aria-hidden />
              {downloading ? 'Preparing…' : 'Profit & loss'}
            </ToolbarButton>
          </div>
        </div>

        {(error || downloadError) && (
          <Alert variant="error" title="Something didn't load" inline>
            {downloadError ?? apiErrorMessage(error)}
          </Alert>
        )}

        <div className="grid grid-cols-3 gap-4">
          <KpiCard
            tone="blue"
            icon={Wallet}
            value={p ? formatKES(p.revenue) : '—'}
            label="Revenue"
            note={p ? `${p.salesCount} sales · avg ${formatKES(p.averageSaleValue)}` : 'Loading…'}
            to="/sales"
          />
          <KpiCard
            tone="green"
            icon={Coins}
            value={p ? formatKES(p.netProfit) : '—'}
            label="Net profit"
            note={p ? `${p.netMargin}% margin · gross ${formatKES(p.grossProfit)}` : 'Loading…'}
            to="/account"
          />
          <KpiCard
            tone="yellow"
            icon={ArrowLeftRight}
            value={formatKES(p?.operatingExpenses ?? expensesTotal)}
            label="Expenses"
            note={p ? `${p.revenue > 0 ? Math.round((p.operatingExpenses / p.revenue) * 100) : 0}% of revenue` : 'Loading…'}
            to="/expenses"
          />
        </div>

        <section className="rounded-md border border-edge bg-surface px-5 pb-3 pt-5">
          <h2 className="mb-5 text-[14px] font-medium text-foreground">Daily revenue</h2>
          <DailyChart points={points} format={formatKES} height="h-44" showGrid={false} />
        </section>

        <section className="overflow-hidden rounded-md border border-edge bg-surface">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="flex items-center gap-2 text-[14px] font-medium text-foreground">
              <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
              Best-selling products
            </h2>
            <span className="rounded-full bg-surface-3 px-2.5 py-0.5 text-[11.5px] text-foreground-3">
              {rows.length} product{rows.length === 1 ? '' : 's'}
            </span>
          </div>
          {rows.length === 0 ? (
            <div className="border-t border-edge">
              <TableEmpty
                title={products.isLoading ? 'Loading…' : 'No sales yet'}
                description={products.isLoading ? undefined : 'Products and packages sold in this period will rank here.'}
              />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-y border-edge bg-surface-2 text-left text-[12.5px] text-foreground-3">
                  <th className="w-12 py-2.5 pl-5 font-normal">#</th>
                  <th className="py-2.5 font-normal">Product</th>
                  <th className="py-2.5 font-normal">Status</th>
                  <th className="py-2.5 text-right font-normal">Sold</th>
                  <th className="w-56 py-2.5 text-right font-normal">Revenue</th>
                  <th className="py-2.5 pr-5 text-right font-normal">Profit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const margin = r.revenue > 0 ? Math.round((r.profit / r.revenue) * 100) : 0;
                  return (
                    <tr key={r.name} className="border-b border-edge/70 last:border-0">
                      <td className="py-3 pl-5">
                        <span
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-medium',
                            RANK_BADGE[i] ?? 'bg-surface-3 text-foreground-3',
                          )}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="py-3">
                        <p className="text-[13.5px] font-medium text-accent">{r.name}</p>
                        <p className="text-[11.5px] text-foreground-4">{margin}% margin</p>
                      </td>
                      <td className="py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11.5px] font-medium',
                            r.profit >= 0
                              ? 'bg-emerald-50 text-emerald-700 [.dark_&]:bg-emerald-500/15 [.dark_&]:text-emerald-300'
                              : 'bg-red-50 text-red-700 [.dark_&]:bg-red-500/15 [.dark_&]:text-red-300',
                          )}
                        >
                          {r.profit >= 0 ? 'Profitable' : 'Loss'}
                        </span>
                      </td>
                      <td className="py-3 text-right text-[13.5px] tabular-nums text-foreground-2">{Number(r.quantity)}</td>
                      <td className="py-3 text-right">
                        <p className="text-[13.5px] tabular-nums text-foreground-2">{formatKES(r.revenue)}</p>
                        <div className="ml-auto mt-1 h-1 w-24 overflow-hidden rounded-full bg-edge">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${topRevenue ? (r.revenue / topRevenue) * 100 : 0}%` }}
                          />
                        </div>
                      </td>
                      <td
                        className={cn(
                          'py-3 pr-5 text-right text-[13.5px] font-semibold tabular-nums',
                          r.profit >= 0 ? 'text-accent' : 'text-red-600',
                        )}
                      >
                        {formatKES(r.profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </RailLayout>
  );
}
