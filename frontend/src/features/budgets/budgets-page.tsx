import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, PiggyBank, Plus } from 'lucide-react';
import { budgetsApi, categoriesApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoader } from '@/components/ui/spinner';
import { cn, formatKES } from '@/lib/utils';
import { useRole } from '@/hooks/use-role';
import type { BudgetLevel, BudgetStatus } from '@/api/types';

const LEVEL_STYLES: Record<BudgetLevel, { bar: string; badge: 'success' | 'warning' | 'danger'; label: string }> = {
  OK: { bar: 'bg-success', badge: 'success', label: 'On track' },
  WARNING: { bar: 'bg-warning', badge: 'warning', label: 'Near limit' },
  EXCEEDED: { bar: 'bg-danger', badge: 'danger', label: 'Over budget' },
};

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
}

function BudgetForm({
  existing,
  usedCategoryIds,
  onClose,
}: {
  existing?: BudgetStatus;
  usedCategoryIds: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  const [limit, setLimit] = useState(existing ? String(existing.limit) : '');
  const [threshold, setThreshold] = useState(String(existing?.alert_threshold ?? 80));
  const [formError, setFormError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'EXPENSE'],
    queryFn: () => categoriesApi.list('EXPENSE'),
  });
  const available = (categoriesQuery.data ?? []).filter(
    (c) => c.id === existing?.categoryId || !usedCategoryIds.includes(c.id),
  );

  const mutation = useMutation({
    mutationFn: () => {
      const monthlyLimit = Number(limit);
      const alertThreshold = Number(threshold);
      return existing
        ? budgetsApi.update(existing.id, { monthlyLimit, alertThreshold })
        : budgetsApi.create({ categoryId, monthlyLimit, alertThreshold });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['budgets'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err) => setFormError(apiErrorMessage(err)),
  });

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!existing && !categoryId) return setFormError('Pick a category.');
        if (!(Number(limit) >= 1)) return setFormError('Enter a monthly limit.');
        const t = Number(threshold);
        if (!(t >= 1 && t <= 100)) return setFormError('Alert threshold must be between 1 and 100%.');
        setFormError(null);
        mutation.mutate();
      }}
    >
            {formError && <Alert variant="error" inline>{formError}</Alert>}
      <div>
        <Label htmlFor="budget-category">Category</Label>
        {existing ? (
          <Input id="budget-category" value={existing.category_name} disabled />
        ) : (
          <Select
            id="budget-category"
            value={categoryId}
            placeholder="Choose a category"
            onChange={(event) => setCategoryId(event.target.value)}
          >
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        {!existing && categoriesQuery.data && available.length === 0 && (
          <p className="mt-1 text-xs text-foreground-5">Every expense category already has a budget.</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="budget-limit">Monthly limit (KSh)</Label>
          <Input
            id="budget-limit"
            type="number"
            inputMode="numeric"
            min={1}
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="budget-threshold">Warn at (%)</Label>
          <Input
            id="budget-threshold"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="outline" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {existing ? 'Save budget' : 'Add budget'}
        </Button>
      </div>
    </form>
  );
}

export function BudgetsPage() {
  const queryClient = useQueryClient();
  const { canManage } = useRole();
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetStatus | null>(null);
  const [deleting, setDeleting] = useState<BudgetStatus | null>(null);
  const isCurrentMonth = month === monthKey(new Date());

  const { data, isLoading, error } = useQuery({
    queryKey: ['budgets', 'status', month],
    queryFn: () => budgetsApi.status(month),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => budgetsApi.remove(id),
    onSuccess: async () => {
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ['budgets'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const items = data?.items ?? [];
  const totalLimit = items.reduce((acc, i) => acc + i.limit, 0);
  const totalSpent = items.reduce((acc, i) => acc + i.spent, 0);
  const flagged = items.filter((i) => i.level !== 'OK');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Budgets"
        description="Monthly spending limits per expense category. Only approved expenses count."
        actions={
          canManage && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Add budget
            </Button>
          )
        }
      />

      <div className="flex items-center justify-between gap-2 rounded-2xl border border-edge bg-surface px-2 py-1.5">
        <Button variant="ghost" size="sm" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-medium text-foreground">{monthLabel(month)}</p>
        <Button
          variant="ghost"
          size="sm"
          disabled={isCurrentMonth}
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {error && (
        <Alert variant="error" title="Could not load budgets" inline>
          {apiErrorMessage(error)}
        </Alert>
      )}
      {isLoading && <PageLoader inline message="Loading" />}

      {data && items.length === 0 && (
        <EmptyState
          icon={PiggyBank}
          title="No budgets yet"
          description={
            canManage
              ? 'Set a monthly limit for categories like marketing or transport to get alerts before you overspend.'
              : 'An admin or manager can set monthly limits for expense categories.'
          }
          actionLabel={canManage ? 'Add a budget' : undefined}
          onAction={() => setFormOpen(true)}
        />
      )}

      {items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="p-4 max-lg:border-0 max-lg:bg-transparent max-lg:px-1 max-lg:shadow-none">
              <p className="text-xs text-foreground-5">Spent</p>
              <p className="mt-1 text-lg font-medium text-foreground">{formatKES(totalSpent)}</p>
            </Card>
            <Card className="p-4 max-lg:border-0 max-lg:bg-transparent max-lg:px-1 max-lg:shadow-none">
              <p className="text-xs text-foreground-5">Total budget</p>
              <p className="mt-1 text-lg font-medium text-foreground">{formatKES(totalLimit)}</p>
            </Card>
            <Card className="p-4 max-lg:border-0 max-lg:bg-transparent max-lg:px-1 max-lg:shadow-none">
              <p className="text-xs text-foreground-5">Needs attention</p>
              <p className={cn('mt-1 text-lg font-medium', flagged.length ? 'text-danger' : 'text-success')}>
                {flagged.length ? `${flagged.length} ${flagged.length === 1 ? 'category' : 'categories'}` : 'All on track'}
              </p>
            </Card>
          </div>

          {isCurrentMonth && flagged.length > 0 && (
            <Alert variant="warning" title="Budget alerts" inline>
              {flagged
                .map((i) => `${i.category_name} is at ${i.percent}% of its budget`)
                .join(' · ')}
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {items.map((item) => {
              const style = LEVEL_STYLES[item.level];
              return (
                <Card key={item.id} className="p-4 max-lg:border-0 max-lg:bg-transparent max-lg:px-1 max-lg:shadow-none">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.category_name}</p>
                      <p className="text-xs text-foreground-5">
                        {formatKES(item.spent)} of {formatKES(item.limit)}
                      </p>
                    </div>
                    <Badge variant={style.badge}>
                      {item.level !== 'OK' && <AlertTriangle className="h-3 w-3" aria-hidden />}
                      {style.label}
                    </Badge>
                  </div>
                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3"
                    role="progressbar"
                    aria-valuenow={item.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${item.category_name} budget used`}
                  >
                    <div
                      className={cn('h-full rounded-full transition-all', style.bar)}
                      style={{ width: `${Math.min(100, item.percent)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className={cn(item.remaining < 0 ? 'text-danger' : 'text-foreground-4')}>
                      {item.remaining < 0
                        ? `${formatKES(-item.remaining)} over`
                        : `${formatKES(item.remaining)} left`}
                    </span>
                    <span className="text-foreground-4">{item.percent}%</span>
                  </div>
                  {canManage && (
                    <div className="mt-3 flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(item)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-danger-soft"
                        onClick={() => setDeleting(item)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen} title="Add a budget">
        <BudgetForm usedCategoryIds={items.map((i) => i.categoryId)} onClose={() => setFormOpen(false)} />
      </Dialog>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit budget"
      >
        {editing && (
          <BudgetForm
            existing={editing}
            usedCategoryIds={items.map((i) => i.categoryId)}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this budget?"
        description={`The ${deleting?.category_name} budget and its alerts will be removed. Expenses are not affected.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        error={deleteMutation.error ? apiErrorMessage(deleteMutation.error) : null}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
