import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { salesApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { PaymentMethod, Sale } from '@/api/types';
import { Alert } from '@/components/ui/alert';
import {
  DataTable,
  DOT,
  StatusText,
  type Column,
} from '@/components/desktop/data-table';
import { ListToolbar, ToolbarButton, ToolbarSelect } from '@/components/desktop/list-toolbar';
import { TableEmpty } from '@/components/desktop/table-empty';
import { usePageCount } from '@/stores/page-meta';
import { csvDateStamp, downloadCsv } from '@/lib/csv';
import { formatDateTime, formatKES } from '@/lib/utils';
import { invoiceNo } from '@/features/isp/document-actions';
import { transactionDateBounds } from '@/lib/business-date';
import { useActiveBusiness } from '@/stores/business';

const PAGE_SIZE = 20;

/** Kenya is UTC+3 all year, so shifting the clock gives Nairobi wall time. */
type RangeFilter = 'all' | 'today' | '7d' | '30d' | 'month';
type MethodFilter = 'all' | PaymentMethod;

const RANGE_OPTIONS: Array<{ value: RangeFilter; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
];

const METHOD_OPTIONS: Array<{ value: MethodFilter; label: string }> = [
  { value: 'all', label: 'All methods' },
  { value: 'M-PESA', label: 'M-PESA' },
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'CREDIT', label: 'Credit' },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const CSV_HEADERS = ['Invoice', 'Customer', 'Date & time', 'Items', 'Payment method', 'Status', 'Amount (KES)'];

const METHOD_LABELS: Record<PaymentMethod, string> = {
  'M-PESA': 'M-PESA',
  CASH: 'Cash',
  BANK: 'Bank transfer',
  CARD: 'Card',
  CREDIT: 'Credit',
};

const STATUS_TONES = {
  PAID: 'green',
  PARTIAL: 'amber',
  UNPAID: 'red',
  CANCELLED: 'grey',
  REFUNDED: 'blue',
} as const;

const STATUS_DOTS = {
  PAID: DOT.green,
  PARTIAL: DOT.amber,
  UNPAID: DOT.red,
  CANCELLED: DOT.grey,
  REFUNDED: DOT.blue,
} as const;

function reference(sale: Sale): string {
  return sale.number ? invoiceNo(sale.number) : `#${sale.id.slice(0, 8).toUpperCase()}`;
}

function statusTone(status: Sale['payment_status']) {
  return STATUS_TONES[status] ?? 'grey';
}

function statusDot(status: Sale['payment_status']) {
  return STATUS_DOTS[status] ?? DOT.grey;
}

const SALE_TYPE_OPTIONS = [
  { value: '', label: 'All sale types' },
  { value: 'GENERAL', label: 'General sales' },
  { value: 'PRODUCT', label: 'Products' },
  { value: 'SERVICE', label: 'Services' },
  { value: 'PACKAGE', label: 'Packages' },
  { value: 'ADVANCE', label: 'Advance payments' },
  { value: 'OTHER', label: 'Other revenue' },
  { value: 'MIXED', label: 'Mixed sales' },
];

/** Desktop-only sales list (lg and up). Phones use the stacked mobile page. */
export function DesktopSalesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const customerId = searchParams.get('customer') ?? '';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('all');
  const [saleTypeFilter, setSaleTypeFilter] = useState('');
  const business = useActiveBusiness();
  const bounds = useMemo(
    () => transactionDateBounds(rangeFilter, business?.timezone ?? 'Africa/Nairobi'),
    [rangeFilter, business?.timezone],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Same query key as the mobile page, so both share one cache.
  const { data, isLoading, error } = useQuery({
    queryKey: [
      'sales',
      {
        page,
        search: debouncedSearch,
        paymentStatus: statusFilter,
        paymentMethod: methodFilter,
        saleType: saleTypeFilter,
        from: bounds.from,
        to: bounds.to,
        customerId,
      },
    ],
    queryFn: () =>
      salesApi.list({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        paymentStatus: statusFilter || undefined,
        paymentMethod: methodFilter === 'all' ? undefined : methodFilter,
        saleType: saleTypeFilter || undefined,
        from: bounds.from,
        to: bounds.to,
        customerId: customerId || undefined,
      }),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;

  usePageCount(total);

  const rows = items;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setMethodFilter('all');
    setRangeFilter('all');
    setSaleTypeFilter('');
    setPage(1);
  };

  const hasQuery =
    Boolean(debouncedSearch) ||
    Boolean(statusFilter) ||
    methodFilter !== 'all' ||
    rangeFilter !== 'all' ||
    Boolean(saleTypeFilter) ||
    Boolean(customerId);
  const noSalesYet = total === 0 && !hasQuery;

  const columns: Column<Sale>[] = [
    {
      key: 'invoice',
      header: 'Invoice',
      cell: (sale) => <span className="font-medium tabular-nums text-foreground">{reference(sale)}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      className: 'w-[24%]',
      cell: (sale) => (
        <span className="block min-w-0">
          <span className="block truncate">{sale.customer_name ?? 'Walk-in customer'}</span>
          {sale.category_name && <span className="block truncate text-[11px] text-foreground-5">{sale.category_name}</span>}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Date & time',
      cell: (sale) => (
        <span className="tabular-nums text-foreground-3">{formatDateTime(sale.created_at)}</span>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      align: 'right',
      cell: (sale) =>
        sale.item_count !== undefined ? (
          <span className="tabular-nums">{sale.item_count}</span>
        ) : (
          <span className="text-foreground-5">—</span>
        ),
    },
    {
      key: 'method',
      header: 'Method',
      cell: (sale) => METHOD_LABELS[sale.payment_method] ?? sale.payment_method,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (sale) => (
        <StatusText tone={statusTone(sale.payment_status)}>
          {sale.payment_status.charAt(0) + sale.payment_status.slice(1).toLowerCase()}
        </StatusText>
      ),
    },
    {
      key: 'total',
      header: 'Amount',
      align: 'right',
      cell: (sale) => (
        <span className="font-medium tabular-nums text-foreground">{formatKES(sale.total)}</span>
      ),
    },
  ];

  const exportCsv = () => {
    downloadCsv(
      `sales-${csvDateStamp()}`,
      CSV_HEADERS,
      rows.map((sale) => [
        reference(sale),
        sale.customer_name ?? 'Walk-in customer',
        formatDateTime(sale.created_at),
        sale.item_count ?? '',
        METHOD_LABELS[sale.payment_method] ?? sale.payment_method,
        sale.payment_status,
        sale.total,
      ]),
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-normal tracking-tight text-foreground">Sales</h1>
          <p className="mt-1 text-[13.5px] text-foreground-3">
            Every sale you have recorded, with what was paid and what is still owed.
          </p>
        </div>
        <Link
          to="/sales/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-accent-strong"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Record sale
        </Link>
      </div>

      {customerId && (
        <Alert variant="info" inline>
          Showing sales for this customer.{' '}
          <button
            type="button"
            onClick={() => {
              setSearchParams({});
              setPage(1);
            }}
            className="font-medium underline"
          >
            Clear filter
          </button>
        </Alert>
      )}

      {error && (
        <Alert variant="error" title="Could not load sales" inline>
          {apiErrorMessage(error)}
        </Alert>
      )}

      <ListToolbar
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Search by customer or invoice..."
        filters={
          <>
            <ToolbarSelect
              label="Date range"
              value={rangeFilter}
              onChange={(value) => {
                setRangeFilter(value);
                setPage(1);
              }}
              options={RANGE_OPTIONS}
            />
            <ToolbarSelect
              label="Payment method"
              value={methodFilter}
              onChange={(value) => {
                setMethodFilter(value);
                setPage(1);
              }}
              options={METHOD_OPTIONS}
            />
            <ToolbarSelect
              label="Status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              options={STATUS_OPTIONS}
            />
            <ToolbarSelect
              label="Sale type"
              value={saleTypeFilter}
              onChange={(value) => {
                setSaleTypeFilter(value);
                setPage(1);
              }}
              options={SALE_TYPE_OPTIONS}
            />
          </>
        }
        actions={
          <ToolbarButton
            icon="export"
            variant="outline"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            Export CSV
          </ToolbarButton>
        }
      />

      <DataTable<Sale>
        columns={columns}
        rows={rows}
        rowKey={(sale) => sale.id}
        onRowClick={(sale) => navigate(`/sales/${sale.id}`)}
        loading={isLoading}
        dot={(sale) => statusDot(sale.payment_status)}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
        empty={
          !isLoading && noSalesYet ? (
            <TableEmpty
              title="No sales yet"
              description="Record your first sale — it takes under 10 seconds."
              actionLabel="Record a sale"
              onAction={() => navigate('/sales/new')}
            />
          ) : (
            <TableEmpty
              title="No sales found"
              description={
                hasQuery
                  ? 'No sale matches this search or filter. Try widening the range.'
                  : 'Record your first sale — it takes under 10 seconds.'
              }
              onClear={hasQuery ? clearFilters : undefined}
              actionLabel={hasQuery ? undefined : 'Record a sale'}
              onAction={hasQuery ? undefined : () => navigate('/sales/new')}
            />
          )
        }
      />
    </div>
  );
}
