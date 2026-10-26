import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';

const schema = z.object({
  name: z.string().min(2, 'Enter the customer name.').max(150),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('Enter a valid email.').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function CustomerForm({
  onClose,
  defaultValues,
  sheetStyle = false,
}: {
  onClose: () => void;
  /** Clear / Add buttons in the lime-and-charcoal sheet style. */
  sheetStyle?: boolean;
  defaultValues?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
  };
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(defaultValues);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError: setFormError,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      phone: defaultValues?.phone ?? '',
      email: defaultValues?.email ?? '',
      address: defaultValues?.address ?? '',
      notes: defaultValues?.notes ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        phone: values.phone || undefined,
        email: values.email || undefined,
        address: values.address || undefined,
        notes: values.notes || undefined,
      };
      return defaultValues
        ? customersApi.update(defaultValues.id, payload)
        : customersApi.create(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    },
    onError: (err) =>
      setFormError('root', { message: apiErrorMessage(err) }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit((values) => mutation.mutate(values))}
      noValidate
    >
      {errors.root && <Alert variant="error" inline>{errors.root.message}</Alert>}
      <div>
        <Label htmlFor="customer-name">Name</Label>
        <Input
          id="customer-name"
          placeholder="e.g. Mary Wanjiku"
          aria-invalid={errors.name ? true : undefined}
          {...register('name')}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="customer-phone">Phone</Label>
          <Input
            id="customer-phone"
            type="tel"
            placeholder="0712 345 678"
            aria-invalid={errors.phone ? true : undefined}
            {...register('phone')}
          />
          {errors.phone && (
            <p className="mt-1 text-xs text-danger">{errors.phone.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="customer-email">Email</Label>
          <Input
            id="customer-email"
            type="email"
            placeholder="mary@example.com"
            aria-invalid={errors.email ? true : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-danger">{errors.email.message}</p>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="customer-address">Address</Label>
        <Input
          id="customer-address"
          placeholder="e.g. Umoja, Nairobi"
          {...register('address')}
        />
      </div>
      <div>
        <Label htmlFor="customer-notes">Notes</Label>
        <Textarea
          id="customer-notes"
          placeholder="Anything to remember about this customer..."
          {...register('notes')}
        />
      </div>
      {sheetStyle ? (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => reset()}
            disabled={mutation.isPending}
            className="h-12 rounded-full border border-edge bg-surface text-[14px] font-semibold text-foreground active:scale-[0.98]"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#1C1F1B] text-[14px] font-semibold text-white active:scale-[0.98] disabled:opacity-70"
          >
            {mutation.isPending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />}
            {isEdit ? 'Save' : 'Add'}
          </button>
        </div>
      ) : (
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {isEdit ? 'Save changes' : 'Add customer'}
          </Button>
        </div>
      )}
    </form>
  );
}
