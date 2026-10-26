import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderX } from 'lucide-react';
import { budgetsApi, dashboardApi, reportsApi } from '@/api/endpoints';
import { DailyChart, chartDayLabel } from '@/components/desktop/daily-chart';
import { ToolbarSelect } from '@/components/desktop/list-toolbar';
import { RailButton, RailHeader, RailStat } from '@/components/desktop/side-rail';
import { cn, formatKES } from '@/lib/utils';

export type OverviewDays = '7' | '14' | '30';
type Metric = 'expenses' | 'revenue' | 'net';

const DAY_OPTIONS: Array<{ value: OverviewDays; label: string }> = [
  { value: '7', label: 'Last 7 Days' },
  { value: '14', label: 'Last 14 Days' },
  { value: '30', label: 'Last 30 Days' },
];

const METRIC_OPTIONS: Array<{ value: Metric; label: string }> = [
  { value: 'expenses', label: 'KES Expenses' },
  { value: 'revenue', label: 'KES Revenue' },
  { value: 'net', label: 'KES Net profit' },
];

const isoDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' });
const DAY = 86_400_000;

/** From/to (YYYY-MM-DD, Nairobi) covering the last `days` days including today. */
export function periodRange(days: number) {
  return { from: isoDay.format(new Date(Date.now() - (days - 1) * DAY)), to: isoDay.format(new Date()) };
}

/**
 * Desktop expenses dashboard (approvers only: it reads the reports API):
 * daily chart for the period, then categories, approvals and budget alerts.
 */
export function ExpensesOverview({
  days,
  onDaysChange,
  onShowPending,
}: {
  days: OverviewDays;
  onDaysChange: (days: OverviewDays) => void;
  onShowPending: () => void;
}) {
  const [metric, setMetric] = useState<Metric>('expenses');
  const n = Number(days);
  const { from, to } = periodRange(n);

  const history = useQuery({
    queryKey: ['daily-report-history', to, n],
    queryFn: () => reportsApi.dayHistory(n, to),
  });
  const byCategory = useQuery({
    queryKey: ['reports', 'expenses', from, to],
    queryFn: () => reportsApi.expenseSummary({ from, to }),
  });
  const budgets = useQuery({ queryKey: ['budgets', 'status', 'current'], queryFn: () => budgetsApi.status() });
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });

  const rows = history.data ?? [];
  const points = rows.map((r) => ({
    label: chartDayLabel(r.date),
    value: Math.max(0, metric === 'expenses' ? r.expenses : metric === 'revenue' ? r.revenue : r.net),
  }));
  const total = rows.reduce(
    (sum, r) => sum + (metric === 'expenses' ? r.expenses : metric === 'revenue' ? r.revenue : r.net),
    0,
  );

  const categories = [...(byCategory.data ?? [])].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const categoryMax = Math.max(...categories.map((c) => c.amount), 0);
  const alerts = (budgets.data?.items ?? []).filter((b) => b.level !== 'OK');
  const pending = dashboard.data?.pendingApprovals ?? 0;

  return (
    <div className="-mx-6 -mt-6 mb-6 border-b border-edge bg-surface">
      <div className="px-6 pt-5">
        <ToolbarSelect label="Period" value={days} onChange={onDaysChange} options={DAY_OPTIONS} />
      </div>

      <div className="mx-auto max-w-4xl px-6 pb-4 pt-6">
        <div className="flex flex-col items-center">
          <ToolbarSelect label="Figure" value={metric} onChange={setMetric} options={METRIC_OPTIONS} />
          <p
            className={cn(
              'mt-1 text-[28px] font-normal tabular-nums text-foreground',
              metric === 'net' && total < 0 && 'text-red-600',
            )}
          >
            {history.isLoading ? '—' : total.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="mt-6">
          <DailyChart points={points} format={formatKES} barClass={metric === 'expenses' ? 'bg-red-500' : 'bg-accent'} />
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-edge border-t border-edge">
        <StripCell title="Top categories">
          {categories.length === 0 || categoryMax === 0 ? (
            <StripEmpty title="No expenses" note="There are no approved expenses in this date range." />
          ) : (
            <ul className="space-y-3">
              {categories.map((c) => (
                <li key={c.category}>
                  <div className="flex justify-between text-[12.5px]">
                    <span className="truncate text-foreground-2">{c.category}</span>
                    <span className="tabular-nums text-foreground-4">{formatKES(c.amount)}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-edge">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${(c.amount / categoryMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </StripCell>
        <StripCell title="Awaiting approval">
          {pending === 0 ? (
            <StripEmpty title="All reviewed" note="No expenses are waiting for approval." />
          ) : (
            <div className="flex flex-col items-center py-2 text-center">
              <p className="text-[34px] font-normal tabular-nums text-amber-600">{pending}</p>
              <p className="text-[12.5px] text-foreground-4">expense{pending === 1 ? '' : 's'} to review</p>
              <button
                type="button"
                onClick={onShowPending}
                className="mt-3 h-8 rounded-md bg-accent px-4 text-[12.5px] font-medium text-white hover:bg-accent-strong"
              >
                Review now
              </button>
            </div>
          )}
        </StripCell>
        <StripCell title="Budget alerts">
          {alerts.length === 0 ? (
            <StripEmpty
              title="On budget"
              note={(budgets.data?.items.length ?? 0) > 0 ? 'Every category is within its limit.' : 'No budgets set this month.'}
            />
          ) : (
            <ul className="space-y-2">
              {alerts.slice(0, 4).map((b) => (
                <li key={b.id} className="flex items-center justify-between text-[12.5px]">
                  <span className="truncate text-foreground-2">{b.category_name}</span>
                  <span className={cn('tabular-nums', b.percent >= 100 ? 'text-red-600' : 'text-amber-600')}>
                    {b.percent}% used
                  </span>
                </li>
              ))}
            </ul>
          )}
        </StripCell>
      </div>
    </div>
  );
}

/** Right-hand figures for the expenses page. */
export function ExpensesRail({ days, onShowPending }: { days: OverviewDays; onShowPending: () => void }) {
  const n = Number(days);
  const { to } = periodRange(n);
  const history = useQuery({
    queryKey: ['daily-report-history', to, n],
    queryFn: () => reportsApi.dayHistory(n, to),
  });
  const budgets = useQuery({ queryKey: ['budgets', 'status', 'current'], queryFn: () => budgetsApi.status() });
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });

  const spent = (history.data ?? []).reduce((sum, r) => sum + r.expenses, 0);
  const items = budgets.data?.items ?? [];
  const remaining = items.reduce((sum, b) => sum + b.remaining, 0);
  const pending = dashboard.data?.pendingApprovals ?? 0;

  return (
    <>
      <RailHeader>KES</RailHeader>
      <RailStat
        label="Spent"
        value={formatKES(spent)}
        note={DAY_OPTIONS.find((o) => o.value === days)?.label}
      />
      <RailStat
        label="Awaiting approval"
        value={pending}
        note={pending === 0 ? 'Nothing to review' : `expense${pending === 1 ? '' : 's'} submitted by staff`}
        action={pending > 0 ? <RailButton onClick={onShowPending}>Review</RailButton> : undefined}
      />
      <RailStat
        label="Budget left"
        value={items.length ? formatKES(remaining) : '—'}
        note={items.length ? 'This month, all categories' : 'No budgets set'}
        tone={items.length && remaining < 0 ? 'red' : undefined}
      />
    </>
  );
}

function StripCell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-5">
      <h2 className="mb-4 text-[16px] font-normal text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function StripEmpty({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-col items-center py-3 text-center">
      <FolderX className="h-8 w-8 text-accent" strokeWidth={1.5} aria-hidden />
      <p className="mt-3 text-[15px] text-foreground-2">{title}</p>
      <p className="mt-1 text-[12.5px] text-foreground-3">{note}</p>
    </div>
  );
}
