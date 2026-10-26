import * as React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Flag, FolderX, PieChart, Plus, ShoppingCart, Wallet } from 'lucide-react';
import type { DashboardData } from '@/api/types';
import { budgetsApi } from '@/api/endpoints';
import { KpiCard } from '@/components/desktop/kpi-card';
import { useRole } from '@/hooks/use-role';
import { AdvertBanner } from '@/components/brand/advert-banner';
import { cn, formatKES, formatTime } from '@/lib/utils';

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function dayLabel(date: string): string {
  return new Date(`${date.slice(0, 10)}T12:00:00+03:00`).toLocaleDateString('en-KE', {
    timeZone: 'Africa/Nairobi',
    day: 'numeric',
    month: 'short',
  });
}

/** Desktop-only dashboard (lg and up), Command Center style. Phones use the stacked mobile dashboard. */
export function DesktopDashboard({ data }: { data: DashboardData }) {
  const { canApprove } = useRole();
  const budgetsQuery = useQuery({
    queryKey: ['budgets', 'status', 'current'],
    queryFn: () => budgetsApi.status(),
  });
  const budgets = budgetsQuery.data?.items ?? [];
  const budgetLimit = budgets.reduce((acc, b) => acc + b.limit, 0);
  const budgetSpent = budgets.reduce((acc, b) => acc + b.spent, 0);
  const budgetUsed = pct(budgetSpent, budgetLimit);

  const { today } = data;
  const grossMargin = pct(today.grossProfit, today.sales);
  const debtors = data.recentCustomers.filter((c) => c.outstanding_balance > 0);
  const subs = data.subscribers ?? { active: 0, expiringSoon: 0, expired: 0 };
  const pkg = data.packagesToday ?? { count: 0, new: 0, renewals: 0, revenue: 0 };
  const callsDue = data.callsDue ?? 0;

  return (
    <div className="space-y-5 mt-8">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-[28px] font-normal tracking-tight text-foreground">Command Center</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/expenses?new=1"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-edge bg-surface px-3.5 text-[13px] font-medium text-foreground-2 transition-colors hover:bg-surface-2"
          >
            <Wallet className="h-4 w-4" aria-hidden />
            {canApprove ? 'Add expense' : 'Submit expense'}
          </Link>
          <Link
            to="/sales/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-accent-strong"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Record sale
          </Link>
        </div>
      </div>

      {/* Date scope chips (display only: the figures below are today / last 30 days) */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-edge bg-surface px-3 text-[12.5px] text-foreground-3">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          Filter by date
        </span>
        <span className="inline-flex h-8 items-center rounded-md border border-edge bg-surface px-3 text-[12.5px] text-foreground-3">
          Date is Today · Last 30 days
        </span>
        <span className="ml-auto inline-flex h-8 items-center rounded-md border border-edge bg-surface px-3 text-[12.5px] font-medium text-foreground-2">
          KES
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard tone="blue" icon={Wallet} value={formatKES(data.monthRevenue)} label="Revenue" note="Last 30 days" to="/reports" />
        <KpiCard
          tone="green"
          icon={ShoppingCart}
          value={formatKES(today.cashReceived)}
          label="Revenue received today"
          note={`${today.paymentCount} payment${today.paymentCount === 1 ? '' : 's'}`}
          to="/sales"
        />
        <KpiCard
          tone="yellow"
          icon={Flag}
          value={String(data.pendingApprovals)}
          label="Awaiting approval"
          note="Expenses to review"
          to="/expenses?status=PENDING"
        />
        <KpiCard
          tone="red"
          icon={PieChart}
          value={formatKES(today.expenses)}
          label="Expenses today"
          note={`Net ${formatKES(today.netProfit)}`}
          to="/expenses"
        />
      </div>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
        <RevenueTrend series={data.salesSeries} month={data.monthRevenue} week={data.weekRevenue} />
        <SubscriberPanel subs={subs} packages={pkg} callsDue={callsDue} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <TodayPanel today={today} />
        <Panel title="Gross margin today">
          {today.sales > 0 ? (
            <Donut value={grossMargin} color="#198754" caption="of sales today" />
          ) : (
            <MiniEmpty title="No sales" note="There are no sales yet today." />
          )}
        </Panel>
        <Panel title="Budget used this month">
          {budgetLimit > 0 ? (
            <Donut
              value={budgetUsed}
              color={budgetUsed > 100 ? '#DC3545' : '#0D6EFD'}
              caption={`${formatKES(budgetSpent)} of ${formatKES(budgetLimit)}`}
            />
          ) : (
            <MiniEmpty title="No budgets" note={budgetsQuery.isLoading ? 'Loading…' : 'Set monthly limits on Budgets.'} />
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4">
        <ActivityPanel data={data} />
        <AlertsPanel data={data} debtorCount={debtors.length} callsDue={callsDue} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Panel
          title="Revenue by product (30 days)"
          action={
            <Link to="/reports" className="hover:underline">
              Reports
            </Link>
          }
        >
          <RevenueBreakdown products={data.topProducts} />
        </Panel>
        <Panel
          title="Products & budgets"
          action={
            <div className="flex gap-4">
              <Link to="/products" className="hover:underline">
                Products
              </Link>
              <Link to="/budgets" className="hover:underline">
                Budgets
              </Link>
            </div>
          }
        >
          <MiniTable
            headers={['Product', 'Sold', 'Revenue']}
            rows={data.topProducts.slice(0, 4).map((p) => [p.name, String(Number(p.quantity)), formatKES(Number(p.revenue))])}
            empty="No sales in the last 30 days."
          />
          <div className="mt-4 border-t border-edge pt-3">
            <MiniTable
              headers={['Budget', 'Spent', 'Used']}
              rows={budgets.slice(0, 4).map((b) => [b.category_name, formatKES(b.spent), `${b.percent}%`])}
              highlight={budgets.slice(0, 4).map((b) => b.level !== 'OK')}
              empty={budgetsQuery.isLoading ? 'Loading…' : 'No budgets set.'}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** Daily revenue line graph for the last 30 days, with week and month totals. */
function RevenueTrend({ series, month, week }: { series: DashboardData['salesSeries']; month: number; week: number }) {
  const points = series.map((p) => ({ date: p.date, total: Number(p.total) }));
  const max = Math.max(...points.map((p) => p.total), 0);
  // Line graph coordinates in a 600x200 box (10px top padding)
  const step = points.length > 1 ? 600 / (points.length - 1) : 600;
  const coords = points.map((p, i) => [i * step, 200 - (max > 0 ? (p.total / max) * 180 : 0) - 10] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L600,200 L0,200 Z`;
  return (
    <Panel
      title="Revenue trend"
      action={
        <Link to="/reports" className="hover:underline">
          Full report
        </Link>
      }
    >
      <div className="mb-5 flex items-end gap-10">
        <div>
          <p className="text-[12px] text-foreground-4">Last 30 days</p>
          <p className="mt-0.5 text-[22px] font-semibold tabular-nums text-foreground">{formatKES(month)}</p>
        </div>
        <div>
          <p className="text-[12px] text-foreground-4">This week</p>
          <p className="mt-0.5 text-[22px] font-semibold tabular-nums text-foreground">{formatKES(week)}</p>
        </div>
      </div>
      {points.length === 0 || max <= 0 ? (
        <MiniEmpty title="No revenue yet" note="Daily revenue will chart here once sales are recorded." />
      ) : (
        <>
          <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="h-48 w-full overflow-visible" role="img" aria-label="Daily revenue, last 30 days">
            <defs>
              <linearGradient id="revenue-trend-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3A8F91" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#3A8F91" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1="0" x2="600" y1={200 * f} y2={200 * f} stroke="currentColor" strokeOpacity={0.08} vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} fill="url(#revenue-trend-fill)" />
            <path d={line} fill="none" stroke="#3A8F91" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="mt-2 flex justify-between text-[11px] text-foreground-4">
            <span>{dayLabel(points[0].date)}</span>
            <span>{dayLabel(points[points.length - 1].date)}</span>
          </div>
        </>
      )}
    </Panel>
  );
}

function SubscriberPanel({
  subs,
  packages,
  callsDue,
}: {
  subs: NonNullable<DashboardData['subscribers']>;
  packages: NonNullable<DashboardData['packagesToday']>;
  callsDue: number;
}) {
  const tiles = [
    { label: 'Active', value: subs.active, text: 'text-emerald-600 [.dark_&]:text-emerald-400' },
    { label: 'Expiring', value: subs.expiringSoon, text: 'text-amber-600 [.dark_&]:text-amber-400' },
    { label: 'Expired', value: subs.expired, text: 'text-red-600 [.dark_&]:text-red-400' },
  ];
  return (
    <Panel
      title="Subscribers"
      action={
        <Link to="/subscribers" className="hover:underline">
          See all
        </Link>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-md bg-surface-2 px-2 py-3 text-center">
            <p className={cn('text-[20px] font-semibold tabular-nums', t.text)}>{t.value}</p>
            <p className="mt-0.5 text-[11.5px] text-foreground-4">{t.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-1 text-[12.5px]">
        <StatRow label="Packages sold today" value={String(packages.count)} />
        <StatRow label="New / renewals today" value={`${packages.new} / ${packages.renewals}`} />
        <StatRow label="Package revenue today" value={formatKES(packages.revenue)} />
        <StatRow label="Calls due today" value={String(callsDue)} to="/calls" />
      </div>
      {/* Paybill advert, below Calls due today */}
      <AdvertBanner className="mt-4 rounded-md" />
    </Panel>
  );
}

function StatRow({ label, value, to }: { label: string; value: string; to?: string }) {
  const inner = (
    <>
      <span className="text-foreground-3">{label}</span>
      <span className="font-medium tabular-nums text-foreground-2">{value}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2">
        {inner}
      </Link>
    );
  }
  return <div className="flex items-center justify-between px-2 py-1.5">{inner}</div>;
}

/** Today's money: sales, gross profit, expenses and net, as comparable bars. */
function TodayPanel({ today }: { today: DashboardData['today'] }) {
  const rows = [
    { label: 'Cash received', value: today.cashReceived, bar: 'bg-blue-500', text: 'text-foreground' },
    { label: 'Sales', value: today.sales, bar: 'bg-emerald-500', text: 'text-foreground' },
    { label: 'Gross profit', value: today.grossProfit, bar: 'bg-accent', text: 'text-foreground' },
    { label: 'Expenses', value: today.expenses, bar: 'bg-red-500', text: 'text-foreground' },
    {
      label: 'Net profit',
      value: today.netProfit,
      bar: today.netProfit < 0 ? 'bg-red-500' : 'bg-emerald-500',
      text: today.netProfit < 0 ? 'text-red-600 [.dark_&]:text-red-400' : 'text-foreground',
    },
  ];
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 0);
  return (
    <Panel title="Today's money">
      <ul className="space-y-3.5">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-foreground-3">{r.label}</span>
              <span className={cn('font-medium tabular-nums', r.text)}>{formatKES(r.value)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className={cn('h-full rounded-full', r.bar)} style={{ width: `${max > 0 ? Math.round((Math.abs(r.value) / max) * 100) : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Things that need a decision or a call, each linking to where it is handled. */
function AlertsPanel({ data, debtorCount, callsDue }: { data: DashboardData; debtorCount: number; callsDue: number }) {
  type Tone = 'red' | 'amber' | 'violet';
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const rows: Array<{ key: string; text: string; to: string; tone: Tone }> = [
    ...data.budgetAlerts.slice(0, 3).map((b) => ({
      key: `budget-${b.category_name}`,
      text: `${b.category_name} budget at ${b.percent}%`,
      to: '/budgets',
      tone: 'red' as const,
    })),
    ...(data.pendingApprovals > 0
      ? [{ key: 'approvals', text: `${plural(data.pendingApprovals, 'expense')} awaiting approval`, to: '/expenses?status=PENDING', tone: 'amber' as const }]
      : []),
    ...(debtorCount > 0
      ? [{ key: 'debts', text: `${plural(debtorCount, 'customer')} owe ${formatKES(data.outstandingDebts)}`, to: '/customers', tone: 'red' as const }]
      : []),
    ...(data.lowStock > 0 ? [{ key: 'stock', text: `${plural(data.lowStock, 'product')} low on stock`, to: '/products', tone: 'amber' as const }] : []),
    ...(callsDue > 0 ? [{ key: 'calls', text: `${plural(callsDue, 'call')} due today`, to: '/calls', tone: 'violet' as const }] : []),
  ];
  const dot: Record<Tone, string> = { red: 'bg-red-500', amber: 'bg-amber-500', violet: 'bg-violet-500' };

  return (
    <Panel title="Needs attention">
      {rows.length === 0 ? (
        <MiniEmpty title="All clear" note="Nothing needs your attention right now." />
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.key}>
              <Link to={r.to} className="flex items-center gap-3 rounded-md px-2 py-2 text-[13px] text-foreground-2 transition-colors hover:bg-surface-2">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot[r.tone])} aria-hidden />
                <span className="truncate">{r.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Horizontal bars of the top products' 30-day revenue (CSS bars, no chart library). */
function RevenueBreakdown({ products }: { products: DashboardData['topProducts'] }) {
  const rows = products.slice(0, 6).map((p) => ({ name: p.name, revenue: Number(p.revenue) }));
  const max = Math.max(...rows.map((r) => r.revenue), 0);

  if (max <= 0) {
    return <MiniEmpty title="No revenue" note="There's no revenue for this date range. Recorded sales will show up here." />;
  }

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.name} className="grid grid-cols-[11rem_minmax(0,1fr)_7rem] items-center gap-3">
          <p className="truncate text-[12.5px] text-foreground-3">{row.name}</p>
          <div className="h-5 overflow-hidden rounded-sm bg-surface-2">
            <div className="h-full rounded-sm bg-accent" style={{ width: `${Math.max(2, Math.round((row.revenue / max) * 100))}%` }} />
          </div>
          <p className="text-right text-[12.5px] font-medium tabular-nums text-foreground-2">{formatKES(row.revenue)}</p>
        </div>
      ))}
    </div>
  );
}

/** Small centred empty state used inside dashboard panels. */
function MiniEmpty({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <FolderX className="h-8 w-8 text-accent" strokeWidth={1.5} aria-hidden />
      <p className="mt-2 text-[15px] text-foreground-2">{title}</p>
      <p className="mt-1 max-w-[15rem] text-[12.5px] text-foreground-3">{note}</p>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-edge bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-medium text-foreground">{title}</h2>
        {action && <div className="text-[12px] font-medium text-accent">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function ActivityPanel({ data }: { data: DashboardData }) {
  const rows = data.recentTransactions.slice(0, 6);
  return (
    <Panel
      title="Recent activity"
      action={
        <Link to="/sales" className="hover:underline">
          All sales
        </Link>
      }
    >
      {rows.length === 0 ? (
        <MiniEmpty title="No transactions found" note="Sales and approved expenses will show up here." />
      ) : (
        <ul>
          {rows.map((t) => {
            const isSale = t.type === 'SALE';
            return (
              <li key={`${t.type}-${t.id}`} className="border-b border-edge/70 last:border-0">
                <Link
                  to={isSale ? `/sales/${t.id}` : '/expenses'}
                  className="grid grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-3 px-1 py-2.5 text-[13px] transition-colors hover:bg-surface-2"
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', isSale ? 'bg-emerald-500' : 'bg-red-500')} aria-hidden />
                  <span className="truncate text-foreground-2">{t.description}</span>
                  <span className="truncate text-foreground-4">
                    {isSale ? (t.customerName ?? 'Walk-in') : 'Expense'} · {formatTime(t.createdAt)}
                  </span>
                  <span className={cn('text-right font-medium tabular-nums', isSale ? 'text-foreground' : 'text-red-600 [.dark_&]:text-red-400')}>
                    {isSale ? '' : '−'}
                    {formatKES(t.amount)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Donut({ value, color, caption }: { value: number; color: string; caption: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(100, value));
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 88 88" className="h-24 w-24 -rotate-90" role="img" aria-label={`${value}%`}>
        <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth="9" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(shown / 100) * c} ${c}`} />
        <text x="44" y="48" textAnchor="middle" className="rotate-90 fill-foreground font-semibold" style={{ transformOrigin: '44px 44px', fontSize: 15 }}>
          {value}%
        </text>
      </svg>
      <figcaption className="mt-1 text-center text-[12px] text-foreground-4">{caption}</figcaption>
    </figure>
  );
}

function MiniTable({ headers, rows, highlight, empty }: { headers: string[]; rows: string[][]; highlight?: boolean[]; empty: string }) {
  if (rows.length === 0) return <p className="py-4 text-center text-[12.5px] text-foreground-4">{empty}</p>;
  return (
    <table className="w-full table-fixed text-[12.5px]">
      <thead>
        <tr className="border-b border-edge text-left text-foreground-4">
          {headers.map((h, i) => (
            <th key={h} className={cn('pb-1.5 font-normal', i > 0 && 'w-20 text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={row.join('|')} className={cn('border-b border-edge/60 last:border-0', highlight?.[i] ? 'text-red-600 [.dark_&]:text-red-400' : 'text-foreground-2')}>
            {row.map((cell, j) => (
              <td key={j} className={cn('truncate py-2', j > 0 && 'text-right tabular-nums', j === 0 && 'font-medium')}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
