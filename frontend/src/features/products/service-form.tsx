import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, servicesApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';

const schema = z.object({
  name: z.string().min(2, 'Enter the service name.').max(150),
  description: z.string().optional().or(z.literal('')),
  price: z.coerce
    .number({ invalid_type_error: 'Enter the price.' })
    .min(0, 'Price cannot be negative.'),
  durationMinutes: z.coerce
    .number({ invalid_type_error: 'Enter a duration.' })
    .min(1, 'Duration must be at least 1 minute.')
    .optional(),
  categoryId: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function ServiceForm({
  onClose,
  onCreated,
  defaultValues,
}: {
  onClose: () => void;
  onCreated?: (service: { id: string; name: string; price: number }) => void;
  defaultValues?: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    duration_minutes: number | null;
    categoryId: string | null;
  };
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(defaultValues);

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'SERVICE'],
    queryFn: () => categoriesApi.list('SERVICE'),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError: setFormError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      price: defaultValues?.price ?? 0,
      durationMinutes: defaultValues?.duration_minutes ?? undefined,
      categoryId: defaultValues?.categoryId ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        price: values.price,
        durationMinutes: values.durationMinutes || undefined,
        categoryId: values.categoryId || undefined,
      };
      return defaultValues
        ? servicesApi.update(defaultValues.id, payload)
        : servicesApi.create(payload);
    },
    onSuccess: async (service) => {
      await queryClient.invalidateQueries({ queryKey: ['services'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (!isEdit) onCreated?.(service);
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
      {errors.root && <Alert variant="error" inline>{errors.root.message}</Alert>}
      <div>
        <Label htmlFor="service-name">Service name</Label>
        <Input
          id="service-name"
          placeholder="e.g. Hair Braiding"
          aria-invalid={errors.name ? true : undefined}
          {...register('name')}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-danger">{errors.name.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="service-description">Description (optional)</Label>
        <Textarea
          id="service-description"
          placeholder="e.g. Full braiding, about 3 hours"
          {...register('description')}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="service-price">Price (KSh)</Label>
          <Input
            id="service-price"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            aria-invalid={errors.price ? true : undefined}
            {...register('price')}
          />
          {errors.price && (
            <p className="mt-1 text-xs text-danger">{errors.price.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="service-duration">Duration (minutes)</Label>
          <Input
            id="service-duration"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="e.g. 60"
            aria-invalid={errors.durationMinutes ? true : undefined}
            {...register('durationMinutes')}
          />
          {errors.durationMinutes && (
            <p className="mt-1 text-xs text-danger">
              {errors.durationMinutes.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="service-category">Category</Label>
          <Select
            id="service-category"
            placeholder="No category"
            {...register('categoryId')}
          >
            {categoriesQuery.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <Button variant="outline" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {isEdit ? 'Save changes' : 'Add service'}
        </Button>
      </div>
    </form>
  );
}
