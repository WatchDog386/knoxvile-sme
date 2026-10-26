import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Paperclip,
  Repeat,
  X,
  type LucideIcon,
} from 'lucide-react';
import { businessesApi, categoriesApi, expensesApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { Expense, ExpenseStatus } from '@/api/types';
import { Alert } from '@/components/ui/alert';
import { notifySuccess } from '@/components/ui/popup-host';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DataTable,
  DOT,
  StatusText,
  type Column,
} from '@/components/desktop/data-table';
import { ListToolbar, ToolbarButton, ToolbarSelect } from '@/components/desktop/list-toolbar';
import { TableEmpty } from '@/components/desktop/table-empty';
import { csvDateStamp, downloadCsv } from '@/lib/csv';
import { cn, formatDate, formatKES } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { useActiveBusiness } from '@/stores/business';
import { usePageCount } from '@/stores/page-meta';
import { useRole } from '@/hooks/use-role';
import { ExpenseForm } from './expense-form';
import { ExpensesOverview, ExpensesRail, type OverviewDays } from './expenses-overview';
import { RailLayout } from '@/components/desktop/side-rail';
import { transactionDateBounds } from '@/lib/business-date';

const PAGE_SIZE = 20;

type RangeFilter = 'all' | 'today' | '7d' | '30d' | 'month';
type StatusFilter = ExpenseStatus | '';

const RANGE_OPTIONS: Array<{ value: RangeFilter; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const STATUS_TONES = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
} as const;

const STATUS_DOTS = {
  PENDING: DOT.amber,
  APPROVED: DOT.green,
  REJECTED: DOT.red,
} as const;

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING: 'Pending approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  'M-PESA': 'M-Pesa',
  BANK: 'Bank',
  CARD: 'Card',
};

const CSV_HEADERS = [
  'Date',
  'Category',
  'Description',
  'Paid via',
  'Submitted by',
  'Status',
  'Amount (KES)',
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

const PAYMENT_METHOD_OPTIONS = [
  { value: '', label: 'All payment methods' },
  { value: 'CASH', label: 'Cash' },
  { value: 'M-PESA', label: 'M-Pesa' },
  { value: 'BANK', label: 'Bank transfer' },
  { value: 'CARD', label: 'Card' },
];

function statusTone(status: ExpenseStatus) {
  return STATUS_TONES[status] ?? 'grey';
}

function statusDot(status: ExpenseStatus) {
  return STATUS_DOTS[status] ?? DOT.grey;
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground-4 transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50',
        danger && 'hover:bg-danger-soft hover:text-danger',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

/** Desktop-only expenses list (lg and up). Phones use the stacked mobile page. */
export function DesktopExpensesPage() {
  const queryClient = useQueryClient();
  const { canApprove, canManage } = useRole();
  const user = useAuthStore((s) => s.user);
  const business = useActiveBusiness();
  const [searchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    searchParams.get('status') === 'PENDING' ? 'PENDING' : '',
  );
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('all');
  const [methodFilter, setMethodFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [rejectExpense, setRejectExpense] = useState<Expense | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [overviewDays, setOverviewDays] = useState<OverviewDays>('30');
  const bounds = useMemo(
    () => transactionDateBounds(rangeFilter, business?.timezone ?? 'Africa/Nairobi'),
    [rangeFilter, business?.timezone],
  );

  useEffect(() => {
    if (searchParams.get('new') === '1') setFormOpen(true);
  }, [searchParams]);

  // Debounce typing, then return to the first page of results.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Same query key as the mobile page, so both share one cache.
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

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'EXPENSE'],
    queryFn: () => categoriesApi.list('EXPENSE'),
  });

  // Submitter names, where the signed-in role may read the member list.
  const membersQuery = useQuery({
    queryKey: ['business', business?.id, 'members'],
    queryFn: () => businessesApi.members(),
    enabled: canManage && Boolean(business?.id),
  });

  const total = data?.total ?? 0;
  const totalPages = data ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;

  usePageCount(total);

  const submitterName = useMemo(() => {
    const names = new Map<string, string>();
    for (const member of membersQuery.data ?? []) names.set(member.user.id, member.user.fullName);
    return (expense: Expense): string => {
      if (!expense.submittedById) return '—';
      return names.get(expense.submittedById) ?? (expense.submittedById === user?.id ? 'You' : '—');
    };
  }, [membersQuery.data, user?.id]);

  const items = data?.items ?? [];

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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: async () => {
      setConfirmDelete(null);
      setDeleteError(null);
      await refreshAll();
    },
    onError: (err) => setDeleteError(apiErrorMessage(err)),
  });

  // Editing and deleting now happen on the expense detail page.

  const isFiltered =
    Boolean(debouncedSearch) || Boolean(statusFilter) || Boolean(categoryFilter) || Boolean(methodFilter) || rangeFilter !== 'all';
  const noExpensesYet = !isFiltered && total === 0;

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setCategoryFilter('');
    setRangeFilter('all');
    setMethodFilter('');
    setPage(1);
  };

  const columns: Column<Expense>[] = [
    {
      key: 'date',
      header: 'Date',
      cell: (expense) => <span className="tabular-nums text-foreground-3">{formatDate(expense.expense_date)}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      cell: (expense) =>
        expense.category_name ? (
          <span className="block truncate">{expense.category_name}</span>
        ) : (
          <span className="text-foreground-5">Uncategorized</span>
        ),
    },
    {
      key: 'description',
      header: 'Description',
      className: 'w-[28%]',
      cell: (expense) => (
        <Link to={`/expenses/${expense.id}`} className="block min-w-0 rounded-md transition-colors hover:text-accent">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium text-foreground">{expense.description}</span>
            {expense.recurringExpenseId && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-foreground-4">
                <Repeat className="h-3 w-3" aria-hidden />
                Recurring
              </span>
            )}
          </div>
          <span className="block truncate text-[12px] text-foreground-5">
            Paid via {METHOD_LABELS[expense.payment_method] ?? expense.payment_method}
          </span>
          {expense.status === 'REJECTED' && expense.rejection_reason && (
            <span className="block truncate text-[12px] text-danger">Rejected: {expense.rejection_reason}</span>
          )}
        </Link>
      ),
    },
    {
      key: 'submitted_by',
      header: 'Submitted by',
      cell: (expense) => <span className="block truncate text-foreground-3">{submitterName(expense)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (expense) => <StatusText tone={statusTone(expense.status)}>{STATUS_LABELS[expense.status]}</StatusText>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (expense) => (
        <span className="font-medium tabular-nums text-danger">−{formatKES(expense.amount)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-px',
      cell: (expense) => {
        // Editing and deleting now happen on the expense detail page.
        const showReview = canApprove && expense.status === 'PENDING';
        if (!expense.receipt_url && !showReview) {
          return <span className="text-[12.5px] text-foreground-5">—</span>;
        }
        return (
          <div className="flex items-center justify-end gap-0.5">
            {expense.receipt_url && (
              <ActionButton
                icon={Paperclip}
                label={`View receipt for ${expense.description}`}
                onClick={() => void openReceipt(expense.receipt_url!)}
              />
            )}
            {showReview && (
              <>
                <ActionButton
                  icon={Check}
                  label={`Approve ${expense.description}`}
                  disabled={
                    approveMutation.isPending && approveMutation.variables === expense.id
                  }
                  onClick={() => approveMutation.mutate(expense.id)}
                />
                <ActionButton
                  icon={X}
                  label={`Reject ${expense.description}`}
                  onClick={() => {
                    setReviewError(null);
                    setRejectReason('');
                    setRejectExpense(expense);
                  }}
                />
              </>
            )}
          </div>
        );
      },
    },
  ];

  const exportCsv = () => {
    downloadCsv(
      `expenses-${csvDateStamp()}`,
      CSV_HEADERS,
      items.map((expense) => [
        formatDate(expense.expense_date),
        expense.category_name ?? 'Uncategorized',
        expense.description,
        METHOD_LABELS[expense.payment_method] ?? expense.payment_method,
        submitterName(expense),
        STATUS_LABELS[expense.status],
        expense.amount,
      ]),
    );
  };

  const addLabel = canApprove ? 'Add expense' : 'Submit expense';

  const showPending = () => {
    setStatusFilter('PENDING');
    setPage(1);
    document.getElementById('expenses-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const body = (
    <div id="expenses-table" className="scroll-mt-20 space-y-5">
      {/* Heading and primary action */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[18px] font-medium tracking-tight text-foreground">All expenses</h2>
          <p className="mt-1 text-[13.5px] text-foreground-3">
            Every cost you have recorded for {business?.name ?? 'this business'}, and what is still awaiting
            approval.
          </p>
        </div>
        <ToolbarButton icon="add" variant="solid" onClick={() => setFormOpen(true)}>
          {addLabel}
        </ToolbarButton>
      </div>

      {reviewError && !rejectExpense && (
        <Alert variant="error" title="Could not update the expense">
          {reviewError}
        </Alert>
      )}
      {error && (
        <Alert variant="error" title="Could not load expenses" inline>
          {apiErrorMessage(error)}
        </Alert>
      )}

      <ListToolbar
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
              label="Category"
              value={categoryFilter}
              onChange={(value) => {
                setCategoryFilter(value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All categories' },
                ...(categoriesQuery.data ?? []).map((category) => ({
                  value: category.id,
                  label: category.name,
                })),
              ]}
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
              label="Payment method"
              value={methodFilter}
              onChange={(value) => {
                setMethodFilter(value);
                setPage(1);
              }}
              options={PAYMENT_METHOD_OPTIONS}
            />
          </>
        }
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search by description"
        actions={
          <ToolbarButton icon="export" variant="outline" onClick={exportCsv} disabled={items.length === 0}>
            Export CSV
          </ToolbarButton>
        }
      />

      <DataTable<Expense>
        columns={columns}
        rows={items}
        rowKey={(expense) => expense.id}
        loading={isLoading}
        dot={(expense) => statusDot(expense.status)}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
        empty={
          noExpensesYet ? (
            <TableEmpty
              title="No expenses yet"
              description="Record expenses like rent and supplies to see your real profit."
              actionLabel={addLabel}
              onAction={() => setFormOpen(true)}
            />
          ) : (
            <TableEmpty
              title="No expenses found"
              description="No expense matches this search or filter. Try widening the date range."
              onClear={clearFilters}
            />
          )
        }
      />

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
        open={Boolean(editExpense)}
        onOpenChange={(open) => !open && setEditExpense(null)}
        title="Edit expense"
      >
        {editExpense && (
          <ExpenseForm
            onClose={() => setEditExpense(null)}
            defaultValues={{
              id: editExpense.id,
              description: editExpense.description,
              amount: editExpense.amount,
              categoryId: editExpense.categoryId,
              payment_method: editExpense.payment_method,
              expense_date: editExpense.expense_date,
              receipt_url: editExpense.receipt_url,
            }}
          />
        )}
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
            <Label htmlFor="desktop-reject-reason">Reason</Label>
            <Textarea
              id="desktop-reject-reason"
              value={rejectReason}
              maxLength={300}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="e.g. No receipt attached, or not a business expense"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectExpense(null)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" size="sm" loading={rejectMutation.isPending}>
              Reject expense
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete this expense?"
        description={`"${confirmDelete?.description}" of ${confirmDelete ? formatKES(confirmDelete.amount) : ''} will be removed.`}
      >
        <div className="space-y-4">
          {deleteError && <Alert variant="error">{deleteError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              loading={deleteMutation.isPending}
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
            >
              Delete expense
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );

  // Approvers see the expenses dashboard (chart, strip and figures) above the list
  if (!canApprove) return body;
  return (
    <RailLayout rail={<ExpensesRail days={overviewDays} onShowPending={showPending} />}>
      <ExpensesOverview days={overviewDays} onDaysChange={setOverviewDays} onShowPending={showPending} />
      {body}
    </RailLayout>
  );
}
