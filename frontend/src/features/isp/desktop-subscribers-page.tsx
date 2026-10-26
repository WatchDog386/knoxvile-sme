import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Wifi } from 'lucide-react';
import { subscriptionsApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { SubscriberRow, SubscriberStatus } from '@/api/types';
import { Alert } from '@/components/ui/alert';
import { Dialog } from '@/components/ui/dialog';
import { ListToolbar, ToolbarButton, ToolbarSelect } from '@/components/desktop/list-toolbar';
import { DataTable, DOT, StatusText, type Column } from '@/components/desktop/data-table';
import { TableEmpty } from '@/components/desktop/table-empty';
import { downloadCsv, csvDateStamp } from '@/lib/csv';
import { cn, formatKES } from '@/lib/utils';
import { usePageCount } from '@/stores/page-meta';
import { SubscriberForm } from './subscriber-form';

/** Rows per page in the table; the register list is loaded whole, so page in memory. */
const PAGE_SIZE = 20;

type StatusFilter = 'ALL' | SubscriberStatus | 'DUE3' | 'DUE7';
type PackageFilter = 'ALL' | string;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'INCOMPLETE', label: 'Incomplete (details missing)' },
  { value: 'DUE3', label: 'Due in 3 days' },
  { value: 'DUE7', label: 'Due in 7 days' },
];

const STATUS_TONE: Record<SubscriberStatus, { label: string; tone: 'green' | 'red' | 'amber'; dot: string }> = {
  ACTIVE: { label: 'Active', tone: 'green', dot: DOT.green },
  INACTIVE: { label: 'Inactive', tone: 'red', dot: DOT.red },
  INCOMPLETE: { label: 'Incomplete', tone: 'amber', dot: DOT.amber },
};

const SERVICE_LABEL = { HOTSPOT: 'Hotspot', PPPOE: 'PPPoE', STATIC: 'Static IP' } as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}]+/u, ''))
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function expiryDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function matchesStatus(row: SubscriberRow, filter: StatusFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'DUE3' || filter === 'DUE7') {
    return row.status === 'ACTIVE' && row.daysLeft !== null && row.daysLeft <= (filter === 'DUE3' ? 3 : 7);
  }
  return row.status === filter;
}

/**
 * Desktop subscriber register (lg and up). Same query as the mobile page's
 * register so the cache is shared: account details, package, wallet, debt and
 * status in one table, with status/package filters, search and CSV export.
 */
export function DesktopSubscribersPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [packageName, setPackageName] = useState<PackageFilter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);

  // Query key matches the register this desktop view replaces (and the mobile page's
  // edit/remove flow), so both views share one cache entry.
  const { data, isLoading, error } = useQuery({ queryKey: ['subscribers'], queryFn: () => subscriptionsApi.register() });

  const all = useMemo(() => data ?? [], [data]);

  const packages = useMemo(() => {
    const names = all.map((s) => s.packageName).filter((n): n is string => Boolean(n));
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [all]);

  const term = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      all.filter(
        (s) =>
          matchesStatus(s, status) &&
          (packageName === 'ALL' || s.packageName === packageName) &&
          (!term ||
            [s.name, s.username, s.accountNumber, s.phone, s.location, s.packageName, s.router].some((v) =>
              v ? v.toLowerCase().includes(term) : false,
            )),
      ),
    [all, status, packageName, term],
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const rows = useMemo(() => visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [visible, page]);

  // Narrowing the list always lands back on the first page
  useEffect(() => setPage(1), [status, packageName, term]);

  usePageCount(visible.length);

  const filtered = status !== 'ALL' || packageName !== 'ALL' || term.length > 0;
  const clearFilters = () => {
    setStatus('ALL');
    setPackageName('ALL');
    setSearch('');
  };

  const onExport = () => {
    downloadCsv(
      `subscribers-${csvDateStamp()}`,
      ['Account number', 'Name', 'Username', 'Phone', 'Location', 'Package', 'Price', 'Expires', 'Days left', 'Wallet', 'Status'],
      visible.map((s) => [
        s.accountNumber ?? '',
        s.name,
        s.username ?? '',
        s.phone ?? '',
        s.location ?? '',
        s.packageName ?? '',
        s.price ?? '',
        s.expiresAt ? expiryDate(s.expiresAt) : '',
        s.daysLeft ?? '',
        s.wallet,
        STATUS_TONE[s.status].label,
      ]),
    );
  };

  const columns: Column<SubscriberRow>[] = [
    {
      key: 'account',
      header: 'Account number',
      className: 'whitespace-nowrap tabular-nums',
      cell: (s) => <span className="font-medium text-foreground">{s.accountNumber ?? '—'}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (s) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-800 text-[11px] font-semibold text-white">
            {initials(s.name)}
          </span>
          <span className="min-w-0">
            <span className="block max-w-[16rem] truncate font-medium text-foreground">{s.name}</span>
            <span className="block max-w-[16rem] truncate text-[12px] text-foreground-4">
              {s.username ? `@${s.username}` : SERVICE_LABEL[s.serviceType ?? 'PPPOE']}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      className: 'whitespace-nowrap tabular-nums',
      cell: (s) => s.phone ?? '—',
    },
    {
      key: 'package',
      header: 'Package',
      cell: (s) =>
        s.packageName ? (
          <span className="block">
            <span className="block max-w-[12rem] truncate font-medium text-foreground">{s.packageName}</span>
            {s.price != null && <span className="block text-[12px] text-foreground-4">{formatKES(s.price)}/mo</span>}
          </span>
        ) : (
          <span className="text-foreground-4">No package</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (s) => (
        <StatusText tone={STATUS_TONE[s.status].tone}>
          {STATUS_TONE[s.status].label}
          {s.status === 'INCOMPLETE' && s.missing.length > 0 && ` · no ${s.missing.join(', no ')}`}
        </StatusText>
      ),
    },
    {
      key: 'due',
      header: 'Due date',
      className: 'whitespace-nowrap',
      cell: (s) => (
        <span className="block">
          <span className={cn('block', s.status === 'INACTIVE' && 'text-red-600 [.dark_&]:text-red-400')}>
            {expiryDate(s.expiresAt)}
          </span>
          {s.daysLeft !== null && (
            <span className="block text-[12px] text-foreground-4">
              {s.daysLeft > 1 ? `${s.daysLeft} days left` : s.daysLeft === 1 ? '1 day left' : s.daysLeft === 0 ? 'Expires today' : `Expired ${Math.abs(s.daysLeft)}d ago`}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'wallet',
      header: 'Wallet',
      align: 'right',
      className: 'whitespace-nowrap tabular-nums',
      cell: (s) => formatKES(s.wallet),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-normal tracking-tight text-foreground">Subscribers</h1>
          <p className="mt-1 text-[15px] text-foreground-4">
            Every client with their account, package, renewals and wallet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-accent px-4 text-[13px] font-medium text-white transition-colors hover:bg-accent-strong"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add subscriber
        </button>
      </div>

      {/* Filters, search and actions */}
      <ListToolbar
        filters={
          <>
            <ToolbarSelect
              label="Status"
              value={status}
              onChange={setStatus}
              options={STATUS_FILTERS}
            />
            <ToolbarSelect
              label="Package"
              value={packageName}
              onChange={setPackageName}
              options={[{ value: 'ALL' as const, label: 'All packages' }, ...packages.map((p) => ({ value: p, label: p }))]}
            />
          </>
        }
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search name, account, phone or router"
actions={
          <ToolbarButton icon="export" variant="outline" onClick={onExport} disabled={visible.length === 0}>
            Export CSV
          </ToolbarButton>
        }
      />

      {error && (
        <Alert variant="error" title="Could not load subscribers" inline>
          {apiErrorMessage(error)}
        </Alert>
      )}

      <DataTable<SubscriberRow>
        columns={columns}
        rows={rows}
        rowKey={(s) => s.id}
        dot={(s) => STATUS_TONE[s.status].dot}
        onRowClick={(s) => navigate(`/customers/${s.id}`)}
        loading={isLoading}
        page={page}
        totalPages={totalPages}
        total={visible.length}
        onPage={setPage}
        empty={
          isLoading ? null : filtered ? (
            <TableEmpty
              title="No subscribers match"
              description="Try a different search, status or package."
              onClear={clearFilters}
            />
          ) : (
            <TableEmpty
              title="No subscribers yet"
              description="Add a subscriber to record your first client and sell their WiFi package."
              actionLabel="Add subscriber"
              onAction={() => setAddOpen(true)}
            />
          )
        }
      />

      {/* Add subscriber: the same form the mobile sheet uses */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => !o && setAddOpen(false)}
        title="Add subscriber"
        description="Connect a client to WiFi"
        className="sm:max-w-2xl"
      >
        {addOpen && (
          <SubscriberForm
            key="new"
            onDone={() => setAddOpen(false)}
            onCancel={() => setAddOpen(false)}
          />
        )}
      </Dialog>

      {!isLoading && !error && visible.length > 0 && (
        <p className="flex items-center gap-1.5 text-[12.5px] text-foreground-4">
          <Wifi className="h-3.5 w-3.5" aria-hidden />
          {visible.length} subscriber{visible.length === 1 ? '' : 's'} shown. Select a row to open the client account.
        </p>
      )}
    </div>
  );
}