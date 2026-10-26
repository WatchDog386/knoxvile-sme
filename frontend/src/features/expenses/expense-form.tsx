import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '@/api/endpoints';
import { CategoryPicker } from '@/components/forms/category-picker';
import { RecordDateField, recordDateError, useBusinessToday } from '@/components/forms/record-date-field';
import { businessToday } from '@/lib/business-date';
import { useActiveBusiness } from '@/stores/business';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { EXPENSE_PAYMENT_METHODS } from '@/lib/constants';
import { FileText, Paperclip, X } from 'lucide-react';
import type { Expense } from '@/api/types';

const RECEIPT_MAX_BYTES = 2 * 1024 * 1024;

const schema = z.object({
  description: z.string().min(2, 'Describe this expense.').max(150),
  amount: z.coerce
    .number({ invalid_type_error: 'Enter the amount.' })
    .min(1, 'Enter a valid amount.'),
  categoryId: z.string().optional().or(z.literal('')),
  paymentMethod: z.string().optional(),
  expenseDate: z.string().min(1, 'Pick the date.'),
});

type FormValues = z.infer<typeof schema>;

export function ExpenseForm({
  onClose,
  onSaved,
  defaultValues,
  submitLabel = 'Add expense',
}: {
  onClose: () => void;
  onSaved?: (expense: Expense) => void;
  defaultValues?: {
    id: string;
    description: string;
    amount: number;
    categoryId: string | null;
    payment_method: string;
    expense_date: string;
    receipt_url?: string | null;
  };
  submitLabel?: string;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(defaultValues);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(
    defaultValues?.receipt_url ?? null,
  );
  const [receiptName, setReceiptName] = useState<string | null>(
    defaultValues?.receipt_url ? 'Attached receipt' : null,
  );
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const handleReceiptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > RECEIPT_MAX_BYTES) {
      setReceiptError('Receipt must be 2 MB or smaller.');
      return;
    }
    setReceiptError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptUrl(reader.result as string);
      setReceiptName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const today = useBusinessToday();
  const timezone = useActiveBusiness()?.timezone;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    setError: setFormError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: defaultValues?.description ?? '',
      amount: defaultValues?.amount ?? 0,
      categoryId: defaultValues?.categoryId ?? '',
      paymentMethod: defaultValues?.payment_method ?? 'CASH',
      // The day it happened in the business's timezone (an existing expense keeps its day)
      expenseDate: defaultValues?.expense_date ? businessToday(timezone, new Date(defaultValues.expense_date)) : today,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        description: values.description,
        amount: values.amount,
        categoryId: values.categoryId || undefined,
        paymentMethod: values.paymentMethod || 'CASH',
        expenseDate: values.expenseDate,
        // An empty string clears an existing receipt on edit.
        ...(receiptUrl !== (defaultValues?.receipt_url ?? null)
          ? { receiptUrl: receiptUrl ?? '' }
          : {}),
      };
      return defaultValues
        ? expensesApi.update(defaultValues.id, payload)
        : expensesApi.create(payload);
    },
    onSuccess: async (expense) => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['reports'] });
      await queryClient.invalidateQueries({ queryKey: ['budgets'] });
      onSaved?.(expense);
      onClose();
    },
    onError: (err) => setFormError('root', { message: apiErrorMessage(err) }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((values) => {
        const dateError = recordDateError(values.expenseDate, today);
        if (dateError) {
          setFormError('expenseDate', { message: dateError });
          return;
        }
        mutation.mutate(values);
      })}
      noValidate
    >
      {errors.root && <Alert variant="error" inline>{errors.root.message}</Alert>}
      <div>
        <Label htmlFor="expense-description">Description</Label>
        <Input
          id="expense-description"
          placeholder="e.g. Shop rent"
          aria-invalid={errors.description ? true : undefined}
          {...register('description')}
        />
        {errors.description && (
          <p className="mt-1 text-xs text-danger">
            {errors.description.message}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="expense-amount">Amount (KSh)</Label>
          <Input
            id="expense-amount"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="0"
            aria-invalid={errors.amount ? true : undefined}
            {...register('amount')}
          />
          {errors.amount && (
            <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>
          )}
        </div>
        <RecordDateField id="expense-date" error={errors.expenseDate?.message} {...register('expenseDate')} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CategoryPicker
          type="EXPENSE"
          id="expense-category"
          value={watch('categoryId') ?? ''}
          onChange={(id) => setValue('categoryId', id)}
        />
        <div>
          <Label htmlFor="expense-method">Payment method</Label>
          <Select
            id="expense-method"
            {...register('paymentMethod')}
          >
            {EXPENSE_PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method === 'M-PESA'
                  ? 'M-Pesa'
                  : method.charAt(0) + method.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="expense-receipt">Receipt (optional)</Label>
        <input
          id="expense-receipt"
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleReceiptChange}
        />
        {receiptUrl ? (
          <div className="flex items-center gap-3 rounded-2xl border border-edge bg-field px-3 py-2">
            {receiptUrl.startsWith('data:image') ? (
              <img
                src={receiptUrl}
                alt="Receipt preview"
                className="h-12 w-12 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <FileText className="h-6 w-6 shrink-0 text-foreground-4" aria-hidden />
            )}
            <p className="min-w-0 flex-1 truncate text-sm text-foreground-2">
              {receiptName}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setReceiptUrl(null);
                setReceiptName(null);
              }}
              aria-label="Remove receipt"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
            Attach photo or PDF
          </Button>
        )}
        {receiptError && <p className="mt-1 text-xs text-danger">{receiptError}</p>}
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="outline" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {isEdit ? 'Save changes' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
