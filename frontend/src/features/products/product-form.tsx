import { useEffect, useRef } from 'react';
import { useForm, type UseFormSetValue } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi, productsApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import type { Product } from '@/api/types';

export type ProductKind = 'package' | 'product';

const optionalNumber = z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.number().min(0).optional());

const packageSchema = z.object({
  name: z.string().min(2, 'Enter the package name.').max(150),
  sku: z.string().optional().or(z.literal('')),
  sellingPrice: z.coerce.number({ invalid_type_error: 'Enter the monthly price.' }).min(0, 'Price cannot be negative.'),
  speedMbps: z.coerce.number({ invalid_type_error: 'Enter the speed.' }).min(1, 'Enter the speed in Mbps.'),
  description: z.string().max(500).optional().or(z.literal('')),
});

const productSchema = z.object({
  name: z.string().min(2, 'Enter the product name.').max(150),
  sku: z.string().optional().or(z.literal('')),
  categoryId: z.string().optional().or(z.literal('')),
  costPrice: z.coerce.number({ invalid_type_error: 'Enter the cost price.' }).min(0, 'Cost price cannot be negative.'),
  sellingPrice: z.coerce.number({ invalid_type_error: 'Enter the selling price.' }).min(0, 'Selling price cannot be negative.'),
  stockQuantity: optionalNumber,
  description: z.string().max(500).optional().or(z.literal('')),
});

type PackageValues = z.infer<typeof packageSchema>;
type ProductValues = z.infer<typeof productSchema>;

type Existing = {
  id: string;
  name: string;
  sku: string | null;
  categoryId: string | null;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  track_inventory: boolean;
  billing_days?: number | null;
  speed_mbps?: number | null;
  description?: string | null;
};

/**
 * Add or edit a WiFi package (name, code, monthly price, speed, description)
 * or a product (name, code, category, cost and selling price, opening stock,
 * description). Editing picks the kind from the item itself.
 */
export function ProductForm({
  onClose,
  defaultValues,
  kind: kindProp = 'product',
  onCreated,
  submitLabel,
}: {
  onClose: () => void;
  kind?: ProductKind;
  defaultValues?: Existing;
  /** Called with the saved item, e.g. to put a just-created product straight into a sale. */
  onCreated?: (product: Product) => void;
  /** Replaces the default "Add product" / "Add package" button label. */
  submitLabel?: string;
}) {
  const kind: ProductKind = defaultValues ? (defaultValues.billing_days ? 'package' : 'product') : kindProp;
  const extra = { onCreated, submitLabel };
  return kind === 'package' ? (
    <PackageForm onClose={onClose} defaultValues={defaultValues} {...extra} />
  ) : (
    <ItemForm onClose={onClose} defaultValues={defaultValues} {...extra} />
  );
}

type FormExtras = { onCreated?: (product: Product) => void; submitLabel?: string };

function useSaved(onClose: () => void, onCreated?: (product: Product) => void) {
  const queryClient = useQueryClient();
  return async (product: Product) => {
    await queryClient.invalidateQueries({ queryKey: ['products'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    onCreated?.(product);
    onClose();
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-danger">{message}</p> : null;
}

function FormButtons({ onClose, pending, label }: { onClose: () => void; pending: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-3 pt-1">
      <Button variant="outline" type="button" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" loading={pending}>
        {label}
      </Button>
    </div>
  );
}

/* ---------------- Auto code ---------------- */

function slug(text: string, max: number): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

/**
 * Fills the code from the name (and speed) as the user types, e.g.
 * PKG-GAZZELLE-30 or PRD-TP-LINK-ARCHER, adding -2, -3… if that code is
 * already used. Stops once the user types their own code.
 */
function useAutoCode(
  base: string,
  setValue: UseFormSetValue<{ sku?: string }>,
  { enabled, selfId }: { enabled: boolean; selfId?: string },
) {
  const touched = useRef(!enabled);
  const productsQuery = useQuery({
    queryKey: ['products', { page: 1, limit: 100 }],
    queryFn: () => productsApi.list({ page: 1, limit: 100 }),
    enabled,
  });
  useEffect(() => {
    if (touched.current) return;
    if (!base) {
      setValue('sku', '');
      return;
    }
    const taken = new Set(
      (productsQuery.data?.items ?? []).filter((p) => p.id !== selfId && p.sku).map((p) => p.sku!.toUpperCase()),
    );
    let code = base;
    for (let n = 2; taken.has(code); n++) code = `${base}-${n}`;
    setValue('sku', code);
  }, [base, productsQuery.data, selfId, setValue]);
  return { onCodeTyped: () => (touched.current = true) };
}

/* ---------------- WiFi package ---------------- */

function PackageForm({
  onClose,
  defaultValues,
  onCreated,
  submitLabel,
}: { onClose: () => void; defaultValues?: Existing } & FormExtras) {
  const saved = useSaved(onClose, onCreated);
  // Packages go in "Internet Packages" automatically; there's no category to pick
  const categoriesQuery = useQuery({ queryKey: ['categories', 'PRODUCT'], queryFn: () => categoriesApi.list('PRODUCT') });
  const internetCategory = categoriesQuery.data?.find((c) => /internet packages?/i.test(c.name))?.id;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    setError,
  } = useForm<PackageValues>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      sku: defaultValues?.sku ?? '',
      sellingPrice: defaultValues?.selling_price ?? undefined,
      speedMbps: defaultValues?.speed_mbps ?? undefined,
      description: defaultValues?.description ?? '',
    },
  });

  const pkgName = slug(watch('name') ?? '', 24);
  const pkgSpeed = Number(watch('speedMbps')) || 0;
  const { onCodeTyped: onPkgCodeTyped } = useAutoCode(
    pkgName ? `PKG-${pkgName}${pkgSpeed ? `-${pkgSpeed}` : ''}` : '',
    setValue as unknown as UseFormSetValue<{ sku?: string }>,
    { enabled: !defaultValues?.sku, selfId: defaultValues?.id },
  );

  const mutation = useMutation({
    mutationFn: (v: PackageValues) => {
      const payload = {
        name: v.name,
        sku: v.sku || undefined,
        sellingPrice: v.sellingPrice,
        speedMbps: v.speedMbps,
        description: v.description || null,
        // Monthly plan, sold as access (no stock); keeps any existing values on edit
        billingDays: defaultValues?.billing_days || 30,
        costPrice: defaultValues?.cost_price ?? 0,
        trackInventory: false,
        ...(defaultValues ? {} : internetCategory ? { categoryId: internetCategory } : {}),
      };
      return defaultValues ? productsApi.update(defaultValues.id, payload) : productsApi.create(payload);
    },
    onSuccess: saved,
    onError: (err) => setError('root', { message: apiErrorMessage(err) }),
  });

  return (
    <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
      {errors.root && <Alert variant="error" inline>{errors.root.message}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="pkg-name">Package name</Label>
          <Input id="pkg-name" placeholder="e.g. Home 30 Mbps" aria-invalid={errors.name ? true : undefined} {...register('name')} />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="pkg-code">Code</Label>
          <Input id="pkg-code" placeholder="Made from the name" {...register('sku', { onChange: onPkgCodeTyped })} />
          <p className="mt-1 text-[11px] text-foreground-4">Filled in for you from the name and speed. You can change it.</p>
        </div>
        <div>
          <Label htmlFor="pkg-price">Monthly price (KSh)</Label>
          <Input id="pkg-price" type="number" inputMode="numeric" min={0} placeholder="2999" aria-invalid={errors.sellingPrice ? true : undefined} {...register('sellingPrice')} />
          <FieldError message={errors.sellingPrice?.message} />
        </div>
        <div>
          <Label htmlFor="pkg-speed">Speed (Mbps)</Label>
          <Input id="pkg-speed" type="number" inputMode="numeric" min={1} placeholder="30" aria-invalid={errors.speedMbps ? true : undefined} {...register('speedMbps')} />
          <FieldError message={errors.speedMbps?.message} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="pkg-description">Description</Label>
          <Textarea id="pkg-description" rows={3} placeholder="e.g. Multiple devices, low latency" {...register('description')} />
        </div>
      </div>
      <FormButtons onClose={onClose} pending={mutation.isPending} label={submitLabel ?? (defaultValues ? 'Save changes' : 'Add package')} />
    </form>
  );
}

/* ---------------- Product (stock item) ---------------- */

function ItemForm({
  onClose,
  defaultValues,
  onCreated,
  submitLabel,
}: { onClose: () => void; defaultValues?: Existing } & FormExtras) {
  const saved = useSaved(onClose, onCreated);
  const isEdit = Boolean(defaultValues);
  const categoriesQuery = useQuery({ queryKey: ['categories', 'PRODUCT'], queryFn: () => categoriesApi.list('PRODUCT') });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    setError,
  } = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      sku: defaultValues?.sku ?? '',
      categoryId: defaultValues?.categoryId ?? '',
      costPrice: defaultValues?.cost_price ?? undefined,
      sellingPrice: defaultValues?.selling_price ?? undefined,
      stockQuantity: defaultValues?.stock_quantity ?? undefined,
      description: defaultValues?.description ?? '',
    },
  });

  const itemName = slug(watch('name') ?? '', 20);
  const { onCodeTyped: onItemCodeTyped } = useAutoCode(
    itemName ? `PRD-${itemName}` : '',
    setValue as unknown as UseFormSetValue<{ sku?: string }>,
    { enabled: !defaultValues?.sku, selfId: defaultValues?.id },
  );

  const mutation = useMutation({
    mutationFn: (v: ProductValues) => {
      const payload = {
        name: v.name,
        sku: v.sku || undefined,
        categoryId: v.categoryId || undefined,
        costPrice: v.costPrice,
        sellingPrice: v.sellingPrice,
        description: v.description || null,
        billingDays: null,
        speedMbps: null,
        // Opening stock only when adding; later changes go through restock/adjust
        ...(isEdit ? {} : { stockQuantity: v.stockQuantity ?? 0 }),
      };
      return defaultValues ? productsApi.update(defaultValues.id, payload) : productsApi.create(payload);
    },
    onSuccess: saved,
    onError: (err) => setError('root', { message: apiErrorMessage(err) }),
  });

  return (
    <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
      {errors.root && <Alert variant="error" inline>{errors.root.message}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="product-name">Product name</Label>
          <Input id="product-name" placeholder="e.g. TP-Link Archer C6 Router" aria-invalid={errors.name ? true : undefined} {...register('name')} />
          <FieldError message={errors.name?.message} />
        </div>
        <div>
          <Label htmlFor="product-code">Code</Label>
          <Input id="product-code" placeholder="Made from the name" {...register('sku', { onChange: onItemCodeTyped })} />
          <p className="mt-1 text-[11px] text-foreground-4">Filled in for you. You can change it.</p>
        </div>
        <div>
          <Label htmlFor="product-category">Category</Label>
          <Select id="product-category" placeholder="No category" {...register('categoryId')}>
            {categoriesQuery.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="product-cost">Cost price (KSh)</Label>
          <Input id="product-cost" type="number" inputMode="numeric" min={0} placeholder="0" aria-invalid={errors.costPrice ? true : undefined} {...register('costPrice')} />
          <FieldError message={errors.costPrice?.message} />
        </div>
        <div>
          <Label htmlFor="product-sell">Selling price (KSh)</Label>
          <Input id="product-sell" type="number" inputMode="numeric" min={0} placeholder="0" aria-invalid={errors.sellingPrice ? true : undefined} {...register('sellingPrice')} />
          <FieldError message={errors.sellingPrice?.message} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="product-stock">Opening stock</Label>
          <Input
            id="product-stock"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="0"
            disabled={isEdit}
            aria-invalid={errors.stockQuantity ? true : undefined}
            {...register('stockQuantity')}
          />
          {isEdit && <p className="mt-1 text-xs text-foreground-4">Change stock with Add or Set on the product card.</p>}
          <FieldError message={errors.stockQuantity?.message} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="product-description">Description (optional)</Label>
          <Textarea id="product-description" rows={3} placeholder="Anything worth knowing about this product" {...register('description')} />
        </div>
      </div>
      <FormButtons onClose={onClose} pending={mutation.isPending} label={submitLabel ?? (isEdit ? 'Save changes' : 'Add product')} />
    </form>
  );
}
