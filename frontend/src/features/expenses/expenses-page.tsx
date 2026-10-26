import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Paperclip, Repeat, Search, Wallet, X } from 'lucide-react';
import { categoriesApi, dashboardApi, expensesApi, reportsApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import { notifySuccess } from '@/components/ui/popup-host';
import { Badge, statusLabel, statusVariant } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CARD_THEMES, FiberHeroCard, ProfileHeader } from '@/components/brand/fiber-card';
import { Chips } from '@/components/layout/app-bar';
import { useActiveBusiness } from '@/stores/business';
import { transactionDateBounds, type TransactionDateRange } from '@/lib/business-date';
import { Card } from '@/components/ui/card';
import { PageLoader } from '@/components/ui/spinner';
import { formatKES, formatDate } from '@/lib/utils';
import { useRole } from '@/hooks/use-role';
import { ExpenseForm } from './expense-form';
import type { Expense, ExpenseStatus } from '@/api/types';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { DesktopExpensesPage } from './desktop-expenses-page';

const PAGE_SIZE = 20;
const MOBILE_EXPENSE_RANGES: Array<{ value: TransactionDateRange; label: string }> = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
];
const MOBILE_EXPENSE_METHODS = [
  { value: '', label: 'All payment methods' },
  { value: 'CASH', label: 'Cash' },
  { value: 'M-PESA', label: 'M-Pesa' },
  { value: 'BANK', label: 'Bank transfer' },
  { value: 'CARD', label: 'Card' },
];

/** Browsers block opening data: URLs directly, so go through a blob URL. */
async function openReceipt(url: string) {
  if (!url.startsWith('data:')) {
    window.open(url, '_blank', 'noopener');
    return;
  }
  const blob = await (await fetch(url)).blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

/** Desktop gets its own table view; phones keep the card layout. Separate components so each keeps its own hooks. */
export function ExpensesPage() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopExpensesPage /> : <ExpensesMobilePage />;
}

function ExpensesMobilePage() {
  const queryClient = useQueryClient();
  const { canApprove } = useRole();
  const business = useActiveBusiness();
  // Figures for the card and the "today" panel (shared caches with the dashboard and Reports)
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });
  const dayReport = useQuery({
    queryKey: ['daily-report', 'today'],
    queryFn: () => reportsApi.day(),
    enabled: canApprove,
    retry: false,
  });
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [dateRange, setDateRange] = useState<TransactionDateRange>('all');
  const bounds = transactionDateBounds(dateRange, business?.timezone ?? 'Africa/Nairobi');
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | ''>(
    searchParams.get('status') === 'PENDING' ? 'PENDING' : '',
  );
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('new') === '1') setFormOpen(true);
  }, [searchParams]);

  const [rejectExpense, setRejectExpense] = useState<Expense | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'EXPENSE'],
    queryFn: () => categoriesApi.list('EXPENSE'),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'expenses',
      {
        page,
        search: debouncedSearch,
        categoryId: categoryFilter,
        status: statusFilter,
        paymentMethod: methodFilter,
        from: bounds.from,
        to: bounds.to,
      },
    ],
    queryFn: () =>
      expensesApi.list({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        categoryId: categoryFilter || undefined,
        status: statusFilter || undefined,
        paymentMethod: methodFilter || undefined,
        from: bounds.from,
        to: bounds.to,
      }),
  });

  const refreshAll = async () => {
    await Promise.all(
      ['expenses', 'dashboard', 'reports', 'budgets'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };

  const approveMutation = useMutation({
    mutationFn: (id: string) => expensesApi.approve(id),
    onSuccess: async (expense) => {
      setReviewError(null);
      notifySuccess('Expense approved', `"${expense.description}" was approved.`);
      await refreshAll();
    },
    onError: (err) => setReviewError(apiErrorMessage(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      expensesApi.reject(id, reason),
    onSuccess: async (expense) => {
      setRejectExpense(null);
      setRejectReason('');
      setReviewError(null);
      notifySuccess('Expense rejected', `"${expense.description}" was rejected.`);
      await refreshAll();
    },
    onError: (err) => setReviewError(apiErrorMessage(err)),
  });

  // Approving and rejecting still happen from the list; editing and deleting
  // live on the expense detail page.

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const filtered = Boolean(debouncedSearch || statusFilter || categoryFilter || methodFilter || dateRange !== 'all');

  return (
    <div className="space-y-5">
      {/* Same layout as the Staff page: back header, bank card, round filters */}
      <ProfileHeader showBackButton />

      <FiberHeroCard
        theme={CARD_THEMES.expenses}
        label="Spent today"
        value={dashboard.data ? formatKES(dashboard.data.today.expenses) : '—'}
        note={dashboard.data?.pendingApprovals ? `${dashboard.data.pendingApprovals} pending` : undefined}
        maskedValue={data?.total ?? 0}
        footerLeft={business?.name ?? 'Knoxville'}
        footerRight={data ? `${data.total} expenses` : undefined}
        icon={Wallet}
        action={{ label: canApprove ? 'Add expense' : 'Submit expense', onClick: () => setFormOpen(true) }}
      />

      {/* Status tabs, same outline pills the Sales page uses */}
      <Chips<ExpenseStatus | 'ALL'>
        outline
        value={statusFilter || 'ALL'}
        onChange={(id) => {
          setStatusFilter(id === 'ALL' ? '' : id);
          setPage(1);
        }}
        items={[
          { id: 'ALL', label: 'All' },
          { id: 'PENDING', label: 'Pending', count: dashboard.data?.pendingApprovals || undefined },
          { id: 'APPROVED', label: 'Approved' },
          { id: 'REJECTED', label: 'Rejected' },
        ]}
      />

      <div className="grid grid-cols-2 gap-2">
        <Select
          aria-label="Filter expenses by date"
          value={dateRange}
          onChange={(event) => {
            setDateRange(event.target.value as TransactionDateRange);
            setPage(1);
          }}
        >
          {MOBILE_EXPENSE_RANGES.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
        </Select>
        <Select
          aria-label="Filter expenses by payment method"
          value={methodFilter}
          onChange={(event) => {
            setMethodFilter(event.target.value);
            setPage(1);
          }}
        >
          {MOBILE_EXPENSE_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
        </Select>
      </div>

      {/* Today at a glance, in the Reports page style */}
      {dayReport.data && (
        <section className="rounded-[28px] bg-[#DDEBD9] p-4 [.dark_&]:bg-[#1D2B22]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-foreground-4">Today · live</span>
            <Link
              to="/reports"
              className="flex h-7 items-center gap-0.5 rounded-full bg-white/80 px-2.5 text-[11px] font-semibold text-foreground [.dark_&]:bg-white/10"
            >
              Report
              <ChevronRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <div className="mb-3 mt-1 flex items-baseline justify-between gap-2">
            <h2 className="text-[22px] font-semibold tracking-tight text-foreground">Expenses</h2>
            <span className="text-[22px] font-semibold tabular-nums text-foreground">
              {dayReport.data.expenses.count}
              <span className="ml-1 text-[11px] font-medium text-foreground-4">Items</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Total spent', sub: 'Approved today', value: formatKES(dayReport.data.expenses.total), icon: Wallet },
              { label: 'Awaiting approval', sub: `${dayReport.data.expenses.pendingCount} pending`, value: formatKES(dayReport.data.expenses.pendingTotal), icon: Repeat },
            ].map((t) => (
              <div key={t.label} className="flex min-h-[96px] flex-col justify-between rounded-2xl bg-white p-3 [.dark_&]:bg-black/30">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-[12px] font-medium leading-tight text-foreground-2">{t.label}</span>
                    <span className="block truncate text-[10px] text-foreground-4">{t.sub}</span>
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1C1F1B] text-white [.dark_&]:bg-white [.dark_&]:text-[#1C1F1B]">
                    <t.icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </div>
                <p className="truncate text-[18px] font-semibold tabular-nums tracking-tight text-foreground">{t.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {reviewError && !rejectExpense && (
        <Alert variant="error" title="Could not update the expense">
          {reviewError}
        </Alert>
      )}

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-5" aria-hidden />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
              window.setTimeout(() => setDebouncedSearch(event.target.value), 300);
            }}
            placeholder="Search expenses..."
            className="h-11 rounded-full bg-field pl-9"
          />
        </div>
        {canApprove && (
          <Link
            to="/expenses/recurring"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-foreground active:scale-90"
            aria-label="Recurring expenses"
            title="Recurring expenses"
          >
            <Repeat className="h-4 w-4" />
          </Link>
        )}
      </div>
      <Select
        value={categoryFilter}
        onChange={(event) => {
          setCategoryFilter(event.target.value);
          setPage(1);
        }}
        placeholder="All categories"
      >
        {categoriesQuery.data?.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>

      {error && (
        <Alert variant="error" title="Could not load expenses" inline>
          {apiErrorMessage(error)}
        </Alert>
      )}

      {isLoading && <PageLoader inline message="Loading" />}

      {data && data.items.length === 0 && (
        <EmptyState
          icon={Wallet}
          title={filtered ? 'No expenses found' : 'No expenses yet'}
          description={
            filtered
              ? 'Try a different search or status.'
              : 'Record expenses like rent and supplies to see your real profit.'
          }
          actionLabel={filtered ? undefined : 'Add an expense'}
          onAction={() => setFormOpen(true)}
        />
      )}

      {data && data.items.length > 0 && (
        <Card className="max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none">
          <ul className="stagger-list divide-y divide-edge max-lg:divide-y-0">
            {data.items.map((expense) => (
              <li key={expense.id} className="px-1 py-3 lg:px-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {/* Tapping the row opens the full expense, like the Sales list */}
                  <Link
                    to={`/expenses/${expense.id}`}
                    className="flex min-w-0 flex-1 basis-40 items-center gap-3 rounded-lg transition-colors hover:bg-surface-2"
                  >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F7E3E6] text-[#9B2B3D] [.dark_&]:bg-[#9B2B3D]/20 [.dark_&]:text-[#F2B8C0]">
                    <Wallet className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {expense.description}
                      </p>
                      <Badge variant={statusVariant(expense.status)}>
                        {statusLabel(expense.status)}
                      </Badge>
                      {expense.recurringExpenseId && (
                        <Badge variant="outline">
                          <Repeat className="h-3 w-3" aria-hidden />
                          Recurring
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-foreground-5">
                      {expense.category_name ?? 'Uncategorized'} ·{' '}
                      {formatDate(expense.expense_date)} · {expense.payment_method}
                    </p>
                    {expense.status === 'REJECTED' && expense.rejection_reason && (
                      <p className="mt-1 text-xs text-danger">
                        Rejected: {expense.rejection_reason}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-sm font-medium text-danger">
                    −{formatKES(expense.amount)}
                  </p>
                  </Link>
                  <div className="flex flex-wrap items-center gap-1">
                    {expense.receipt_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void openReceipt(expense.receipt_url!)}
                        aria-label={`View receipt for ${expense.description}`}
                      >
                        <Paperclip className="h-4 w-4" />
                        Receipt
                      </Button>
                    )}
                    {canApprove && expense.status === 'PENDING' && (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          loading={
                            approveMutation.isPending &&
                            approveMutation.variables === expense.id
                          }
                          onClick={() => approveMutation.mutate(expense.id)}
                        >
                          <Check className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReviewError(null);
                            setRejectReason('');
                            setRejectExpense(expense);
                          }}
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    )}
                    </div>
                </div>
              </li>
            ))}
          </ul>
          {data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-edge px-4 py-3 max-lg:border-t-0 max-lg:px-1">
              <p className="text-xs text-foreground-5">
                Page {page} of {totalPages} · {data.total} expenses
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={canApprove ? 'Add an expense' : 'Submit an expense'}
        description={
          canApprove
            ? 'Expenses are subtracted from your gross profit to get net profit.'
            : 'Attach a receipt so it can be approved quickly.'
        }
      >
        <ExpenseForm
          onClose={() => setFormOpen(false)}
          submitLabel={canApprove ? 'Add expense' : 'Submit for approval'}
          onSaved={(expense) =>
            expense.status === 'PENDING'
              ? notifySuccess('Submitted for approval', `"${expense.description}" is awaiting approval.`)
              : notifySuccess('Expense recorded', `"${expense.description}" was recorded.`)
          }
        />
      </Dialog>

      <Dialog
        open={Boolean(rejectExpense)}
        onOpenChange={(open) => !open && setRejectExpense(null)}
        title="Reject this expense?"
        description={`"${rejectExpense?.description}" of ${rejectExpense ? formatKES(rejectExpense.amount) : ''}. The submitter will see your reason.`}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!rejectExpense) return;
            if (!rejectReason.trim()) {
              setReviewError('Give a reason for rejecting this expense.');
              return;
            }
            rejectMutation.mutate({ id: rejectExpense.id, reason: rejectReason.trim() });
          }}
        >
          {reviewError && <Alert variant="error">{reviewError}</Alert>}
          <div>
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              maxLength={300}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="e.g. No receipt attached, or not a business expense"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectExpense(null)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" loading={rejectMutation.isPending}>
              Reject expense
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
