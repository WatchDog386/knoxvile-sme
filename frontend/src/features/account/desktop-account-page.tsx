import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, reportsApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { DailySummaryRow } from '@/api/types';
import { Alert } from '@/components/ui/alert';
import { DataTable, DOT, StatusText, type Column } from '@/components/desktop/data-table';
import { ListToolbar, ToolbarButton, ToolbarSelect } from '@/components/desktop/list-toolbar';
import { RailButton, RailHeader, RailLayout, RailStat } from '@/components/desktop/side-rail';
import { TableEmpty } from '@/components/desktop/table-empty';
import { csvDateStamp, downloadCsv } from '@/lib/csv';
import { formatKES } from '@/lib/utils';
import { useRole } from '@/hooks/use-role';
import { usePageCount } from '@/stores/page-meta';
import { periodRange } from '@/features/expenses/expenses-overview';

type Period = '7' | '14' | '30' | '90';

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: '7', label: 'Last 7 Days' },
  { value: '14', label: 'Last 14 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
];

type Show = 'all' | 'profit' | 'loss' | 'active';

const SHOW: Array<{ value: Show; label: string }> = [
  { value: 'all', label: 'All days' },
  { value: 'active', label: 'Days with sales' },
  { value: 'profit', label: 'Profitable days' },
  { value: 'loss', label: 'Loss days' },
];

function dayText(date: string): string {
  return new Date(`${date.slice(0, 10)}T12:00:00+03:00`).toLocaleDateString('en-KE', {
    timeZone: 'Africa/Nairobi',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Desktop account (lg and up): the business's daily books with balances on the right, Payouts style. */
export function DesktopAccountPage() {
  const navigate = useNavigate();
  const { canApprove } = useRole();
  const [period, setPeriod] = useState<Period>('30');
  const [show, setShow] = useState<Show>('all');
  const [search, setSearch] = useState('');
  const { from, to } = periodRange(Number(period));

  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });
  const summary = useQuery({
    queryKey: ['reports', 'daily-summary', from, to],
    queryFn: () => reportsApi.dailySummary({ from, to }),
    enabled: canApprove,
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...(summary.data ?? [])]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((r) => {
        if (show === 'active' && r.revenue === 0) return false;
        if (show === 'profit' && r.netProfit <= 0) return false;
        if (show === 'loss' && r.netProfit >= 0) return false;
        return !term || dayText(r.date).toLowerCase().includes(term) || r.date.includes(term);
      });
  }, [summary.data, show, search]);

  usePageCount(canApprove ? rows.length : null);

  const totals = useMemo(
    () =>
      (summary.data ?? []).reduce(
        (acc, r) => ({ revenue: acc.revenue + r.revenue, expenses: acc.expenses + r.expenses, net: acc.net + r.netProfit }),
        { revenue: 0, expenses: 0, net: 0 },
      ),
    [summary.data],
  );

  const columns: Column<DailySummaryRow>[] = [
    { key: 'amount', header: 'Revenue', cell: (r) => <span className="tabular-nums text-foreground">{formatKES(r.revenue)}</span> },
    { key: 'cogs', header: 'Cost of goods', cell: (r) => <span className="tabular-nums">{formatKES(r.cogs)}</span> },
    { key: 'expenses', header: 'Expenses', cell: (r) => <span className="tabular-nums">{formatKES(r.expenses)}</span> },
    { key: 'day', header: 'For Day', cell: (r) => <span className="text-foreground-3">{dayText(r.date)}</span> },
    {
      key: 'net',
      header: 'Net profit',
      align: 'right',
      cell: (r) => (
        <StatusText tone={r.netProfit > 0 ? 'green' : r.netProfit < 0 ? 'red' : 'grey'}>{formatKES(r.netProfit)}</StatusText>
      ),
    },
  ];

  const exportCsv = () =>
    downloadCsv(
      `account-${from}-to-${to}-${csvDateStamp()}`,
      ['Date', 'Revenue', 'Cost of goods', 'Gross profit', 'Expenses', 'Net profit'],
      rows.map((r) => [r.date.slice(0, 10), r.revenue, r.cogs, r.grossProfit, r.expenses, r.netProfit]),
    );

  const d = dashboard.data;
  const filtered = show !== 'all' || Boolean(search.trim());

  return (
    <RailLayout
      rail={
        <>
          <RailHeader>KES</RailHeader>
          <RailStat
            label="Net profit today"
            value={d ? formatKES(d.today.netProfit) : '—'}
            note={d ? `${formatKES(d.today.sales)} sales · ${formatKES(d.today.expenses)} expenses` : undefined}
            tone={d && d.today.netProfit < 0 ? 'red' : undefined}
            action={canApprove ? <RailButton onClick={() => navigate('/reports?view=daily')}>Daily report</RailButton> : undefined}
          />
          <RailStat
            label="Owed by customers"
            value={d ? formatKES(d.outstandingDebts) : '—'}
            note="Credit sales not yet paid"
            action={<RailButton onClick={() => navigate('/customers')}>Collect</RailButton>}
          />
          <RailStat label="Revenue" value={d ? formatKES(d.monthRevenue) : '—'} note="Last 30 days" />
          {canApprove && summary.data && (
            <RailStat
              label="Period net profit"
              value={formatKES(totals.net)}
              note={`${PERIODS.find((p) => p.value === period)?.label} · ${formatKES(totals.expenses)} spent`}
              tone={totals.net < 0 ? 'red' : 'green'}
            />
          )}
        </>
      }
    >
      {canApprove ? (
        <>
          <ListToolbar
            filters={
              <>
                <ToolbarSelect label="Period" value={period} onChange={setPeriod} options={PERIODS} />
                <ToolbarSelect label="Filter" value={show} onChange={setShow} options={SHOW} />
              </>
            }
            search={search}
            onSearch={setSearch}
            searchPlaceholder="Search day (e.g. Mon or 12 Oct)"
            actions={
              <ToolbarButton icon="export" onClick={exportCsv} disabled={rows.length === 0}>
                Export CSV
              </ToolbarButton>
            }
          />
          {summary.error && (
            <div className="mb-4">
              <Alert variant="error" title="Could not load the daily books" inline>
                {apiErrorMessage(summary.error)}
              </Alert>
            </div>
          )}
          <DataTable<DailySummaryRow>
            columns={columns}
            rows={rows}
            rowKey={(r) => r.date}
            onRowClick={(r) => navigate(`/reports?view=daily&date=${r.date.slice(0, 10)}`)}
            loading={summary.isLoading}
            dot={(r) => (r.netProfit > 0 ? DOT.green : r.netProfit < 0 ? DOT.red : DOT.grey)}
            empty={
              filtered ? (
                <TableEmpty
                  title="No days found"
                  description="No day in this period matches the filter."
                  onClear={() => {
                    setShow('all');
                    setSearch('');
                  }}
                />
              ) : (
                <TableEmpty
                  title="No activity yet"
                  description="We haven't recorded any sales or expenses in this period. Days appear here once money moves."
                />
              )
            }
          />
        </>
      ) : (
        <div className="rounded-md border border-edge bg-surface">
          <TableEmpty
            title="Daily books are for admins"
            description="Ask an owner, manager or accountant for the business's daily figures."
          />
        </div>
      )}
    </RailLayout>
  );
}
