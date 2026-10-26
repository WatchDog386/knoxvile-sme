import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Receipt,
  Plus,
  XCircle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { salesApi } from '@/api/endpoints';
import { AppBar } from '@/components/layout/app-bar';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { Badge, statusVariant, statusLabel } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageLoader } from '@/components/ui/spinner';
import { cn, formatKES, formatDateTime } from '@/lib/utils';
import { DocumentActions, invoiceNo } from '@/features/isp/document-actions';
import { DEFAULT_PAYMENT_METHODS } from '@/lib/constants';

const paymentSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Enter an amount.' })
    .min(1, 'Enter a valid amount.'),
  method: z.string().min(1, 'Select a payment method.'),
  reference: z.string().optional().or(z.literal('')),
});

type PaymentValues = z.infer<typeof paymentSchema>;

export function SaleDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales', id],
    queryFn: () => salesApi.get(id),
  });

  const cancelMutation = useMutation({
    mutationFn: () => salesApi.cancel(id),
    onSuccess: async () => {
      setCancelOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => setCancelError(apiErrorMessage(err)),
  });

  if (isLoading) return <PageLoader />;

  if (error || !data) {
    return (
      <Alert variant="error" title="Sale not found" inline>
        {apiErrorMessage(error)}
      </Alert>
    );
  }

  const sale = data;
  const cashPaid = sale.payments.reduce((acc, p) => acc + p.amount, 0);
  const advanceCredit = sale.advance_credit ?? 0;
  const paid = cashPaid + advanceCredit;
  const remaining = Math.max(0, sale.total - paid);
  const canCancel = sale.payment_status !== 'CANCELLED' && sale.payment_status !== 'REFUNDED';

  return (
    <div className="space-y-4 pb-10 font-sans text-[14px]">
      <AppBar
        title="Sale detail"
        onBack={() => navigate(-1)}
      />

      {/* Sale header — flat, advanced */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Receipt className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  {sale.number ? invoiceNo(sale.number) : `#${sale.id.slice(0, 8).toUpperCase()}`}
                </h2>
                <Badge variant={statusVariant(sale.payment_status)}>{statusLabel(sale.payment_status)}</Badge>
                <span className="text-[11px] font-medium text-foreground-4">{saleCategoryLabel(sale.sale_type)}</span>
              </div>
              <p className="text-xs text-foreground-4">{formatDateTime(sale.created_at)} · {sale.customer?.name ?? 'Walk-in customer'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-4">Total</p>
            <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">{formatKES(sale.total)}</p>
          </div>
        </div>
        <div className="h-px bg-edge/60 mx-1" aria-hidden />
      </div>

      {/* Sale actions, out of the header so it stays uncluttered */}
      {(canCancel || (remaining > 0 && sale.payment_status !== 'CANCELLED')) && (
        <div className="grid grid-cols-2 gap-3">
          {remaining > 0 && sale.payment_status !== 'CANCELLED' && (
            <Button className={cn('h-11 rounded-full', !canCancel && 'col-span-2')} onClick={() => setPaymentOpen(true)}>
              <Plus className="h-4 w-4" />
              Record payment
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              className={cn(
                'h-11 rounded-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700',
                !(remaining > 0 && sale.payment_status !== 'CANCELLED') && 'col-span-2',
              )}
              onClick={() => setCancelOpen(true)}
            >
              <XCircle className="h-4 w-4" />
              Cancel sale
            </Button>
          )}
        </div>
      )}

      {sale.payment_status !== 'CANCELLED' && <DocumentActions sale={sale} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Items — flat, polished */}
        <section className="space-y-2">
          <h2 className="px-1 text-[13px] font-medium tracking-tight text-foreground">Items — {sale.items.length}</h2>
          {sale.items.length === 0 ? (
            <p className="rounded-xl bg-surface-2 px-3 py-3 text-xs text-foreground-4">Amount-only record · {saleCategoryLabel(sale.sale_type)}</p>
          ) : <ul className="divide-y divide-edge max-lg:divide-y-0">
            {sale.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-1 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.product_name ?? item.service_name ?? item.item_name}</p>
                  <p className="text-xs tabular-nums text-foreground-5">{item.quantity} × {formatKES(item.unit_price)}</p>
                </div>
                <span className="text-sm font-medium tabular-nums text-foreground">{formatKES(item.total)}</span>
              </li>
            ))}
          </ul>}
          <div className="space-y-1.5 px-1 pt-3">
            <div className="flex justify-between text-xs">
              <span className="text-foreground-4">Subtotal</span>
              <span className="font-medium tabular-nums text-foreground">{formatKES(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-foreground-4">Discount</span>
                <span className="font-medium tabular-nums text-danger">−{formatKES(sale.discount)}</span>
              </div>
            )}
            {advanceCredit > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-foreground-4">Client advance applied</span>
                <span className="font-medium tabular-nums text-foreground">−{formatKES(advanceCredit)}</span>
              </div>
            )}
            {sale.sale_type === 'ADVANCE' && (sale.advance_used ?? 0) > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-foreground-4">Advance still available</span>
                <span className="font-medium tabular-nums text-foreground">{formatKES(Math.max(0, sale.total - (sale.advance_used ?? 0)))}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-edge pt-2.5 text-sm font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatKES(sale.total)}</span>
            </div>
          </div>
          {sale.notes && <p className="mx-1 rounded-xl bg-surface-2 px-3 py-2 text-xs leading-relaxed text-foreground-5">{sale.notes}</p>}
        </section>

        <div className="space-y-6">
          {/* Payments — flat */}
          <section className="space-y-2">
            <h2 className="px-1 text-[13px] font-medium tracking-tight text-foreground">Payments</h2>
            {sale.payments.length === 0 && advanceCredit === 0 ? (
              <p className="px-1 text-sm text-foreground-4">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-edge max-lg:divide-y-0">
                {advanceCredit > 0 && (
                  <li className="flex items-center justify-between px-1 py-3">
                    <div><p className="text-sm font-medium text-foreground">Client advance applied</p><p className="text-xs text-foreground-5">Existing advance · not a new cash receipt</p></div>
                    <span className="text-sm font-medium tabular-nums text-foreground">{formatKES(advanceCredit)}</span>
                  </li>
                )}
                {sale.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between px-1 py-3 hover:bg-surface-2 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {payment.method}
                        {payment.reference && <span className="text-xs font-normal text-foreground-5"> · {payment.reference}</span>}
                      </p>
                      <p className="text-xs text-foreground-5">{formatDateTime(payment.transaction_date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums text-foreground">{formatKES(payment.amount)}</p>
                      <Badge variant={statusVariant(payment.status)}>{statusLabel(payment.status)}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-1 px-1 pt-3 border-t border-edge">
              <div className="flex justify-between text-xs">
                <span className="text-foreground-4">Paid</span>
                <span className="font-medium tabular-nums text-success">{formatKES(paid)}</span>
              </div>
              {remaining > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-foreground-4">Remaining</span>
                  <span className="font-medium tabular-nums text-danger">{formatKES(remaining)}</span>
                </div>
              )}
            </div>
          </section>

          {/* Customer — flat, advanced */}
          {sale.customer && (
            <section className="space-y-2">
              <h2 className="px-1 text-[13px] font-medium tracking-tight text-foreground">Customer</h2>
              <div className="flex items-center justify-between px-1 py-3 hover:bg-surface-2 rounded-xl transition-colors">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent font-medium">
                    {sale.customer.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{sale.customer.name}</p>
                    <p className="text-xs text-foreground-5">{sale.customer.phone ?? 'No phone'} · owes {formatKES(sale.customer.outstanding_balance)}</p>
                  </div>
                </div>
                <Link to={`/customers/${sale.customer.id}`} className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-strong">
                  View profile <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </section>
          )}
        </div>
      </div>

      <RecordPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        saleId={sale.id}
        remaining={remaining}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this sale?"
        description="Cancelling reverses the sale: stock is returned, customer balances are corrected, and all payments are refunded. This cannot be undone."
        confirmLabel="Cancel sale"
        destructive
        loading={cancelMutation.isPending}
        error={cancelError}
        onConfirm={() => cancelMutation.mutate()}
      />
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

function RecordPaymentDialog({
  open,
  onOpenChange,
  saleId,
  remaining,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  remaining: number;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError: setFormError,
    reset,
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: remaining, method: 'CASH', reference: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: PaymentValues) =>
      salesApi.recordPayment(saleId, {
        amount: values.amount,
        method: values.method,
        reference: values.reference || undefined,
      }),
    onSuccess: async () => {
      onOpenChange(false);
      reset();
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err) => setFormError('root', { message: apiErrorMessage(err) }),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record a payment"
      description={`${formatKES(remaining)} remaining on this sale.`}
    >
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        {errors.root && <Alert variant="error" inline>{errors.root.message}</Alert>}
        <div>
          <Label htmlFor="payment-amount">Amount (KSh)</Label>
          <Input
            id="payment-amount"
            type="number"
            inputMode="numeric"
            min={1}
            max={remaining}
            aria-invalid={errors.amount ? true : undefined}
            {...register('amount')}
          />
          {errors.amount && (
            <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="payment-method">Payment method</Label>
          <Select
            id="payment-method"
            aria-invalid={errors.method ? true : undefined}
            {...register('method')}
          >
            {DEFAULT_PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method === 'M-PESA'
                  ? 'M-Pesa'
                  : method.charAt(0) + method.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
          {errors.method && (
            <p className="mt-1 text-xs text-danger">{errors.method.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="payment-reference">Reference (optional)</Label>
          <Input
            id="payment-reference"
            placeholder="e.g. M-Pesa receipt code"
            {...register('reference')}
          />
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            <CheckCircle2 className="h-4 w-4" />
            Record payment
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
