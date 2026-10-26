import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

export type StockActionType = 'restock' | 'adjust' | 'damage';

const schema = z.object({
  quantity: z.coerce
    .number({ invalid_type_error: 'Enter a quantity.' })
    .min(1, 'Quantity must be at least 1.'),
  reason: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

const config: Record<
  StockActionType,
  { title: string; label: string; confirm: string }
> = {
  restock: {
    title: 'Add stock',
    label: 'Quantity to add',
    confirm: 'Add stock',
  },
  adjust: {
    title: 'Set stock level',
    label: 'New stock quantity',
    confirm: 'Set stock',
  },
  damage: {
    title: 'Record damaged stock',
    label: 'Quantity damaged',
    confirm: 'Record damage',
  },
};

export function StockActionForm({
  type,
  productId,
  productName,
  onClose,
}: {
  type: StockActionType;
  productId: string;
  productName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { label, confirm } = config[type];

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError: setFormError,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      switch (type) {
        case 'restock':
          return productsApi.restock(productId, values.quantity, values.reason || undefined);
        case 'adjust':
          return productsApi.adjust(productId, values.quantity, values.reason || undefined);
        case 'damage':
          return productsApi.damage(productId, values.quantity, values.reason || undefined);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err) => setFormError('root', { message: apiErrorMessage(err) }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      <p className="text-sm text-foreground-5">
        {productName} — current stock is recorded automatically. A stock
        movement entry will be added to history.
      </p>
      {errors.root && <Alert variant="error" inline>{errors.root.message}</Alert>}
      <div>
        <Label htmlFor="stock-quantity">{label}</Label>
        <Input
          id="stock-quantity"
          type="number"
          inputMode="numeric"
          min={1}
          placeholder="0"
          autoFocus
          aria-invalid={errors.quantity ? true : undefined}
          {...register('quantity')}
        />
        {errors.quantity && (
          <p className="mt-1 text-xs text-danger">{errors.quantity.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="stock-reason">Reason (optional)</Label>
        <Input
          id="stock-reason"
          placeholder="e.g. New delivery from supplier"
          {...register('reason')}
        />
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="outline" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={mutation.isPending}
          variant={type === 'damage' ? 'destructive' : 'default'}
        >
          {confirm}
        </Button>
      </div>
    </form>
  );
}
