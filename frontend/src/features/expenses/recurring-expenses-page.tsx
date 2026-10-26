import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pause, Play, Plus, Repeat } from 'lucide-react';
import { categoriesApi, recurringExpensesApi } from '@/api/endpoints';
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
import { EXPENSE_PAYMENT_METHODS } from '@/lib/constants';
import { formatDate, formatKES } from '@/lib/utils';
import { useRole } from '@/hooks/use-role';
import type { RecurringExpense } from '@/api/types';

const schema = z.object({
  description: z.string().min(2, 'Describe this expense.').max(150),
  amount: z.coerce
    .number({ invalid_type_error: 'Enter the amount.' })
    .min(1, 'Enter a valid amount.'),
  categoryId: z.string().optional().or(z.literal('')),
  paymentMethod: z.string(),
  dayOfMonth: z.coerce
    .number()
    .int()
    .min(1, 'Pick a day between 1 and 28.')
    .max(28, 'Pick a day between 1 and 28.'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function ordinal(day: number): string {
  const suffix =
    day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  return `${day}${suffix}`;
}

function RecurringForm({
  onClose,
  existing,
}: {
  onClose: () => void;
  existing?: RecurringExpense;
}) {
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: ['categories', 'EXPENSE'],
    queryFn: () => categoriesApi.list('EXPENSE'),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: existing?.description ?? '',
      amount: existing?.amount ?? 0,
      categoryId: existing?.categoryId ?? '',
      paymentMethod: existing?.payment_method ?? 'BANK',
      dayOfMonth: existing?.day_of_month ?? 1,
      startDate: existing?.start_date ?? new Date().toISOString().slice(0, 10),
      endDate: existing?.end_date ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const base = {
        description: values.description,
        amount: values.amount,
        categoryId: values.categoryId || undefined,
        paymentMethod: values.paymentMethod,
        dayOfMonth: values.dayOfMonth,
        endDate: values.endDate || null,
      };
      return existing
        ? recurringExpensesApi.update(existing.id, base)
        : recurringExpensesApi.create({ ...base, startDate: values.startDate || undefined });
    },
    onSuccess: async () => {
      await Promise.all(
        ['recurring-expenses', 'expenses', 'dashboard', 'reports', 'budgets'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      onClose();
    },
    onError: (err) => setError('root', { message: apiErrorMessage(err) }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
            {errors.root && <Alert variant="error" inline>{errors.root.message}</Alert>}
      <div>
        <Label htmlFor="rec-description">Description</Label>
        <Input id="rec-description" placeholder="e.g. Office rent" {...register('description')} />
        {errors.description && (
          <p className="mt-1 text-xs text-danger">{errors.description.message}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="rec-amount">Amount (KSh)</Label>
          <Input id="rec-amount" type="number" inputMode="numeric" min={1} {...register('amount')} />
          {errors.amount && <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>}
        </div>
        <div>
          <Label htmlFor="rec-day">Day of month</Label>
          <Input id="rec-day" type="number" inputMode="numeric" min={1} max={28} {...register('dayOfMonth')} />
          {errors.dayOfMonth && (
            <p className="mt-1 text-xs text-danger">{errors.dayOfMonth.message}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="rec-category">Category</Label>
          <Select id="rec-category" placeholder="Uncategorized" {...register('categoryId')}>
            {categoriesQuery.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="rec-method">Payment method</Label>
          <Select id="rec-method" {...register('paymentMethod')}>
            {EXPENSE_PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method === 'M-PESA' ? 'M-Pesa' : method.charAt(0) + method.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="rec-start">Starts</Label>
          <Input id="rec-start" type="date" disabled={Boolean(existing)} {...register('startDate')} />
        </div>
        <div>
          <Label htmlFor="rec-end">Ends (optional)</Label>
          <Input id="rec-end" type="date" {...register('endDate')} />
        </div>
      </div>
      {!existing && (
        <p className="text-xs text-foreground-5">
          If the start date is in the past, any months already due are recorded straight away.
        </p>
      )}
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="outline" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {existing ? 'Save changes' : 'Create recurring expense'}
        </Button>
      </div>
    </form>
  );
}

export function RecurringExpensesPage() {
  const queryClient = useQueryClient();
  const { canApprove } = useRole();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [deleting, setDeleting] = useState<RecurringExpense | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['recurring-expenses'],
    queryFn: () => recurringExpensesApi.list(),
    enabled: canApprove,
  });

  const refresh = () =>
    Promise.all(
      ['recurring-expenses', 'expenses', 'dashboard'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );

  const toggleMutation = useMutation({
    mutationFn: (item: RecurringExpense) =>
      item.active ? recurringExpensesApi.pause(item.id) : recurringExpensesApi.resume(item.id),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (err) => setActionError(apiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => recurringExpensesApi.remove(id),
    onSuccess: async () => {
      setDeleting(null);
      await refresh();
    },
  });

  const monthlyTotal = (data ?? []).filter((r) => r.active).reduce((acc, r) => acc + r.amount, 0);

  return (
    <div className="space-y-5">
      <Link
        to="/expenses"
        className="hidden items-center gap-1.5 text-sm text-foreground-4 hover:text-foreground sm:inline-flex"
      >
        <ArrowLeft className="h-4 w-4" />
        Expenses
      </Link>
      <PageHeader
        title="Recurring expenses"
        description="Rent, salaries and subscriptions are recorded automatically on their day each month."
        actions={
          canApprove && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              New recurring expense
            </Button>
          )
        }
      />

      {!canApprove && (
        <Alert variant="info" inline>Only admins, managers and accountants can manage recurring expenses.</Alert>
      )}
      {error && (
        <Alert variant="error" title="Could not load recurring expenses" inline>
          {apiErrorMessage(error)}
        </Alert>
      )}
      {actionError && <Alert variant="error">{actionError}</Alert>}
      {isLoading && <PageLoader inline message="Loading" />}

      {data && data.length === 0 && (
        <EmptyState
          icon={Repeat}
          title="No recurring expenses yet"
          description="Set up rent, salaries or subscriptions once and they are logged every month."
          actionLabel="Add one"
          onAction={() => setFormOpen(true)}
        />
      )}

      {data && data.length > 0 && (
        <>
          <p className="text-sm text-foreground-4">
            {data.filter((r) => r.active).length} active · {formatKES(monthlyTotal)} per month
          </p>
          <Card className="max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none">
            <ul className="stagger-list divide-y divide-edge max-lg:divide-y-0">
              {data.map((item) => (
                <li key={item.id} className="px-1 py-3 lg:px-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1 basis-48">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{item.description}</p>
                        <Badge variant={item.active ? 'success' : 'secondary'}>
                          {item.active ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-foreground-5">
                        {item.category_name ?? 'Uncategorized'} · {ordinal(item.day_of_month)} of each month ·{' '}
                        {item.payment_method}
                      </p>
                      <p className="text-xs text-foreground-5">
                        {item.next_run_date
                          ? `Next: ${formatDate(item.next_run_date)}`
                          : item.active
                            ? 'Ended'
                            : 'Paused — no new entries'}
                        {item.end_date ? ` · ends ${formatDate(item.end_date)}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-foreground">{formatKES(item.amount)}</p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={toggleMutation.isPending && toggleMutation.variables?.id === item.id}
                        onClick={() => toggleMutation.mutate(item)}
                      >
                        {item.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {item.active ? 'Pause' : 'Resume'}
                      </Button>
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
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen} title="New recurring expense">
        <RecurringForm onClose={() => setFormOpen(false)} />
      </Dialog>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit recurring expense"
        description="Changes apply to future months only."
      >
        {editing && <RecurringForm existing={editing} onClose={() => setEditing(null)} />}
      </Dialog>
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this recurring expense?"
        description={`"${deleting?.description}" will stop being recorded. Expenses already logged are kept.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        error={deleteMutation.error ? apiErrorMessage(deleteMutation.error) : null}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
