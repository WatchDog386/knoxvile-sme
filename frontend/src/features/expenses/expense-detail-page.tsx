import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, FileText, Pencil, Repeat, Trash2, Wallet, X } from 'lucide-react';
import { expensesApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { AppBar } from '@/components/layout/app-bar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { Badge, statusVariant, statusLabel } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { PageLoader } from '@/components/ui/spinner';
import { notifySuccess } from '@/components/ui/popup-host';
import { useRole } from '@/hooks/use-role';
import { cn, formatKES, formatDate, formatDateTime } from '@/lib/utils';
import { ExpenseForm } from './expense-form';

/** Receipts are stored as data URLs; the form only accepts images and PDFs. */
function receiptKind(url: string): 'image' | 'pdf' | 'file' {
  if (url.startsWith('data:image')) return 'image';
  if (url.startsWith('data:application/pdf') || url.toLowerCase().endsWith('.pdf')) return 'pdf';
  return 'file';
}

/** One label/value line in the details list. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3 px-1 py-3">
      <span className="shrink-0 text-xs text-foreground-4">{label}</span>
      <span className="min-w-0 truncate text-right text-sm font-medium text-foreground-2">{value}</span>
    </li>
  );
}

/** Full expense: the same shape as the Sale detail page, with the receipt previewed inline. */
export function ExpenseDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canApprove, canManage } = useRole();

  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: expense, isLoading, error } = useQuery({
    queryKey: ['expenses', id],
    queryFn: () => expensesApi.get(id),
  });

  const refreshAll = async () => {
    await Promise.all(
      ['expenses', 'dashboard', 'reports', 'budgets'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };

  const approveMutation = useMutation({
    mutationFn: () => expensesApi.approve(id),
    onSuccess: async (approved) => {
      setReviewError(null);
      notifySuccess('Expense approved', `"${approved.description}" was approved.`);
      await refreshAll();
    },
    onError: (err) => setReviewError(apiErrorMessage(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => expensesApi.reject(id, reason),
    onSuccess: async (rejected) => {
      setRejectOpen(false);
      setRejectReason('');
      setReviewError(null);
      notifySuccess('Expense rejected', `"${rejected.description}" was rejected.`);
      await refreshAll();
    },
    onError: (err) => setReviewError(apiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => expensesApi.remove(id),
    onSuccess: async () => {
      setDeleteOpen(false);
      setDeleteError(null);
      await refreshAll();
      navigate('/expenses', { replace: true });
    },
    onError: (err) => setDeleteError(apiErrorMessage(err)),
  });

  if (isLoading) return <PageLoader />;

  if (error || !expense) {
    return (
      <>
        <AppBar title="Expense detail" />
        <Alert variant="error" title="Expense not found" inline>
          {apiErrorMessage(error)}
        </Alert>
      </>
    );
  }

  // Employees may only change their own submissions while they are still pending.
  const canEdit = canApprove || expense.status === 'PENDING';
  const canDelete = canManage || (!canApprove && expense.status === 'PENDING');
  const canReview = canApprove && expense.status === 'PENDING';
  const receipt = expense.receipt_url;
  const kind = receipt ? receiptKind(receipt) : null;

  const actions: Array<{ key: string; node: React.ReactNode }> = [];
  if (canReview) {
    actions.push({
      key: 'approve',
      node: (
        <Button
          className="h-11 w-full rounded-full"
          loading={approveMutation.isPending}
          onClick={() => approveMutation.mutate()}
        >
          <Check className="h-4 w-4" />
          Approve
        </Button>
      ),
    });
    actions.push({
      key: 'reject',
      node: (
        <Button
          variant="outline"
          className="h-11 w-full rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => {
            setReviewError(null);
            setRejectReason('');
            setRejectOpen(true);
          }}
        >
          <X className="h-4 w-4" />
          Reject
        </Button>
      ),
    });
  }
  if (canEdit) {
    actions.push({
      key: 'edit',
      node: (
        <Button variant="outline" className="h-11 w-full rounded-full" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      ),
    });
  }
  if (canDelete) {
    actions.push({
      key: 'delete',
      node: (
        <Button
          variant="outline"
          className="h-11 w-full rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => {
            setDeleteError(null);
            setDeleteOpen(true);
          }}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      ),
    });
  }

  return (
    <div className="space-y-4 pb-10 font-sans text-[14px]">
      <AppBar title="Expense detail" />

      {/* Expense header — flat, matching the Sale detail page */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Wallet className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  {expense.description}
                </h2>
                <Badge variant={statusVariant(expense.status)}>{statusLabel(expense.status)}</Badge>
                {expense.recurringExpenseId && (
                  <Badge variant="outline">
                    <Repeat className="h-3 w-3" aria-hidden />
                    Recurring
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-foreground-4">
                {formatDateTime(expense.expense_date)} ·{' '}
                {expense.category_name ?? 'Uncategorized'}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-4">Amount</p>
            <p className="text-xl font-semibold tabular-nums tracking-tight text-danger">
              −{formatKES(expense.amount)}
            </p>
          </div>
        </div>
        <div className="mx-1 h-px bg-edge/60" aria-hidden />
      </div>

      {expense.status === 'REJECTED' && expense.rejection_reason && (
        <Alert variant="error" title="Rejected" inline>
          {expense.rejection_reason}
        </Alert>
      )}

      {actions.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action, i) => (
            <div
              key={action.key}
              className={cn(actions.length % 2 === 1 && i === actions.length - 1 && 'col-span-2')}
            >
              {action.node}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="px-1 text-[13px] font-medium tracking-tight text-foreground">Details</h2>
          <ul className="divide-y divide-edge max-lg:divide-y-0">
            <DetailRow label="Category" value={expense.category_name ?? 'Uncategorized'} />
            <DetailRow label="Payment method" value={expense.payment_method} />
            <DetailRow label="Expense date" value={formatDate(expense.expense_date)} />
            <DetailRow label="Recorded" value={formatDateTime(expense.created_at)} />
            {expense.reviewed_at && (
              <DetailRow label="Reviewed" value={formatDateTime(expense.reviewed_at)} />
            )}
            <DetailRow label="Reference" value={`#${expense.id.slice(0, 8).toUpperCase()}`} />
          </ul>
          <div className="space-y-1.5 border-t border-edge px-1 pt-3">
            <div className="flex justify-between text-xs">
              <span className="text-foreground-4">Recorded by</span>
              <span className="font-medium text-foreground-2">
                {expense.submittedById ? `#${expense.submittedById.slice(0, 8).toUpperCase()}` : 'The owner'}
              </span>
            </div>
            <div className="flex justify-between border-t border-edge pt-2.5 text-sm font-medium">
              <span>Total</span>
              <span className="tabular-nums text-danger">−{formatKES(expense.amount)}</span>
            </div>
          </div>
        </section>

        {/* Attached document, previewed in place */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 className="text-[13px] font-medium tracking-tight text-foreground">Receipt</h2>
            {receipt && (
              <a
                href={receipt}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-strong"
              >
                Open full size
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </div>
          {!receipt ? (
            <p className="rounded-xl bg-surface-2 px-3 py-3 text-xs text-foreground-4">
              No receipt was attached to this expense.
            </p>
          ) : kind === 'image' ? (
            <a
              href={receipt}
              target="_blank"
              rel="noopener"
              className="block overflow-hidden rounded-xl border border-edge bg-surface-2"
            >
              <img
                src={receipt}
                alt={`Receipt for ${expense.description}`}
                className="max-h-[70vh] w-full object-contain"
              />
            </a>
          ) : kind === 'pdf' ? (
            <object
              data={receipt}
              type="application/pdf"
              className="h-[70vh] w-full overflow-hidden rounded-xl border border-edge bg-surface-2"
            >
              {/* Shown only when the browser cannot render a PDF inline. */}
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <FileText className="h-8 w-8 text-foreground-4" aria-hidden />
                <p className="text-xs text-foreground-4">This browser cannot preview the PDF here.</p>
                <a
                  href={receipt}
                  target="_blank"
                  rel="noopener"
                  className="text-xs font-medium text-accent underline"
                >
                  Open the receipt
                </a>
              </div>
            </object>
          ) : (
            <a
              href={receipt}
              target="_blank"
              rel="noopener"
              className="flex items-center justify-between gap-3 rounded-xl border border-edge bg-surface-2 px-3 py-3 transition-colors hover:bg-surface-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-foreground-4" aria-hidden />
                <span className="truncate text-sm font-medium text-foreground-2">View attached document</span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-foreground-4" aria-hidden />
            </a>
          )}
        </section>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit expense"
      >
        <ExpenseForm
          onClose={() => setEditOpen(false)}
          defaultValues={{
            id: expense.id,
            description: expense.description,
            amount: expense.amount,
            categoryId: expense.categoryId,
            payment_method: expense.payment_method,
            expense_date: expense.expense_date,
            receipt_url: expense.receipt_url,
          }}
          onSaved={() => setEditOpen(false)}
        />
      </Dialog>

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => !open && setRejectOpen(false)}
        title="Reject this expense?"
        description={`"${expense.description}" of ${formatKES(expense.amount)}. The submitter will see your reason.`}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!rejectReason.trim()) {
              setReviewError('Give a reason for rejecting this expense.');
              return;
            }
            rejectMutation.mutate(rejectReason.trim());
          }}
        >
          {reviewError && <Alert variant="error">{reviewError}</Alert>}
          <div>
            <Label htmlFor="detail-reject-reason">Reason</Label>
            <Textarea
              id="detail-reject-reason"
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
              onClick={() => setRejectOpen(false)}
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

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => !open && setDeleteOpen(false)}
        title="Delete this expense?"
        description={`"${expense.description}" of ${formatKES(expense.amount)} will be removed.`}
      >
        <div className="space-y-4">
          {deleteError && <Alert variant="error">{deleteError}</Alert>}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Delete expense
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}