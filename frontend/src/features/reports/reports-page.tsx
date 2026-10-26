import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  ChevronDown,
  CreditCard,
  Download,
  FileSpreadsheet,
  Landmark,
  Receipt,
  RefreshCw,
  Smartphone,
  TrendingUp,
  UserPlus,
  Wallet,
  Wifi,
  X,
} from 'lucide-react';
import { reportsApi, type DailyReport, type ReportPeriod } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { PageLoader } from '@/components/ui/spinner';
import { WhatsAppIcon } from '@/components/brand/whatsapp-icon';
import { cn, formatKES } from '@/lib/utils';
import { barColor, barStripes } from '@/lib/chart-colors';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { DesktopReportsPage } from './desktop-reports-page';

const TZ = 'Africa/Nairobi';
const isoDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const DAY = 86_400_000;

/** YYYY-MM-DD in Nairobi, `offset` days from today. */
function nairobiDay(offset = 0): string {
  return isoDay.format(new Date(Date.now() + offset * DAY));
}

/** "Today", "Yesterday" or "Fri 10 Oct". */
function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  const d = new Date(`${date}T12:00:00+03:00`);
  if (isoDay.format(new Date(d.getTime() + DAY)) === today) return 'Yesterday';
  return d.toLocaleDateString('en-KE', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
}

function shortDay(date: string): { weekday: string; day: string } {
  const d = new Date(`${date}T12:00:00+03:00`);
  return {
    weekday: d.toLocaleDateString('en-KE', { timeZone: TZ, weekday: 'short' }),
    day: d.toLocaleDateString('en-KE', { timeZone: TZ, day: 'numeric' }),
  };
}

/** Tabs, titles and how many periods the picker and chart show. */
const PERIODS: Record<ReportPeriod, { tab: string; title: string; unit: string; count: number; chart: string }> = {
  day: { tab: 'Daily', title: 'Daily report', unit: 'day', count: 7, chart: 'last 7 days' },
  week: { tab: 'Weekly', title: 'Weekly report', unit: 'week', count: 8, chart: 'last 8 weeks' },
  month: { tab: 'Monthly', title: 'Monthly report', unit: 'month', count: 12, chart: 'last 12 months' },
  year: { tab: 'Yearly', title: 'Yearly report', unit: 'year', count: 5, chart: 'last 5 years' },
};
const PERIOD_ORDER: ReportPeriod[] = ['day', 'week', 'month', 'year'];

function isPeriod(value: string | null): value is ReportPeriod {
  return value === 'day' || value === 'week' || value === 'month' || value === 'year';
}

/** First day (YYYY-MM-DD) of the period containing `date`; weeks start on Monday. */
function periodStart(date: string, period: ReportPeriod): string {
  if (period === 'day') return date;
  if (period === 'month') return `${date.slice(0, 7)}-01`;
  if (period === 'year') return `${date.slice(0, 4)}-01-01`;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const fmtDay = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T12:00:00+03:00`).toLocaleDateString('en-KE', { timeZone: TZ, ...opts });

/** "Today", "This week", "Last month", "Week of 6 Oct", "October 2026", "2025"… */
function periodLabel(date: string, period: ReportPeriod, today: string): string {
  if (period === 'day') return dayLabel(date, today);
  const start = periodStart(date, period);
  const current = periodStart(today, period);
  if (start === current) return `This ${period}`;
  // The day before this period starts lies in the previous period
  const prevOfCurrent = periodStart(new Date(new Date(`${current}T00:00:00Z`).getTime() - DAY).toISOString().slice(0, 10), period);
  if (start === prevOfCurrent) return `Last ${period}`;
  if (period === 'week') return `Week of ${fmtDay(start, { day: 'numeric', month: 'short' })}`;
  if (period === 'month') return fmtDay(start, { month: 'long', year: 'numeric' });
  return start.slice(0, 4);
}

/** Two short lines for a picker chip. */
function chipText(date: string, period: ReportPeriod, today: string): { top: string; main: string } {
  if (period === 'day') {
    const { weekday, day } = shortDay(date);
    return { top: date === today ? 'Today' : weekday, main: day };
  }
  if (period === 'week') return { top: 'Week', main: fmtDay(date, { day: 'numeric', month: 'short' }) };
  if (period === 'month') return { top: date.slice(0, 4), main: fmtDay(date, { month: 'short' }) };
  return { top: 'Year', main: date.slice(0, 4) };
}

function updatedText(r: DailyReport): string {
  if (r.closed) return r.period && r.period !== 'day' ? `Final · this ${r.period} has ended` : 'Final · closed at midnight';
  const mins = Math.max(0, Math.round((Date.now() - new Date(r.generatedAt).getTime()) / 60000));
  return mins < 1 ? 'Live · updated just now' : `Live · updated ${mins} min ago`;
}

/** Plain-text summary for WhatsApp. */
function summaryText(r: DailyReport, label: string): string {
  const period = r.period ?? 'day';
  const lines = [
    `*Knoxville ${PERIODS[period].tab.toLowerCase()} report: ${label} (from ${r.date})*`,
    r.closed ? '' : `_So far this ${period === 'day' ? 'day' : period}_`,
    '',
    `Revenue: ${formatKES(r.revenue.total)} (${r.revenue.salesCount} sales)`,
    `Collected: ${formatKES(r.revenue.collected)}`,
    `Expenses: ${formatKES(r.expenses.total)}${r.expenses.pendingCount ? ` (+${r.expenses.pendingCount} awaiting approval)` : ''}`,
    `Net profit: ${formatKES(r.profit.net)}`,
    `Cash in hand: ${formatKES(r.cash.net)}`,
    '',
    `WiFi packages: ${r.packages.sold} sold, ${r.packages.newSubscribers} new, ${r.packages.renewals} renewals`,
    `Subscribers: ${r.subscribers.active} active, ${r.subscribers.expiring} expiring, ${r.subscribers.expired} expired`,
    `Owed by clients: ${formatKES(r.debts.outstanding)} (${r.debts.debtors})`,
  ];
  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n');
}

const METHOD_STYLE: Record<string, { label: string; icon: typeof Wallet; tint: string; ink: string }> = {
  'M-PESA': { label: 'M-Pesa', icon: Smartphone, tint: '#DCEFD9', ink: '#2DA043' },
  CASH: { label: 'Cash', icon: Banknote, tint: '#F3EAD3', ink: '#B7791F' },
  BANK: { label: 'Bank', icon: Landmark, tint: '#DDE4F3', ink: '#3B5BA9' },
  CARD: { label: 'Card', icon: CreditCard, tint: '#EADDF3', ink: '#7E3BA9' },
  CREDIT: { label: 'On credit', icon: Receipt, tint: '#F3DDDD', ink: '#C0392B' },
};

/**
 * Business report by day, week (Monday to Sunday), month or year (Nairobi
 * time). The current period is live; any past one can be opened, shared on
 * WhatsApp or downloaded as a PDF or Excel workbook.
 */
export function ReportsPage() {
  const isDesktop = useIsDesktop();
  const [searchParams] = useSearchParams();
  // Desktop opens the period overview; ?view=daily (or phones) opens the daily report
  if (isDesktop && searchParams.get('view') !== 'daily') return <DesktopReportsPage />;
  return <DailyReportPage />;
}

function DailyReportPage() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const today = nairobiDay();
  // ?date=YYYY-MM-DD opens that day (e.g. from the "Yesterday's report" notification)
  const [searchParams] = useSearchParams();
  // ?period=week|month|year opens that view; daily by default
  const [period, setPeriod] = useState<ReportPeriod>(() => {
    const wanted = searchParams.get('period');
    return isPeriod(wanted) ? wanted : 'day';
  });
  const cfg = PERIODS[period];
  const [date, setDate] = useState(() => {
    const wanted = searchParams.get('date');
    return wanted && /^\d{4}-\d{2}-\d{2}$/.test(wanted) && wanted <= today ? wanted : today;
  });
  const selectedStart = periodStart(date, period);
  const isCurrent = selectedStart === periodStart(today, period);
  const choosePeriod = (next: ReportPeriod) => {
    setPeriod(next);
    setDate(today);
  };
  const [downloading, setDownloading] = useState<'pdf' | 'xlsx' | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const report = useQuery({
    queryKey: ['daily-report', period, selectedStart],
    queryFn: () => reportsApi.day(selectedStart, period),
    refetchInterval: isCurrent ? 60_000 : false,
  });
  const history = useQuery({
    queryKey: ['daily-report-history', period, today],
    queryFn: () => reportsApi.dayHistory(cfg.count, today, period),
  });
  const r = report.data;
  const label = periodLabel(date, period, today);

  const download = async (format: 'pdf' | 'xlsx') => {
    setDownloading(format);
    setDownloadError(null);
    try {
      await reportsApi.download(
        `day/export.${format}`,
        { date: selectedStart, period },
        `${cfg.tab.toLowerCase()}-report-${selectedStart}.${format}`,
      );
    } catch (err) {
      setDownloadError(apiErrorMessage(err));
    } finally {
      setDownloading(null);
    }
  };

  const change = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null);

  return (
    <div className="space-y-5 pb-10">
      {/* Title sits dead centre regardless of the buttons either side */}
      <header className="page-head relative flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(isDesktop ? '/reports' : '/dashboard')}
          className="flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-[15px] font-semibold text-foreground-2 transition-transform active:scale-95 active:opacity-60"
          aria-label="Back"
        >
          Back
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[22px] font-semibold leading-tight tracking-tight text-foreground">
          {cfg.title}
        </h1>
        <div className="ml-auto flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => void download('pdf')}
            disabled={Boolean(downloading) || !r}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-foreground active:scale-90 disabled:opacity-50"
            aria-label={`Download ${cfg.tab.toLowerCase()} report PDF`}
            title="Download PDF"
          >
            {downloading === 'pdf' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => void download('xlsx')}
            disabled={Boolean(downloading) || !r}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-foreground active:scale-90 disabled:opacity-50"
            aria-label={`Download ${cfg.tab.toLowerCase()} report Excel workbook`}
            title="Download Excel"
          >
            {downloading === 'xlsx' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Daily, weekly, monthly or yearly */}
      <div role="tablist" aria-label="Report period" className="grid grid-cols-4 gap-1 rounded-full bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.06)] [.dark_&]:bg-white/10">
        {PERIOD_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            onClick={() => choosePeriod(p)}
            className={cn(
              'h-9 rounded-full text-[13px] font-semibold transition-colors',
              period === p ? 'bg-[#1C1F1B] text-white [.dark_&]:bg-white [.dark_&]:text-[#1C1F1B]' : 'text-foreground-3',
            )}
          >
            {PERIODS[p].tab}
          </button>
        ))}
      </div>

      {/* Period picker: the most recent days, weeks, months or years */}
      <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
        {(history.data ?? []).slice().reverse().map((h) => {
          const { top: weekday, main: day } = chipText(h.date, period, today);
          const active = h.date === selectedStart;
          return (
            <button
              key={h.date}
              type="button"
              onClick={() => setDate(h.date)}
              className={cn(
                'flex h-16 shrink-0 flex-col items-center justify-center rounded-2xl text-center transition-colors',
                period === 'week' ? 'w-16' : 'w-14',
                active ? 'bg-[#1C1F1B] text-white [.dark_&]:bg-white [.dark_&]:text-[#1C1F1B]' : 'bg-white text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.06)] [.dark_&]:bg-white/10',
              )}
            >
              <span className={cn('text-[11px]', active ? 'opacity-70' : 'text-foreground-4')}>{weekday}</span>
              <span className={cn('font-semibold tabular-nums', period === 'week' ? 'text-[13px]' : 'text-[17px]')}>{day}</span>
            </button>
          );
        })}
        {period !== 'year' && (
          <label className="relative flex h-16 w-14 shrink-0 cursor-pointer flex-col items-center justify-center rounded-2xl bg-white text-[11px] text-foreground-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] [.dark_&]:bg-white/10">
            <ChevronDown className="h-4 w-4" aria-hidden />
            Older
            {period === 'month' ? (
              <input
                type="month"
                max={today.slice(0, 7)}
                value={date.slice(0, 7)}
                onChange={(e) => e.target.value && setDate(`${e.target.value}-01`)}
                className="absolute inset-0 opacity-0"
                aria-label="Pick a month"
              />
            ) : (
              <input
                type="date"
                max={today}
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="absolute inset-0 opacity-0"
                aria-label={period === 'week' ? 'Pick a day in the week' : 'Pick a day'}
              />
            )}
          </label>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white pl-3.5 pr-2 text-[13px] font-medium text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.06)] [.dark_&]:bg-white/10">
          {label}
          {!isCurrent && (
            <button type="button" onClick={() => setDate(today)} className="flex h-6 w-6 items-center justify-center rounded-full text-foreground-4" aria-label={period === 'day' ? 'Back to today' : `Back to this ${period}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
        {r && <span className="text-[12px] text-foreground-4">{updatedText(r)}</span>}
      </div>

        {report.error && <Alert variant="error" inline>{apiErrorMessage(report.error)}</Alert>}
        {downloadError && <Alert variant="error" inline>{downloadError}</Alert>}
      {report.isLoading && <PageLoader inline message="Loading" />}

      {r && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              tone="lavender"
              note={updatedText(r)}
              title="Revenue"
              count={r.revenue.salesCount}
              countLabel={r.revenue.salesCount === 1 ? 'Sale' : 'Sales'}
              more={{ label: 'Sales', to: '/sales' }}
            >
              <Tile label="Total revenue" sub="Generated" value={formatKES(r.revenue.total)} icon={TrendingUp} delta={change(r.revenue.total, r.previous.revenue)} versus={cfg.unit} />
              <Tile label="Collected" sub={r.revenue.unpaid ? `${r.revenue.unpaid} not fully paid` : 'All paid'} value={formatKES(r.revenue.collected)} icon={Wallet} />
            </Panel>

            <Panel tone="mint" note={updatedText(r)} title="Expenses" count={r.expenses.count} countLabel={r.expenses.count === 1 ? 'Item' : 'Items'} more={{ label: 'Expenses', to: '/expenses' }}>
              <Tile label="Total spent" sub="Approved" value={formatKES(r.expenses.total)} icon={Receipt} delta={change(r.expenses.total, r.previous.expenses)} versus={cfg.unit} invert />
              <Tile label="Awaiting approval" sub={`${r.expenses.pendingCount} pending`} value={formatKES(r.expenses.pendingTotal)} icon={RefreshCw} />
            </Panel>

            <Panel tone="sand" note={`${r.profit.margin}% of revenue kept`} title="Profit" count={r.profit.margin} countLabel="% margin">
              <Tile label="Net profit" sub="Revenue less costs" value={formatKES(r.profit.net)} icon={TrendingUp} delta={change(r.profit.net, r.previous.net)} versus={cfg.unit} />
              <Tile label="Cash in hand" sub="Collected less spent" value={formatKES(r.cash.net)} icon={Banknote} />
            </Panel>

            <Panel tone="sky" note={`${formatKES(r.packages.revenue)} from packages`} title="WiFi packages" count={r.packages.sold} countLabel="Sold" more={{ label: 'Subscribers', to: '/subscribers' }}>
              <Tile label="New subscribers" sub="First package" value={String(r.packages.newSubscribers)} icon={UserPlus} />
              <Tile label="Renewals" sub="Paid again" value={String(r.packages.renewals)} icon={RefreshCw} />
            </Panel>
          </div>

          {/* Recent periods: tap a bar to open that one */}
          {history.data && (
            <WeekChart rows={history.data} selected={selectedStart} period={period} today={today} title={`Revenue, ${cfg.chart}`} onSelect={setDate} />
          )}

          {/* Money in by method: side-scrolling cards */}
          <section>
            <SectionTitle title="Money in" right={formatKES(r.revenue.collected)} />
            {r.revenue.collectedByMethod.length === 0 ? (
              <p className="px-1 text-[13px] text-foreground-4">{period === 'day' ? 'No payments on this day.' : `No payments this ${period}.`}</p>
            ) : (
              <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4">
                {r.revenue.collectedByMethod.map((m) => {
                  const st = METHOD_STYLE[m.method] ?? { label: m.method, icon: Wallet, tint: '#E9ECEF', ink: '#495057' };
                  const Icon = st.icon;
                  return (
                    <div key={m.method} className="w-32 shrink-0 overflow-hidden rounded-3xl bg-[#F2F2F4] [.dark_&]:bg-[#1E1E1E]">
                      <div className="flex h-16 items-center justify-center" style={{ background: st.tint }}>
                        <Icon className="h-7 w-7" style={{ color: st.ink }} aria-hidden />
                      </div>
                      <div className="p-3 text-center">
                        <p className="text-[13px] font-semibold text-foreground">{st.label}</p>
                        <p className="text-[11px] text-foreground-4">{m.count} payment{m.count === 1 ? '' : 's'}</p>
                        <p className="mt-1 text-[14px] font-semibold tabular-nums text-foreground">{formatKES(m.total)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section>
              <SectionTitle title="Packages sold" right={`${r.packages.sold}`} />
              <Rows rows={r.packages.lines.map((p) => ({ key: p.name, left: `${p.quantity} × ${p.name}`, right: formatKES(p.revenue) }))} empty="No packages sold." />
              {r.products.length > 0 && (
                <>
                  <SectionTitle title="Products and services" right={`${r.products.length}`} className="mt-5" />
                  <Rows rows={r.products.map((p) => ({ key: p.name, left: `${p.quantity} × ${p.name}`, right: formatKES(p.revenue) }))} />
                </>
              )}
            </section>

            <section>
              <SectionTitle title="Spending by category" right={formatKES(r.expenses.total)} />
              {r.expenses.byCategory.length === 0 ? (
                <p className="px-1 text-[13px] text-foreground-4">No approved expenses.</p>
              ) : (
                <ul className="space-y-3 px-1">
                  {r.expenses.byCategory.map((c) => (
                    <li key={c.category}>
                      <div className="flex justify-between text-[13px]">
                        <span className="text-foreground-2">{c.category}</span>
                        <span className="font-medium tabular-nums text-foreground">{formatKES(c.amount)}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#F2F2F4] [.dark_&]:bg-white/10">
                        <div className="h-full rounded-full bg-[#E23B41]" style={{ width: `${Math.max(4, (c.amount / (r.expenses.total || 1)) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Subscribers and balances */}
          <section>
            <SectionTitle title="Subscribers" right={r.closed ? `At end of ${period === 'day' ? 'day' : period}` : 'Right now'} />
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Active', value: r.subscribers.active, cls: 'bg-emerald-50 text-emerald-700 [.dark_&]:bg-emerald-500/10 [.dark_&]:text-emerald-300' },
                { label: 'Expiring soon', value: r.subscribers.expiring, cls: 'bg-amber-50 text-amber-700 [.dark_&]:bg-amber-500/10 [.dark_&]:text-amber-300' },
                { label: 'Expired', value: r.subscribers.expired, cls: 'bg-red-50 text-red-700 [.dark_&]:bg-red-500/10 [.dark_&]:text-red-300' },
              ].map((s) => (
                <div key={s.label} className={cn('rounded-2xl p-3', s.cls)}>
                  <p className="text-[22px] font-semibold tabular-nums">{s.value}</p>
                  <p className="text-[11px] font-medium opacity-80">{s.label}</p>
                </div>
              ))}
            </div>
            <Link to="/customers" className="mt-3 flex items-center justify-between rounded-2xl bg-[#F2F2F4] px-4 py-3 [.dark_&]:bg-[#1E1E1E]">
              <span>
                <span className="block text-[13px] font-medium text-foreground">Owed by clients</span>
                <span className="block text-[11px] text-foreground-4">{r.debts.debtors} client{r.debts.debtors === 1 ? '' : 's'} with a balance</span>
              </span>
              <span className="text-[16px] font-semibold tabular-nums text-danger">{formatKES(r.debts.outstanding)}</span>
            </Link>
          </section>

          {/* The period's sales (latest first) */}
          <section>
            <SectionTitle
              title={period === 'day' ? `Sales on ${label.toLowerCase() === 'today' || label === 'Yesterday' ? label.toLowerCase() : label}` : `Sales · ${label}`}
              right={`${r.sales.length}`}
            />
            <Rows
              rows={r.sales.slice(0, 12).map((s) => ({
                key: s.id,
                to: `/sales/${s.id}`,
                left: s.customer,
                sub: `${
                  period === 'day'
                    ? new Date(s.at).toLocaleTimeString('en-KE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
                    : new Date(s.at).toLocaleDateString('en-KE', { timeZone: TZ, day: 'numeric', month: 'short' })
                } · ${METHOD_STYLE[s.method]?.label ?? s.method}${s.status !== 'PAID' ? ` · ${s.status.toLowerCase()}` : ''}`,
                right: formatKES(s.total),
              }))}
              empty={period === 'day' ? 'No sales on this day.' : `No sales this ${period}.`}
            />
            {r.sales.length > 12 && (
              <Link to="/sales" className="mt-1 block px-1 text-[12px] font-semibold text-brand-600">
                See all {r.sales.length} sales
              </Link>
            )}
          </section>

          {/* Send it */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(summaryText(r, label))}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-[14px] font-semibold text-white active:opacity-80"
            >
              <WhatsAppIcon className="h-5 w-5" /> Share
            </a>
            <button
              type="button"
              onClick={() => void download('pdf')}
              disabled={Boolean(downloading)}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#1C1F1B] text-[14px] font-semibold text-white active:opacity-80 disabled:opacity-60 [.dark_&]:bg-white [.dark_&]:text-[#1C1F1B]"
            >
              <Download className="h-4 w-4" /> {downloading === 'pdf' ? 'Preparing…' : 'PDF report'}
            </button>
          </div>
          <p className="text-center text-[11px] text-foreground-4">
            {period === 'day'
              ? "A new report starts every day at midnight. Yesterday's is final the moment the day ends."
              : `Each ${period} is final the moment it ends. Weeks run Monday to Sunday.`}
          </p>
        </>
      )}
    </div>
  );
}

/* ---------------- pieces ---------------- */

const TONES = {
  lavender: 'bg-[#E4E7F1] [.dark_&]:bg-[#23263A]',
  mint: 'bg-[#DDEBD9] [.dark_&]:bg-[#1D2B22]',
  sand: 'bg-[#F1E9D8] [.dark_&]:bg-[#2E281C]',
  sky: 'bg-[#DDEAF3] [.dark_&]:bg-[#1C2A33]',
} as const;

function Panel({
  tone,
  note,
  title,
  count,
  countLabel,
  more,
  children,
}: {
  tone: keyof typeof TONES;
  note: string;
  title: string;
  count: number;
  countLabel: string;
  more?: { label: string; to: string };
  children: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-[28px] p-4', TONES[tone])}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-foreground-4">{note}</span>
        {more && (
          <Link to={more.to} className="flex h-7 shrink-0 items-center gap-0.5 rounded-full bg-white/80 px-2.5 text-[11px] font-semibold text-foreground [.dark_&]:bg-white/10">
            {more.label}
            <ChevronDown className="h-3 w-3 -rotate-90" aria-hidden />
          </Link>
        )}
      </div>
      <div className="mb-3 mt-1 flex items-baseline justify-between gap-2">
        <h2 className="text-[22px] font-semibold tracking-tight text-foreground">{title}</h2>
        <span className="text-[22px] font-semibold tabular-nums text-foreground">
          {count}
          <span className="ml-1 text-[11px] font-medium text-foreground-4">{countLabel}</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">{children}</div>
    </section>
  );
}

function Tile({
  label,
  sub,
  value,
  icon: Icon,
  delta,
  versus = 'day',
  invert = false,
}: {
  label: string;
  sub: string;
  value: string;
  icon: typeof Wallet;
  /** % change vs the period before; for costs, up is bad (invert). */
  delta?: number | null;
  /** "day", "week"… for "vs week before". */
  versus?: string;
  invert?: boolean;
}) {
  const good = delta != null && (invert ? delta <= 0 : delta >= 0);
  return (
    <div className="flex min-h-[104px] flex-col justify-between rounded-2xl bg-white p-3 [.dark_&]:bg-black/30">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block text-[12px] font-medium leading-tight text-foreground-2">{label}</span>
          <span className="block truncate text-[10px] text-foreground-4">{sub}</span>
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1C1F1B] text-white [.dark_&]:bg-white [.dark_&]:text-[#1C1F1B]">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <div>
        <p className="truncate text-[18px] font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
        {delta != null && (
          <p className={cn('flex items-center gap-0.5 text-[10px] font-semibold', good ? 'text-emerald-600' : 'text-red-600')}>
            {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta)}% vs {versus} before
          </p>
        )}
      </div>
    </div>
  );
}

function WeekChart({
  rows,
  selected,
  period,
  today,
  title,
  onSelect,
}: {
  rows: Array<{ date: string; revenue: number }>;
  selected: string;
  period: ReportPeriod;
  today: string;
  title: string;
  onSelect: (date: string) => void;
}) {
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  const total = useMemo(() => rows.reduce((s, r) => s + r.revenue, 0), [rows]);
  return (
    <section className="rounded-[28px] bg-[#F2F2F4] p-4 [.dark_&]:bg-[#1E1E1E]">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[11px] text-foreground-4">{title}</p>
          <p className="text-[22px] font-semibold tabular-nums tracking-tight text-foreground">{formatKES(total)}</p>
        </div>
        <Wifi className="h-5 w-5 text-foreground-5" aria-hidden />
      </div>
      <div className={cn('mt-8 flex h-36 items-end', rows.length > 8 ? 'gap-1' : 'gap-2.5')}>
        {rows.map((r, i) => {
          const active = r.date === selected;
          const h = r.revenue > 0 ? Math.max(10, Math.round((r.revenue / max) * 112)) : 6;
          return (
            <button key={r.date} type="button" onClick={() => onSelect(r.date)} className="relative flex h-full flex-1 flex-col items-center justify-end gap-2" aria-label={`${r.date}: ${formatKES(r.revenue)}`}>
              {active && (
                <span className="absolute z-10 whitespace-nowrap rounded-full bg-[#C6EA5A] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#1C1F1B]" style={{ bottom: h + 30 }}>
                  {formatKES(r.revenue)}
                </span>
              )}
              {active && <span className="absolute h-2 w-2 rounded-full bg-[#1C1F1B] [.dark_&]:bg-white" style={{ bottom: h + 24 }} aria-hidden />}
              <span
                className="w-full max-w-[30px] rounded-xl transition-opacity"
                style={{
                  height: h,
                  // Every bar has its own colour; the selected one is striped
                  background: active ? barStripes(i) : barColor(i).solid,
                  opacity: active ? 1 : 0.85,
                }}
              />
              <span className={cn('text-[11px] leading-none', active ? 'font-semibold text-foreground' : 'text-foreground-4')}>
                {period === 'day'
                  ? r.date === today ? 'Today' : shortDay(r.date).weekday
                  : period === 'week'
                    ? fmtDay(r.date, { day: 'numeric', month: 'numeric' })
                    : period === 'month'
                      ? fmtDay(r.date, { month: 'narrow' })
                      : r.date.slice(2, 4)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SectionTitle({ title, right, className }: { title: string; right?: string; className?: string }) {
  return (
    <div className={cn('mb-2.5 flex items-center justify-between px-1', className)}>
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
      {right && <span className="text-[12px] font-medium text-foreground-4">{right}</span>}
    </div>
  );
}

function Rows({
  rows,
  empty,
}: {
  rows: Array<{ key: string; left: string; sub?: string; right: string; to?: string }>;
  empty?: string;
}) {
  if (rows.length === 0) return <p className="px-1 text-[13px] text-foreground-4">{empty}</p>;
  return (
    <ul className="space-y-0.5">
      {rows.map((row) => {
        const body = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">{row.left}</span>
              {row.sub && <span className="block truncate text-[11px] text-foreground-4">{row.sub}</span>}
            </span>
            <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">{row.right}</span>
          </>
        );
        return (
          <li key={row.key}>
            {row.to ? (
              <Link to={row.to} className="-mx-1 flex items-center gap-3 rounded-xl px-2 py-2.5 active:bg-surface-3">
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-1 py-2">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
