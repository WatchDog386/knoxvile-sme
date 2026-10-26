import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, ShoppingCart, Receipt } from 'lucide-react';
import { dashboardApi, salesApi } from '@/api/endpoints';
import { Chips } from '@/components/layout/app-bar';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { invoiceNo } from '@/features/isp/document-actions';
import { CARD_THEMES, FiberHeroCard, ProfileHeader } from '@/components/brand/fiber-card';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge, statusVariant, statusLabel } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/spinner';
import { cn, formatKES, formatDateTime } from '@/lib/utils';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useActiveBusiness } from '@/stores/business';
import { transactionDateBounds, type TransactionDateRange } from '@/lib/business-date';
import { DesktopSalesPage } from './desktop-sales-page';

const PAGE_SIZE = 20;
const MOBILE_SALE_TYPES = [
  { value: '', label: 'All sale types' },
  { value: 'GENERAL', label: 'General sales' },
  { value: 'PRODUCT', label: 'Products' },
  { value: 'SERVICE', label: 'Services' },
  { value: 'PACKAGE', label: 'Packages' },
  { value: 'ADVANCE', label: 'Advance payments' },
  { value: 'OTHER', label: 'Other revenue' },
  { value: 'MIXED', label: 'Mixed sales' },
];
const MOBILE_DATE_RANGES: Array<{ value: TransactionDateRange; label: string }> = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
];

/** Desktop gets its own table view; phones keep the card layout. Separate components so each keeps its own hooks. */
export function SalesPage() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopSalesPage /> : <SalesMobilePage />;
}

function SalesMobilePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const customerId = searchParams.get('customer') ?? '';
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [saleTypeFilter, setSaleTypeFilter] = useState('');
  const [dateRange, setDateRange] = useState<TransactionDateRange>('all');
  const business = useActiveBusiness();
  const bounds = transactionDateBounds(dateRange, business?.timezone ?? 'Africa/Nairobi');

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'sales',
      {
        page,
        paymentStatus: statusFilter,
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
        paymentStatus: statusFilter || undefined,
        saleType: saleTypeFilter || undefined,
        from: bounds.from,
        to: bounds.to,
        customerId: customerId || undefined,
      }),
  });

  // Business-wide figures for the tiles (shared with the dashboard's cache)
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });
  const [newestFirst, setNewestFirst] = useState(true);
  const items = data ? (newestFirst ? data.items : [...data.items].reverse()) : [];

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const statusTabs: Array<{ id: string; label: string }> = [
    { id: '', label: 'All' },
    { id: 'PAID', label: 'Paid' },
    { id: 'PARTIAL', label: 'Partial' },
    { id: 'UNPAID', label: 'Unpaid' },
  ];

  const filtered = Boolean(statusFilter || saleTypeFilter || dateRange !== 'all' || customerId);

  return (
    <div className="space-y-4 pb-10 font-sans text-[14px]">
      {/* Back button and notifications, same header as the Expenses page */}
      <ProfileHeader showBackButton />

      {/* Hero card, same design and teal as the Expenses page */}
      <FiberHeroCard
        theme={CARD_THEMES.sales}
        label="Collected today"
        value={dashboard.data ? formatKES(dashboard.data.today.cashReceived) : '—'}
        note={
          dashboard.data
            ? `${dashboard.data.today.paymentCount} payment${dashboard.data.today.paymentCount === 1 ? '' : 's'}`
            : undefined
        }
        maskedValue={data?.total ?? 0}
        footerLeft={business?.name ?? 'Knoxville'}
        footerRight={data ? `${data.total} sales` : undefined}
        icon={ShoppingCart}
        action={{ label: 'Record sale', onClick: () => navigate('/sales/new') }}
      />

      <Chips
        outline
        items={statusTabs}
        value={statusFilter}
        onChange={(id) => {
          setStatusFilter(id);
          setPage(1);
        }}
      />

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Select
            aria-label="Filter sales by type"
            value={saleTypeFilter}
            onChange={(event) => {
              setSaleTypeFilter(event.target.value);
              setPage(1);
            }}
          >
            {MOBILE_SALE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </Select>
        </div>
        <div className="min-w-0 flex-1">
          <Select
            aria-label="Filter sales by date"
            value={dateRange}
            onChange={(event) => {
              setDateRange(event.target.value as TransactionDateRange);
              setPage(1);
            }}
          >
            {MOBILE_DATE_RANGES.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
          </Select>
        </div>
        <button
          type="button"
          onClick={() => setNewestFirst((v) => !v)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-foreground active:scale-90"
          aria-label={newestFirst ? 'Show oldest first' : 'Show newest first'}
          title="Sort by date"
        >
          <ArrowUpDown className={cn('h-4 w-4 transition-transform', !newestFirst && 'rotate-180')} />
        </button>
      </div>

      {/* Hero card, same design and teal as the Expenses page */}
      {customerId && (
        <Alert variant="info" inline>
          Showing sales for this customer.{' '}
          <button
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

      {isLoading && <PageLoader inline message="Loading" />}

      {data && data.items.length === 0 && (
        <EmptyState
          icon={ShoppingCart}
          title={filtered ? 'No sales found' : 'No sales yet'}
          description={
            filtered
              ? 'Try a different status, type or date.'
              : 'Record your first sale — it takes under 10 seconds.'
          }
          actionLabel={filtered ? undefined : 'Record a sale'}
          onAction={() => window.location.assign('/sales/new')}
        />
      )}

      {data && data.items.length > 0 && (
        <div className="space-y-1">
          <div className="hidden sm:grid grid-cols-[1.4fr_0.9fr_1fr_0.8fr_auto] gap-2 px-1 py-2">
            <span className="text-[11px] font-medium text-foreground-4">Customer</span>
            <span className="text-[11px] font-medium text-foreground-4">Ref</span>
            <span className="text-[11px] font-medium text-foreground-4">Date &amp; method</span>
            <span className="text-right text-[11px] font-medium text-foreground-4">Total</span>
            <span className="text-right text-[11px] font-medium text-foreground-4">Status</span>
          </div>
          <ul className="stagger-list divide-y divide-edge max-lg:divide-y-0">
            {items.map((sale) => (
              <li key={sale.id}>
                <Link to={`/sales/${sale.id}`} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_0.9fr_1fr_0.8fr_auto] gap-2 px-1 py-3 transition-colors hover:bg-surface-2 active:bg-surface-3 items-center">
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-accent-soft text-accent">
                      <Receipt className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{sale.customer_name ?? 'Walk-in customer'}</p>
                      <p className="truncate text-[11px] text-foreground-5">
                        {saleCategoryLabel(sale.sale_type)}
                        {sale.category_name ? ` · ${sale.category_name}` : ''}
                      </p>
                      <p className="sm:hidden truncate text-xs text-foreground-5">
                        {sale.number ? invoiceNo(sale.number) : `#${sale.id.slice(0, 8).toUpperCase()}`} · {formatKES(sale.total)}
                      </p>
                      <p className="hidden sm:block truncate text-xs text-foreground-5">
                        {sale.item_count !== undefined ? `${sale.item_count} items` : '—'}
                      </p>
                    </span>
                  </span>
                  <span className="hidden sm:block truncate text-xs font-medium tabular-nums text-foreground-3">{sale.number ? invoiceNo(sale.number) : `#${sale.id.slice(0, 8).toUpperCase()}`}</span>
                  <span className="hidden sm:block min-w-0">
                    <p className="truncate text-xs text-foreground-3">{formatDateTime(sale.created_at)}</p>
                    <p className="truncate text-[11px] text-foreground-5">{sale.payment_method}</p>
                  </span>
                  <span className="hidden sm:block text-right text-sm font-medium tabular-nums text-foreground">{formatKES(sale.total)}</span>
                  <span className="text-right">
                    <Badge variant={statusVariant(sale.payment_status)}>{statusLabel(sale.payment_status)}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-1 py-3">
              <p className="text-xs text-foreground-5">Page {page} of {totalPages} · {data.total} sales</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function saleCategoryLabel(type?: string) {
  const labels: Record<string, string> = {
    GENERAL: "Today's general sales",
    PRODUCT: 'Product sale',
    SERVICE: 'Service sale',
    PACKAGE: 'Package subscription',
    ADVANCE: 'Advance payment',
    OTHER: 'Other revenue',
    MIXED: 'Mixed sale',
  };
  return labels[type ?? 'PRODUCT'] ?? 'Product sale';
}
