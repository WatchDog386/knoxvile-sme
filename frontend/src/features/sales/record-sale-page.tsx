import { useEffect, useMemo, useRef, useState } from 'react';
import { CategoryPicker } from '@/components/forms/category-picker';
import { RecordDateField, recordDateError, useBusinessToday } from '@/components/forms/record-date-field';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, Trash2, Search, CheckCircle2, ShoppingCart, ChevronDown, Lock, PackagePlus, Wifi, Package, BriefcaseBusiness, Banknote, ClipboardList, ArrowDownToLine, Layers3 } from 'lucide-react';
import { customersApi, productsApi, servicesApi, salesApi } from '@/api/endpoints';
import { Dialog } from '@/components/ui/dialog';
import { PackageCard, planStyle } from '@/features/products/package-card';
import { ProductForm, type ProductKind } from '@/features/products/product-form';
import { ServiceForm } from '@/features/products/service-form';
import { PaymentCapture, type CapturedPayment, type PayMode } from './components/payment-capture';
import { AppBar } from '@/components/layout/app-bar';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { PageLoader } from '@/components/ui/spinner';
import { Badge, statusVariant, statusLabel } from '@/components/ui/badge';
import { cn, formatKES, uuid } from '@/lib/utils';
import { DEFAULT_PAYMENT_METHODS } from '@/lib/constants';
import { useActiveBusiness } from '@/stores/business';
import { useRole } from '@/hooks/use-role';
import type { Customer } from '@/api/types';
import { notifySuccess } from '@/components/ui/popup-host';

type SaleCategory = 'GENERAL' | 'PRODUCT' | 'SERVICE' | 'PACKAGE' | 'ADVANCE' | 'OTHER';

interface LineItem {
  key: string;
  type: 'PRODUCT' | 'SERVICE';
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  stock: number | null;
}

const schema = z.object({
  discount: z.coerce.number().min(0).optional().or(z.literal('')),
  taxRate: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  paymentMethod: z.string().min(1, 'Select a payment method.'),
  amountPaid: z.coerce.number().min(0).optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  saleDate: z.string().min(1, 'Pick the date.'),
  categoryId: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 text-[13px] font-medium tracking-tight text-foreground">
      {children}
    </h2>
  );
}

function saleCategoryName(type?: string) {
  const names: Record<string, string> = {
    GENERAL: "today's general sales",
    PRODUCT: 'product sale',
    SERVICE: 'service sale',
    PACKAGE: 'package subscription',
    ADVANCE: 'advance payment',
    OTHER: 'other revenue',
    MIXED: 'mixed sale',
  };
  return names[type ?? 'PRODUCT'] ?? 'sale';
}

export function RecordSalePage() {
  // Sales can be dated today or any earlier day, in the business's timezone
  const today = useBusinessToday();
  const navigate = useNavigate();
  const { isEmployee } = useRole();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const presetCustomer = searchParams.get('customer');
  const activeBusiness = useActiveBusiness();

  // All hooks must run on every render — never place them below an early return.
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  // Sell something already in the catalogue, or record a new product/package and sell it straight away
  const [saleSource, setSaleSource] = useState<'existing' | 'new'>('existing');
  const [newKind, setNewKind] = useState<ProductKind>('product');
  const [saleCategory, setSaleCategory] = useState<SaleCategory | null>(null);
  const [packageMode, setPackageMode] = useState<'lump' | 'individual' | null>(null);
  const [amountValue, setAmountValue] = useState('');
  const [applyClientAdvance, setApplyClientAdvance] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(presetCustomer);
  // Client name typed at checkout: an existing client is matched by name, a new one is created
  const [clientName, setClientName] = useState('');
  const [successSale, setSuccessSale] = useState<{ id: string; total: number; payment_status: string; sale_type?: string } | null>(null);
  const idempotencyKey = useRef(uuid());

  const productsQuery = useQuery({
    queryKey: ['products', { page: 1, limit: 100 }],
    queryFn: () => productsApi.list({ page: 1, limit: 100 }),
    enabled: !!activeBusiness,
  });

  const servicesQuery = useQuery({
    queryKey: ['services', { active: true }],
    queryFn: () => servicesApi.list({ active: true }),
    enabled: !!activeBusiness,
  });

  const customersQuery = useQuery({
    queryKey: ['customers', { page: 1, limit: 100 }],
    queryFn: () => customersApi.list({ page: 1, limit: 100 }),
    enabled: !!activeBusiness,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    clearErrors,
    getValues,
    formState: { errors },
    setError: setFormError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      discount: '',
      taxRate: '',
      paymentMethod: 'M-PESA',
      amountPaid: '',
      notes: '',
      saleDate: today,
      categoryId: '',
    },
  });

  const paymentMethod = watch('paymentMethod');
  const discount = Number(watch('discount') || 0);
  const taxRate = Number(watch('taxRate') || 0);
  const amountPaid = Number(watch('amountPaid') || 0);

  // A WiFi package in the cart: subsequent (package only) or new installation (package + charge)
  const hasPackage = lineItems.some(
    (line) => line.type === 'PRODUCT' && productsQuery.data?.items.find((p) => p.id === line.id)?.billing_days,
  );
  const [installType, setInstallType] = useState<'subsequent' | 'new'>('subsequent');
  const [installFee, setInstallFee] = useState('');
  const installationFee = hasPackage && installType === 'new' ? Math.max(0, Math.round(Number(installFee) || 0)) : 0;
  const installFeeMissing = hasPackage && installType === 'new' && installationFee <= 0;
  // A package sale is either paid now (checkout) or billed: an unpaid invoice
  // on the client's account, and the package starts once it is paid
  const [billing, setBilling] = useState<'checkout' | 'invoice'>('checkout');
  const invoicing = hasPackage && billing === 'invoice';

  const subtotal = useMemo(
    () => lineItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0) + installationFee,
    [lineItems, installationFee],
  );
  const appliedDiscount = Math.min(Math.max(0, Math.round(discount)), subtotal);
  const tax = Math.round(((subtotal - appliedDiscount) * taxRate) / 100);
  const total = subtotal - appliedDiscount + tax;
  const [pageStep, setPageStep] = useState<1 | 2 | 3>(1);
  // Checkout payment: M-Pesa prompt, camera, pasted message, or cash/other
  const [payMode, setPayMode] = useState<PayMode>('prompt');
  const [captured, setCaptured] = useState<CapturedPayment | null>(null);
  const [clientPhone, setClientPhone] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);
  const scanned = captured;

  const customerList: Customer[] = Array.isArray(customersQuery.data)
    ? (customersQuery.data as Customer[])
    : ((customersQuery.data as { items?: Customer[] })?.items ?? []);
  const matchedClient = customerList.find((c) => c.name.trim().toLowerCase() === clientName.trim().toLowerCase());
  const checkoutCustomerId = clientName.trim() ? matchedClient?.id ?? null : customerId;
  const canApplyAdvance = (saleCategory === 'PRODUCT' || saleCategory === 'SERVICE') && !!checkoutCustomerId;
  const advanceQuery = useQuery({
    queryKey: ['sales', 'available-advances', checkoutCustomerId],
    queryFn: () => salesApi.availableAdvances(checkoutCustomerId as string),
    enabled: !!activeBusiness && canApplyAdvance,
  });
  const availableAdvance = advanceQuery.data?.total ?? 0;
  const advanceToApply = applyClientAdvance ? Math.min(total, availableAdvance) : 0;
  const amountDueAfterAdvance = Math.max(0, total - advanceToApply);
  const balanceOwed = Math.max(0, total - amountPaid - advanceToApply);
  const isPartial = balanceOwed > 0 && total > 0;

  // A known client brings their phone number for the M-Pesa prompt
  useEffect(() => {
    if (matchedClient?.phone && !clientPhone) setClientPhone(matchedClient.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedClient?.id]);

  // A confirmed or read M-Pesa payment fills the payment fields
  function capturePayment(payment: CapturedPayment | null) {
    setCaptured(payment);
    if (payment) {
      setValue('paymentMethod', 'M-PESA');
      setValue('amountPaid', payment.amount);
      if (payment.reference) {
        setValue('notes', `M-Pesa ${payment.reference}${payment.when ? ` · ${payment.when}` : ''}${payment.name ? ` · ${payment.name}` : ''}`);
      }
      if (payment.name && !clientName.trim()) setClientName(payment.name);
      if (payment.phone && !clientPhone.trim()) setClientPhone(payment.phone);
    } else {
      setValue('amountPaid', '');
      setValue('notes', '');
    }
  }

  function choosePayMode(mode: PayMode) {
    setPayMode(mode);
    if (mode === 'cash') {
      setValue('paymentMethod', 'CASH');
      setValue('amountPaid', paymentMethod === 'CREDIT' ? 0 : amountDueAfterAdvance);
    } else {
      setValue('paymentMethod', 'M-PESA');
    }
  }

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Auto-resolve customer: if no customer selected but scanned name exists, find or create
      const isGeneralTotal = saleCategory === 'GENERAL';
      let resolvedCustomerId: string | undefined = isGeneralTotal ? undefined : customerId ?? undefined;
      const typedName = isGeneralTotal ? '' : clientName.trim();
      if (typedName) {
        const list: Customer[] = Array.isArray(customersQuery.data)
          ? (customersQuery.data as Customer[])
          : ((customersQuery.data as { items?: Customer[] })?.items ?? []);
        const preset = list.find((c) => c.id === customerId);
        // Typing a different name than the preset client means a different client
        if (!preset || preset.name.toLowerCase() !== typedName.toLowerCase()) {
          let found = list.find((c) => c.name.toLowerCase() === typedName.toLowerCase());
          if (!found) {
            try {
              const res = await customersApi.list({ limit: 50, search: typedName });
              found = res.items.find((c) => c.name.toLowerCase() === typedName.toLowerCase());
            } catch {}
          }
          resolvedCustomerId = found
            ? found.id
            : (await customersApi.create({ name: typedName, phone: clientPhone.trim() || undefined })).id;
        }
      }
      if (!isGeneralTotal && !resolvedCustomerId && scanned?.name) {
        const list: Customer[] = Array.isArray(customersQuery.data)
          ? (customersQuery.data as Customer[])
          : ((customersQuery.data as { items?: Customer[] })?.items ?? []);
        let found = list.find((c) => c.name.toLowerCase() === scanned.name!.toLowerCase());
        if (!found && scanned.name) {
          try {
            const res = await customersApi.list({ limit: 50, search: scanned.name });
            found = res.items.find((c) => c.name.toLowerCase() === scanned.name!.toLowerCase());
          } catch {}
        }
        if (found) {
          resolvedCustomerId = found.id;
        } else {
          try {
            const created = await customersApi.create({
              name: scanned.name,
              phone: scanned.phone ?? undefined,
            });
            resolvedCustomerId = created.id;
          } catch {}
        }
      }
      return salesApi.create({
        items: isAmountCategory
          ? []
          : lineItems.map((item) => ({
          productId: item.type === 'PRODUCT' ? item.id : undefined,
          serviceId: item.type === 'SERVICE' ? item.id : undefined,
          quantity: item.quantity,
        })),
        saleType: saleCategory ?? 'PRODUCT',
        applyAdvances: !isAmountCategory && !invoicing && applyClientAdvance,
        total: isAmountCategory ? Number(amountValue) : undefined,
        customerId: resolvedCustomerId,
        discount: Number(values.discount || 0),
        taxRate: Number(values.taxRate || 0),
        paymentMethod: invoicing ? 'CREDIT' : values.paymentMethod,
        amountPaid: invoicing ? 0 : isAmountCategory ? Number(amountValue) : Number(values.amountPaid === '' ? 0 : values.amountPaid),
        reference: invoicing ? undefined : captured?.reference ?? undefined,
        notes: values.notes || undefined,
        idempotencyKey: idempotencyKey.current,
        saleDate: values.saleDate,
        categoryId: values.categoryId || undefined,
        installationFee: !isAmountCategory && installationFee > 0 ? installationFee : undefined,
      });
    },
    onSuccess: async (sale) => {
      setSuccessSale({
        id: sale.id,
        total: sale.total,
        payment_status: sale.payment_status,
        sale_type: sale.sale_type,
      });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      notifySuccess('Sale recorded', isEmployee ? undefined : `${formatKES(sale.total)} added to revenue.`);
    },
    onError: (err) => setFormError('root', { message: apiErrorMessage(err) }),
  });

  const isAmountCategory = saleCategory === 'GENERAL' || saleCategory === 'ADVANCE' || saleCategory === 'OTHER' || (saleCategory === 'PACKAGE' && packageMode === 'lump');

  // Record sale offers WiFi packages only, cheapest first, as on the Products page
  const packages = useMemo(() => {
    const list = Array.isArray(productsQuery.data) ? productsQuery.data : (productsQuery.data?.items ?? []);
    const query = catalogSearch.trim().toLowerCase();
    return list
      .filter((p) => p.billing_days && p.active && (!query || p.name.toLowerCase().includes(query)))
      .sort((x, y) => x.selling_price - y.selling_price);
  }, [productsQuery.data, catalogSearch]);

  // Products that aren't WiFi packages (routers, cables…)
  const goods = useMemo(() => {
    const list = Array.isArray(productsQuery.data) ? productsQuery.data : (productsQuery.data?.items ?? []);
    const query = catalogSearch.trim().toLowerCase();
    return list
      .filter((p) => !p.billing_days && p.active && (!query || p.name.toLowerCase().includes(query)))
      .sort((x, y) => x.name.localeCompare(y.name));
  }, [productsQuery.data, catalogSearch]);

  function addItem(item: {
    type: 'PRODUCT' | 'SERVICE';
    id: string;
    name: string;
    unitPrice: number;
    stock: number | null;
  }) {
    setLineItems((current) => {
      const existing = current.find(
        (line) => line.type === item.type && line.id === item.id,
      );
      if (existing) {
        return current.map((line) =>
          line.key === existing.key
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [
        ...current,
        {
          key: `${item.type}-${item.id}-${uuid()}`,
          type: item.type,
          id: item.id,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: 1,
          stock: item.stock,
        },
      ];
    });
  }

  // A WiFi package becomes the client's subscription, so it needs a client
  const needsClient =
    !customerId &&
    !clientName.trim() &&
    !scanned?.name &&
    lineItems.some((line) => line.type === 'PRODUCT' && productsQuery.data?.items.find((p) => p.id === line.id)?.billing_days);

  // "Renew" links pass ?product=<package id>: start with it in the cart
  const presetProduct = searchParams.get('product');
  const presetApplied = useRef(false);
  useEffect(() => {
    if (presetApplied.current || !presetProduct || !productsQuery.data) return;
    const product = productsQuery.data.items.find((p) => p.id === presetProduct);
    presetApplied.current = true;
    if (!product) return;
    addItem({
      type: 'PRODUCT',
      id: product.id,
      name: product.name,
      unitPrice: product.selling_price,
      stock: product.track_inventory ? product.stock_quantity : null,
    });
    setSaleCategory(product.billing_days ? 'PACKAGE' : 'PRODUCT');
    if (product.billing_days) setPackageMode('individual');
    setPageStep(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetProduct, productsQuery.data]);

  const presetService = searchParams.get('service');
  const presetServiceApplied = useRef(false);
  useEffect(() => {
    if (presetServiceApplied.current || !presetService || !Array.isArray(servicesQuery.data)) return;
    const service = servicesQuery.data.find((s) => s.id === presetService);
    presetServiceApplied.current = true;
    if (!service) return;
    addItem({ type: 'SERVICE', id: service.id, name: service.name, unitPrice: service.price, stock: null });
    setSaleCategory('SERVICE');
    setPageStep(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetService, servicesQuery.data]);

  function changeQuantity(key: string, delta: number) {
    setLineItems((current) =>
      current
        .map((line) =>
          line.key === key
            ? { ...line, quantity: Math.max(1, line.quantity + delta) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  // Coming from a client (Renew / Record sale on their page): show their name
  useEffect(() => {
    if (!presetCustomer || clientName) return;
    const list: Customer[] = Array.isArray(customersQuery.data)
      ? (customersQuery.data as Customer[])
      : ((customersQuery.data as { items?: Customer[] })?.items ?? []);
    const preset = list.find((c) => c.id === presetCustomer);
    if (preset) setClientName(preset.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetCustomer, customersQuery.data]);

  function resetSale() {
    setLineItems([]);
    setCustomerId(presetCustomer);
    setClientName('');
    setClientPhone('');
    setCaptured(null);
    setPayMode('prompt');
    setShowDiscount(false);
    setPageStep(1);
    setSaleSource('existing');
    setSaleCategory(null);
    setPackageMode(null);
    setInstallType('subsequent');
    setInstallFee('');
    setBilling('checkout');
    setAmountValue('');
    setApplyClientAdvance(false);
    setCatalogSearch('');
    setSuccessSale(null);
    idempotencyKey.current = uuid();
    reset({
      discount: '',
      taxRate: '',
      paymentMethod: 'M-PESA',
      amountPaid: '',
      notes: '',
      saleDate: today,
      categoryId: '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handlePaymentMethodChange(method: string) {
    setValue('paymentMethod', method);
    if (method === 'CREDIT') {
      setValue('amountPaid', 0);
    }
  }

  function submitSale(values: FormValues) {
    const dateError = recordDateError(values.saleDate, today);
    if (dateError) {
      setFormError('saleDate', { message: dateError });
      setFormError('root', { message: dateError });
      return;
    }
    if (isAmountCategory) {
      const amount = Number(amountValue);
      if (!Number.isFinite(amount) || amount < 1) {
        setFormError('root', { message: 'Enter the amount received.' });
        return;
      }
      if ((saleCategory === 'ADVANCE' || saleCategory === 'OTHER') && !values.notes?.trim()) {
        setFormError('root', { message: saleCategory === 'ADVANCE' ? 'Describe what this advance is for.' : 'Describe the other source of revenue.' });
        return;
      }
      if (saleCategory === 'ADVANCE' && !customerId && !clientName.trim()) {
        setFormError('root', { message: 'Choose or enter the client who paid this advance.' });
        return;
      }
    } else if (!lineItems.length) {
      setFormError('root', { message: 'Add at least one item before recording this sale.' });
      return;
    }
    mutation.mutate(values);
  }

  if (!activeBusiness) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-medium text-foreground">No active business selected</p>
        <p className="text-sm text-foreground-5">Please select or create a business to record sales.</p>
      </div>
    );
  }

  if (successSale) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-1 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft">
          <CheckCircle2 className="h-9 w-9 text-success" aria-hidden />
        </span>
        <h2 className="text-lg font-medium tracking-tight text-foreground">{invoicing ? 'Invoice generated' : 'Sale recorded!'}</h2>
        <p className="max-w-xs text-[13px] leading-relaxed text-foreground-3">
          {invoicing ? (
            <>The {formatKES(successSale.total)} invoice is on the client's account. Their package starts once it is paid. Open it to download, share on WhatsApp or email it.</>
          ) : successSale.sale_type === 'PACKAGE' && successSale.payment_status !== 'PAID' ? (
            <>Payment recorded. Package access will start when the balance is paid. The {formatKES(successSale.total)} sale is included in revenue as payments are received.</>
          ) : successSale.sale_type === 'GENERAL' ? (
            <>Today's combined sales total of {formatKES(successSale.total)} was recorded as received revenue.</>
          ) : successSale.sale_type === 'ADVANCE' ? (
            <>Advance payment of {formatKES(successSale.total)} recorded and included in received revenue.</>
          ) : (
            <>Recorded as {saleCategoryName(successSale.sale_type)}. Total {formatKES(successSale.total)} saved; amounts received are included in revenue.</>
          )}
        </p>
        <Badge variant={statusVariant(successSale.payment_status)}>
          {statusLabel(successSale.payment_status)}
        </Badge>
        <div className={cn('mt-2 grid w-full gap-3 pt-2', isEmployee ? 'grid-cols-1' : 'grid-cols-2')}>
          <Button variant="outline" className="rounded-full" onClick={resetSale}>
            Record another
          </Button>
          {/* Employees record sales but never open them afterwards */}
          {!isEmployee && (
            <Button
              className="rounded-full bg-accent text-white hover:bg-accent-strong"
              onClick={() => window.location.assign(`/sales/${successSale.id}`)}
            >
              {invoicing ? 'Open invoice' : 'View sale'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dark relative isolate -mx-4 min-h-[calc(100dvh-3.5rem)] bg-[linear-gradient(180deg,#16202f_0%,#121212_360px)] px-4 pt-2 pb-28 font-sans text-[14px] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[260px] bg-[linear-gradient(0deg,#16202f_0%,rgba(18,18,18,0)_100%)] lg:hidden"
      />
      <AppBar
        title={saleCategory === 'GENERAL' ? "Today's general sales" : 'Record sale'}
        titleClassName="!text-white"
        backClassName="!text-white"
        className="text-white"
        onBack={() => {
          if (pageStep > 1) setPageStep((s) => (s - 1) as 1 | 2 | 3);
          else if (saleCategory === 'PACKAGE' && packageMode) setPackageMode(null);
          else if (saleCategory) setSaleCategory(null);
          else navigate(-1);
        }}
        right={saleCategory && !isAmountCategory && (saleCategory !== 'PACKAGE' || packageMode === 'individual') ? (
          <button
            type="button"
            onClick={() => setPageStep(2)}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-foreground transition-transform active:scale-90"
            aria-label="Open cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {lineItems.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                {lineItems.reduce((a, b) => a + b.quantity, 0)}
              </span>
            )}
          </button>
        ) : undefined}
      />

      {/* Choose a revenue category before entering a sale. */}
      {pageStep === 1 && !saleCategory && (
        <section className="space-y-3">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">What type of revenue are you recording?</h2>
            <p className="mt-1 text-[12.5px] text-foreground-4">Choose the matching category so payments and reports stay correctly classified.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {([
              { id: 'GENERAL', label: "Today's general sales", hint: 'Enter one combined total for the day', icon: Banknote, from: '#00897B', to: '#26A69A' },
              { id: 'PRODUCT', label: 'Product sale', hint: 'Sell something from your catalogue', icon: Package, from: '#0288D1', to: '#29B6F6' },
              { id: 'SERVICE', label: 'Service sale', hint: 'Record a new or existing service', icon: BriefcaseBusiness, from: '#8E24AA', to: '#AB47BC' },
              { id: 'PACKAGE', label: 'Package subscription', hint: 'Lump sum or individual plan', icon: Wifi, from: '#43A047', to: '#66BB6A' },
              { id: 'ADVANCE', label: 'Advance payment', hint: 'Record payment before delivery', icon: ArrowDownToLine, from: '#FB8C00', to: '#FFA726' },
              { id: 'OTHER', label: 'Other revenue', hint: 'Record another income source', icon: Layers3, from: '#E6007E', to: '#FF3399' },
            ] as const).map((choice) => (
              <button key={choice.id} type="button" onClick={() => { setSaleCategory(choice.id); setPackageMode(null); setSaleSource('existing'); setLineItems([]); setAmountValue(''); setApplyClientAdvance(false); setValue('notes', ''); clearErrors(); setNewKind(choice.id === 'PACKAGE' ? 'package' : 'product'); }} className="group relative flex min-h-[188px] flex-col items-start overflow-hidden rounded-2xl bg-[#F2F2F4] p-4 text-left transition-transform active:scale-[0.98] [.dark_&]:bg-[#1E1E1E]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm" style={{ background: `linear-gradient(135deg, ${choice.from}, ${choice.to})` }}>
                  <choice.icon className="h-5 w-5 text-white" aria-hidden />
                </span>
                <span className="mt-3 line-clamp-2 text-[15px] font-medium leading-snug text-foreground">{choice.label}</span>
                <span className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-foreground-3">{choice.hint}</span>
                <span className="relative mt-auto inline-flex h-9 items-center self-start rounded-xl border-[1.5px] px-3 text-[12px] font-medium text-foreground transition-colors group-hover:bg-white/40 [.dark_&]:group-hover:bg-white/5" style={{ borderColor: choice.from, color: choice.from }}>
                  Select
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {pageStep === 1 && saleCategory === 'PACKAGE' && !packageMode && (
        <section className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => { setPackageMode('lump'); setAmountValue(''); clearErrors(); }} className="rounded-2xl border border-edge bg-surface p-5 text-left hover:bg-surface-2">
            <Banknote className="h-5 w-5 text-accent" aria-hidden />
            <span className="mt-3 block text-[14px] font-semibold text-foreground">Lump sum package revenue</span>
            <span className="mt-1 block text-[12px] text-foreground-4">Enter the total collected for packages sold today.</span>
          </button>
          <button type="button" onClick={() => { setPackageMode('individual'); setAmountValue(''); clearErrors(); }} className="rounded-2xl border border-edge bg-surface p-5 text-left hover:bg-surface-2">
            <ClipboardList className="h-5 w-5 text-accent" aria-hidden />
            <span className="mt-3 block text-[14px] font-semibold text-foreground">Individual subscription</span>
            <span className="mt-1 block text-[12px] text-foreground-4">Choose a client and package to start or renew access.</span>
          </button>
        </section>
      )}

      {pageStep === 1 && saleCategory === 'GENERAL' && (
        <form className="mx-auto w-full max-w-xl space-y-5 pb-8" onSubmit={handleSubmit(submitSale)} noValidate>
          <div className="pt-1 text-center">
            <p className="text-[13px] font-medium text-[#8BC53F]">Step 1/2</p>
            <div className="mt-4 grid grid-cols-2 gap-2" aria-label="Step 1 of 2">
              <span className="h-1.5 rounded-full bg-[#8BC53F]" />
              <span className="h-1.5 rounded-full bg-white/35" />
            </div>
          </div>

          <section className="space-y-5 border-b border-white/15 pb-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8BC53F]">Daily revenue</p>
                <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight text-white">Enter today&apos;s total</h2>
              </div>
              <span className="shrink-0 rounded-full border border-white/25 px-3 py-1.5 text-[11px] font-medium text-white/85">
                {new Intl.DateTimeFormat('en-KE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' }).format(new Date())}
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-white/70">
              Record your combined sales for a day in one entry. Pick the day it was received: today or any earlier day.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="revenue-amount" className="text-[14px] font-medium text-white">Total received (KSh)</Label>
              <div className="flex h-[58px] items-center gap-3 rounded-xl border-2 border-white/85 px-4 focus-within:border-[#8BC53F]">
                <span className="shrink-0 text-[16px] font-semibold text-white">KES</span>
                <Input
                  id="revenue-amount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={amountValue}
                  onChange={(event) => setAmountValue(event.target.value)}
                  placeholder="0"
                  className="h-12 rounded-none border-0 !bg-transparent px-0 text-[23px] font-semibold tracking-tight !text-white shadow-none placeholder:!text-white/40 focus:border-0 focus:ring-0"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <RecordDateField
                id="general-sale-date"
                label="Date received"
                labelClassName="text-[14px] font-medium text-white"
                className="h-[54px] rounded-xl border-2 border-white/85 bg-transparent px-4 text-white [color-scheme:dark] focus:border-[#8BC53F]"
                error={errors.saleDate?.message}
                {...register('saleDate')}
              />
              <CategoryPicker
                type="SALE"
                id="general-sale-category"
                dark
                labelClassName="text-[14px] font-medium text-white"
                selectClassName="h-[54px] rounded-xl border-2 border-white/85 bg-transparent px-4 text-white focus:border-[#8BC53F]"
                value={watch('categoryId') ?? ''}
                onChange={(id) => setValue('categoryId', id)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="revenue-method" className="text-[14px] font-medium text-white">Payment method</Label>
              <Select id="revenue-method" className="h-[54px] rounded-xl border-2 border-white/85 bg-transparent px-4 text-white focus:border-[#8BC53F]" {...register('paymentMethod')}>
                {DEFAULT_PAYMENT_METHODS.filter((method) => method !== 'CREDIT').map((method) => <option key={method} value={method}>{method}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="general-sale-note" className="text-[14px] font-medium text-white">Payment description (optional)</Label>
              <Input id="general-sale-note" className="h-[54px] rounded-xl border-2 border-white/85 bg-transparent px-4 text-white placeholder:text-white/40 focus:border-[#8BC53F]" placeholder="Add a short note" {...register('notes')} />
            </div>
          </section>

          {errors.root && <Alert variant="error" inline>{errors.root.message}</Alert>}
          <Button type="submit" loading={mutation.isPending} className="h-[54px] w-full rounded-xl bg-[#8BC53F] text-[15px] font-semibold text-[#11180B] shadow-none hover:bg-[#7AAF35]">
            {watch('saleDate') === today ? 'Record today\u2019s total' : 'Record the total'} · {formatKES(Number(amountValue) || 0)}
          </Button>
        </form>
      )}

      {pageStep === 1 && saleCategory && saleCategory !== 'GENERAL' && isAmountCategory && (
        <form className="space-y-4 rounded-2xl border border-edge bg-surface p-4 lg:max-w-xl" onSubmit={handleSubmit(submitSale)} noValidate>
          <h2 className="text-[15px] font-semibold text-foreground">{saleCategory === 'ADVANCE' ? 'Record an advance payment' : saleCategory === 'OTHER' ? 'Record other revenue' : 'Package sales lump sum'}</h2>
          <div className="space-y-1.5">
            <Label htmlFor="revenue-amount">Amount received (KSh)</Label>
            <Input id="revenue-amount" type="number" inputMode="numeric" min={1} value={amountValue} onChange={(event) => setAmountValue(event.target.value)} placeholder="0" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RecordDateField id="amount-sale-date" label="Date received" error={errors.saleDate?.message} {...register('saleDate')} />
            <CategoryPicker
              type="SALE"
              id="amount-sale-category"
              value={watch('categoryId') ?? ''}
              onChange={(id) => setValue('categoryId', id)}
            />
          </div>
          {(saleCategory === 'ADVANCE' || saleCategory === 'OTHER') && (
            <div className="space-y-1.5">
              <Label htmlFor="sale-purpose">{saleCategory === 'ADVANCE' ? 'What is this advance for?' : 'Revenue source'}</Label>
              <Input id="sale-purpose" placeholder={saleCategory === 'ADVANCE' ? 'e.g. advance for kitchen cabinets' : 'e.g. delivery fee'} {...register('notes')} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="revenue-method">Payment method</Label>
            <Select id="revenue-method" {...register('paymentMethod')}>
              {DEFAULT_PAYMENT_METHODS.filter((method) => method !== 'CREDIT').map((method) => <option key={method} value={method}>{method}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount-customer">Client (optional)</Label>
            <Input id="amount-customer" list="client-names" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Walk-in or client name" />
          </div>
          {errors.root && <Alert variant="error" inline>{errors.root.message}</Alert>}
          <Button type="submit" loading={mutation.isPending} className="h-12 w-full rounded-xl bg-brand-600 text-white hover:bg-brand-700">Record {formatKES(Number(amountValue) || 0)}</Button>
        </form>
      )}

      {/* Step 1: choose where the item comes from */}
      {pageStep === 1 && saleCategory && !isAmountCategory && (saleCategory === 'PRODUCT' || saleCategory === 'SERVICE' || (saleCategory === 'PACKAGE' && packageMode === 'individual')) && (
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-3 p-1 lg:max-w-md lg:rounded-md">
          {(
            [
              { id: 'existing', label: saleCategory === 'SERVICE' ? 'Existing service' : saleCategory === 'PACKAGE' ? 'Existing package' : 'Existing product', icon: Package },
              { id: 'new', label: saleCategory === 'SERVICE' ? 'New service' : saleCategory === 'PACKAGE' ? 'New package' : 'New product', icon: PackagePlus },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSaleSource(opt.id)}
              aria-pressed={saleSource === opt.id}
              className={cn(
                'flex h-10 items-center justify-center gap-1.5 rounded-xl text-[13px] font-medium transition-colors lg:rounded',
                saleSource === opt.id ? 'bg-surface text-foreground shadow-sm' : 'text-foreground-3 hover:text-foreground',
              )}
            >
              <opt.icon className="h-4 w-4" aria-hidden />
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* New item: record its details and selling price, then it goes straight into the cart.
          Kept outside the sale form: forms can't be nested. */}
      {pageStep === 1 && saleSource === 'new' && saleCategory === 'SERVICE' && (
        <section className="space-y-3 rounded-2xl border border-edge bg-surface p-4 lg:max-w-2xl lg:p-6">
          <div><h2 className="text-[15px] font-medium text-foreground">Add a new service</h2><p className="mt-0.5 text-[12.5px] text-foreground-4">Save it to your catalogue and add it to this sale.</p></div>
          <ServiceForm onClose={() => setSaleSource('existing')} onCreated={(service) => { addItem({ type: 'SERVICE', id: service.id, name: service.name, unitPrice: service.price, stock: null }); setPageStep(2); }} />
        </section>
      )}

      {pageStep === 1 && saleSource === 'new' && saleCategory !== 'SERVICE' && (
        <section className="space-y-4 rounded-2xl border border-edge bg-surface p-4 lg:max-w-2xl lg:rounded-md lg:p-6">
          <div>
            <h2 className="text-[15px] font-medium text-foreground">Record a new item</h2>
            <p className="mt-0.5 text-[12.5px] text-foreground-4">
              It is saved to your catalogue and added to this sale, so next time it is under Existing product.
            </p>
          </div>
          <ProductForm
            key={saleCategory === 'PACKAGE' ? 'package' : newKind}
            kind={saleCategory === 'PACKAGE' ? 'package' : newKind}
            submitLabel="Save & add to sale"
            onClose={() => setSaleSource('existing')}
            onCreated={(product) => {
              addItem({
                type: 'PRODUCT',
                id: product.id,
                name: product.name,
                unitPrice: product.selling_price,
                stock: product.track_inventory ? product.stock_quantity : null,
              });
              setPageStep(2);
            }}
          />
        </section>
      )}

      <form id="record-sale-form" onSubmit={handleSubmit(submitSale)} noValidate>

      <div className={pageStep === 1 && saleSource === 'existing' && saleCategory !== null && !isAmountCategory ? 'space-y-6' : 'hidden'}>
          {/* Catalog — search and select (Step 1) */}
          <section className="space-y-2">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-4" aria-hidden />
              <Input
                value={catalogSearch}
                onChange={(event) => setCatalogSearch(event.target.value)}
                placeholder={saleCategory === 'SERVICE' ? 'Search services…' : saleCategory === 'PACKAGE' ? 'Search packages…' : 'Search products…'}
                className="h-11 rounded-full pl-10"
              />
            </div>

            {saleCategory === 'SERVICE' ? (
              servicesQuery.isLoading ? <PageLoader inline message="Loading services" /> : (servicesQuery.data ?? []).filter((service) => !catalogSearch || service.name.toLowerCase().includes(catalogSearch.toLowerCase())).length === 0 ? (
                <div className="px-1 py-8 text-center"><p className="text-[13px] text-foreground-4">No services found. Add a new service to continue.</p><Button type="button" variant="outline" className="mt-3" onClick={() => setSaleSource('new')}><Plus className="h-4 w-4" />Add service</Button></div>
              ) : <div className="grid grid-cols-2 gap-3 pt-1 lg:grid-cols-3">{(servicesQuery.data ?? []).filter((service) => !catalogSearch || service.name.toLowerCase().includes(catalogSearch.toLowerCase())).map((service) => <button key={service.id} type="button" onClick={() => addItem({ type: 'SERVICE', id: service.id, name: service.name, unitPrice: service.price, stock: null })} className="flex min-h-28 flex-col items-start rounded-2xl border border-edge bg-surface p-4 text-left hover:bg-surface-2"><BriefcaseBusiness className="h-5 w-5 text-accent" /><span className="mt-3 text-[14px] font-medium text-foreground">{service.name}</span><span className="mt-1 text-[13px] tabular-nums text-foreground-2">{formatKES(service.price)}</span></button>)}</div>
            ) : productsQuery.isLoading ? (
              <PageLoader inline message="Loading" />
            ) : (saleCategory === 'PACKAGE' ? packages.length === 0 : goods.length === 0) ? (
              <div className="px-1 py-8 text-center">
                <p className="text-[13px] text-foreground-4">Nothing found. Try another search, or add a new {saleCategory === 'PACKAGE' ? 'package' : 'product'}.</p>
                <Button type="button" variant="outline" className="mt-3" onClick={() => setSaleSource('new')}>
                  <PackagePlus className="h-4 w-4" aria-hidden />
                  {saleCategory === 'PACKAGE' ? 'New package' : 'New product'}
                </Button>
              </div>
            ) : (
              <>
              {saleCategory === 'PACKAGE' ? (
                <div className="grid grid-cols-2 gap-3 pt-1 lg:grid-cols-3">
                  {packages.map((pkg, i) => (
                    <PackageCard
                      key={pkg.id}
                      product={pkg}
                      index={i}
                      inCart={lineItems.find((l) => l.type === 'PRODUCT' && l.id === pkg.id)?.quantity ?? 0}
                      onAdd={(p) =>
                        addItem({ type: 'PRODUCT', id: p.id, name: p.name, unitPrice: p.selling_price, stock: null })
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2 pt-3">
                  <SectionHeading>Products</SectionHeading>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                    {goods.map((p) => {
                      const inCart = lineItems.find((l) => l.type === 'PRODUCT' && l.id === p.id)?.quantity ?? 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            addItem({
                              type: 'PRODUCT',
                              id: p.id,
                              name: p.name,
                              unitPrice: p.selling_price,
                              stock: p.track_inventory ? p.stock_quantity : null,
                            })
                          }
                          className={cn(
                            'flex flex-col items-start rounded-2xl border bg-surface p-4 text-left transition-colors hover:bg-surface-2 lg:rounded-md',
                            inCart ? 'border-accent' : 'border-edge',
                          )}
                        >
                          <span className="line-clamp-2 text-[14px] font-medium text-foreground">{p.name}</span>
                          <span className="mt-1 text-[13px] tabular-nums text-foreground-2">{formatKES(p.selling_price)}</span>
                          <span className="mt-2 text-[11.5px] text-foreground-4">
                            {p.track_inventory ? `${p.stock_quantity} in stock` : 'Not stock-tracked'}
                            {inCart ? ` · ${inCart} in cart` : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              </>
            )}
           </section>
            {lineItems.length > 0 && (
              <Button type="button" onClick={() => setPageStep(2)} className="h-12 w-full rounded-2xl bg-brand-600 text-white hover:bg-brand-700">
                View cart ({lineItems.reduce((a, b) => a + b.quantity, 0)} items) — {formatKES(total)} →
              </Button>
            )}
          </div>

          {/* Step 2 — Cart: the same package cards, with a quantity stepper */}
          <div className={pageStep === 2 ? 'space-y-5' : 'hidden'}>
            {lineItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-1 py-12 text-center">
                <ShoppingCart className="h-7 w-7 text-foreground-5" aria-hidden />
                <p className="text-[13px] text-foreground-4">The cart is empty. Add a product, service, or package first.</p>
                <Button type="button" className="mt-2 h-11 rounded-2xl bg-brand-600 px-6 text-white" onClick={() => setPageStep(1)}>
                  Choose items
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {lineItems.map((item, i) => {
                    const product = productsQuery.data?.items.find((p) => p.id === item.id);
                    const stepper = (
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex items-center gap-1 rounded-xl bg-white p-1 [.dark_&]:bg-white/10">
                          <button
                            type="button"
                            onClick={() => changeQuantity(item.key, -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground active:bg-surface-3"
                            aria-label="One fewer"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-5 text-center text-[13px] font-semibold tabular-nums text-foreground">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => changeQuantity(item.key, 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground active:bg-surface-3"
                            aria-label="One more"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </span>
                        <button
                          type="button"
                          onClick={() => setLineItems((current) => current.filter((line) => line.key !== item.key))}
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-danger active:bg-danger-soft"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                    return product ? (
                      <PackageCard key={item.key} product={product} index={i} footer={stepper} />
                    ) : (
                      <div key={item.key} className="flex min-h-[188px] flex-col justify-between rounded-2xl bg-[#F2F2F4] p-4 [.dark_&]:bg-[#1E1E1E]">
                        <div>
                          <p className="text-[15px] font-medium text-foreground">{item.name}</p>
                          <p className="mt-1 text-[13px] tabular-nums text-foreground-3">{formatKES(item.unitPrice)} each</p>
                        </div>
                        {stepper}
                      </div>
                    );
                  })}
                </div>

                {hasPackage && (
                  <section className="space-y-3 rounded-2xl bg-[#F2F2F4] p-4 [.dark_&]:bg-[#1E1E1E]">
                    <p className="text-[13px] font-semibold text-foreground">Is this a subsequent payment or a new installation?</p>
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Installation">
                      {([
                        { id: 'subsequent', label: 'Subsequent', hint: 'Package amount only' },
                        { id: 'new', label: 'New installation', hint: 'Package + installation charge' },
                      ] as const).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={installType === opt.id}
                          onClick={() => setInstallType(opt.id)}
                          className={cn(
                            'rounded-xl border p-3 text-left transition-colors',
                            installType === opt.id
                              ? 'border-brand-600 bg-brand-50 [.dark_&]:bg-brand-600/15'
                              : 'border-edge bg-white [.dark_&]:bg-surface-3',
                          )}
                        >
                          <span className="block text-[14px] font-semibold text-foreground">{opt.label}</span>
                          <span className="mt-0.5 block text-[11px] text-foreground-4">{opt.hint}</span>
                        </button>
                      ))}
                    </div>
                    {installType === 'new' && (
                      <div className="space-y-1.5">
                        <Label htmlFor="install-fee">Installation charge (KSh)</Label>
                        <Input
                          id="install-fee"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder="e.g. 2500"
                          className="bg-white [.dark_&]:bg-surface-3"
                          value={installFee}
                          onChange={(e) => setInstallFee(e.target.value)}
                        />
                        {installFeeMissing && <p className="text-[11px] text-foreground-4">Enter the installation charge to continue.</p>}
                      </div>
                    )}
                  </section>
                )}

                <div className="space-y-2 rounded-2xl bg-[#F2F2F4] p-4 [.dark_&]:bg-[#1E1E1E]">
                  {lineItems.map((item) => (
                    <div key={item.key} className="flex justify-between gap-3 text-[13px]">
                      <span className="truncate text-foreground-3">
                        {item.quantity} × {item.name}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-foreground">{formatKES(item.unitPrice * item.quantity)}</span>
                    </div>
                  ))}
                  {installationFee > 0 && (
                    <div className="flex justify-between gap-3 text-[13px]">
                      <span className="truncate text-foreground-3">Installation fee</span>
                      <span className="shrink-0 font-medium tabular-nums text-foreground">{formatKES(installationFee)}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between border-t border-black/5 pt-2 [.dark_&]:border-white/10">
                    <span className="text-[14px] font-medium text-foreground">Total</span>
                    <span className="text-[20px] font-semibold tabular-nums tracking-tight text-foreground">{formatKES(total)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-[auto_1fr] gap-3">
                  <Button type="button" variant="outline" className="h-12 rounded-2xl px-5" onClick={() => setPageStep(1)}>
                    Add more
                  </Button>
                  <Button type="button" disabled={installFeeMissing} className="h-12 rounded-2xl bg-brand-600 text-white hover:bg-brand-700" onClick={() => setPageStep(3)}>
                    Checkout · {formatKES(total)}
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Step 3 — Checkout: slides up as a sheet, like "Add staff" */}
          <Dialog
            open={pageStep === 3}
            onOpenChange={(open) => !open && setPageStep(2)}
            title="Checkout"
            description={`${lineItems.reduce((a, b) => a + b.quantity, 0)} item(s) · ${formatKES(total)}`}
          >
            <div className="space-y-5">
              {/* Order summary: each package with its plan colour */}
              <section className="overflow-hidden rounded-2xl bg-[#F2F2F4] [.dark_&]:bg-[#1E1E1E]">
                {lineItems.map((item, i) => {
                  const style = planStyle(item.name.replace(/\s*\d+\s*mbps\s*$/i, ''), i);
                  return (
                    <div key={item.key} className="flex items-center gap-3 px-4 py-3">
                      <span
                        className="h-9 w-9 shrink-0 rounded-full"
                        style={{ background: `linear-gradient(135deg, ${style.from}, ${style.to})` }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-foreground">{item.name}</span>
                        <span className="block text-[12px] text-foreground-4">
                          {item.quantity} × {formatKES(item.unitPrice)}
                        </span>
                      </span>
                      <span className="text-[14px] font-semibold tabular-nums text-foreground">{formatKES(item.unitPrice * item.quantity)}</span>
                    </div>
                  );
                })}
                {installationFee > 0 && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-[#F57C00] to-[#FFB74D]" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-foreground">Installation fee</span>
                      <span className="block text-[12px] text-foreground-4">New installation</span>
                    </span>
                    <span className="text-[14px] font-semibold tabular-nums text-foreground">{formatKES(installationFee)}</span>
                  </div>
                )}
                {appliedDiscount > 0 && (
                  <div className="flex justify-between px-4 pb-1 text-[13px]">
                    <span className="text-foreground-4">Discount</span>
                    <span className="font-medium tabular-nums text-danger">−{formatKES(appliedDiscount)}</span>
                  </div>
                )}
                <div className="flex items-baseline justify-between bg-black/[0.03] px-4 py-3 [.dark_&]:bg-white/5">
                  <span className="text-[13px] font-medium text-foreground-3">Sale total</span>
                  <span className="text-[20px] font-semibold tabular-nums tracking-tight text-foreground">{formatKES(total)}</span>
                </div>
                {advanceToApply > 0 && (
                  <>
                    <div className="flex items-center justify-between bg-black/[0.03] px-4 py-2 text-[13px] [.dark_&]:bg-white/5">
                      <span className="text-foreground-4">Client advance applied</span>
                      <span className="font-medium tabular-nums text-foreground">−{formatKES(advanceToApply)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-black/[0.03] px-4 pb-3 text-[13px] [.dark_&]:bg-white/5">
                      <span className="font-medium text-foreground-3">Remaining to collect</span>
                      <span className="text-[18px] font-semibold tabular-nums text-foreground">{formatKES(amountDueAfterAdvance)}</span>
                    </div>
                  </>
                )}
              </section>

              {/* When it was sold and what kind of sale */}
              <section className="space-y-3">
                <SectionHeading>Date &amp; category</SectionHeading>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <RecordDateField
                    id="sale-date"
                    label="Date of sale"
                    className="bg-white [.dark_&]:bg-surface-3"
                    error={errors.saleDate?.message}
                    {...register('saleDate')}
                  />
                  <CategoryPicker
                    type="SALE"
                    id="sale-category"
                    selectClassName="bg-white [.dark_&]:bg-surface-3"
                    value={watch('categoryId') ?? ''}
                    onChange={(id) => setValue('categoryId', id)}
                  />
                </div>
              </section>

              {/* Client */}
              <section className="space-y-3">
                <SectionHeading>Client</SectionHeading>
                <div className="space-y-1.5">
                  <Label htmlFor="client-name">Name</Label>
                  <Input
                    id="client-name"
                    list="client-names"
                    autoComplete="off"
                    placeholder="e.g. Grace Achieng"
                    value={clientName}
                    onChange={(e) => { setClientName(e.target.value); setApplyClientAdvance(false); setCaptured(null); setValue('amountPaid', ''); }}
                  />
                  <datalist id="client-names">
                    {customerList.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                  <p className="text-[11px] text-foreground-4">
                    {clientName.trim()
                      ? matchedClient
                        ? 'Existing client'
                        : 'New client: they will be added'
                      : 'Pick an existing client or type a new name'}
                  </p>
                </div>
                {canApplyAdvance && availableAdvance > 0 && (
                  <button type="button" aria-pressed={applyClientAdvance} onClick={() => {
                    const next = !applyClientAdvance;
                    setApplyClientAdvance(next);
                    setCaptured(null);
                    setValue('amountPaid', payMode === 'cash' ? (paymentMethod === 'CREDIT' ? 0 : Math.max(0, total - (next ? Math.min(total, availableAdvance) : 0))) : '');
                  }} className={cn('flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left', applyClientAdvance ? 'border-accent bg-accent-soft' : 'border-edge bg-surface-2')}>
                    <span><span className="block text-[13px] font-medium text-foreground">Apply client advance</span><span className="mt-0.5 block text-[11px] text-foreground-4">{formatKES(availableAdvance)} available · oldest advance is used first</span></span>
                    <span className={cn('flex h-5 w-5 items-center justify-center rounded border text-xs', applyClientAdvance ? 'border-accent bg-accent text-white' : 'border-edge')}>{applyClientAdvance ? '✓' : ''}</span>
                  </button>
                )}
              </section>

              {/* Package: take payment now, or bill the client with an invoice */}
              {hasPackage && (
                <section className="space-y-3">
                  <SectionHeading>Payment</SectionHeading>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Checkout or invoice">
                    {([
                      { id: 'checkout', label: 'Checkout', hint: 'Client pays now' },
                      { id: 'invoice', label: 'Generate invoice', hint: 'Client pays later' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={billing === opt.id}
                        onClick={() => setBilling(opt.id)}
                        className={cn(
                          'rounded-xl border p-3 text-left transition-colors',
                          billing === opt.id
                            ? 'border-brand-600 bg-brand-50 [.dark_&]:bg-brand-600/15'
                            : 'border-edge bg-white [.dark_&]:bg-surface-3',
                        )}
                      >
                        <span className="block text-[14px] font-semibold text-foreground">{opt.label}</span>
                        <span className="mt-0.5 block text-[11px] text-foreground-4">{opt.hint}</span>
                      </button>
                    ))}
                  </div>
                  {invoicing && (
                    <p className="rounded-2xl bg-[#F2F2F4] p-4 text-[12px] leading-relaxed text-foreground-3 [.dark_&]:bg-[#1E1E1E]">
                      The full {formatKES(total)} goes on the client's account as an unpaid invoice you can download, share on WhatsApp or email.
                      Their package starts once it is paid.
                    </p>
                  )}
                </section>
              )}

              {/* How the client pays */}
              <section className={cn('space-y-3', invoicing && 'hidden')}>
                <SectionHeading>How is the client paying?</SectionHeading>
                {advanceToApply > 0 && amountDueAfterAdvance === 0 ? (
                  <div className="space-y-3 rounded-2xl bg-[#F2F2F4] p-4 [.dark_&]:bg-[#1E1E1E]">
                    <p className="text-[13px] text-foreground-3">The client’s advance covers this sale. No new payment will be recorded.</p>
                    <Button type="button" loading={mutation.isPending} disabled={needsClient} onClick={() => mutation.mutate(getValues())} className="h-12 w-full rounded-xl bg-brand-600 text-white hover:bg-brand-700">Apply advance · {formatKES(advanceToApply)}</Button>
                  </div>
                ) : <PaymentCapture
                  mode={payMode}
                  onModeChange={choosePayMode}
                  total={amountDueAfterAdvance}
                  phone={clientPhone}
                  onPhoneChange={setClientPhone}
                  reference={lineItems[0]?.name.split(/\s+/)[0] ?? 'Knoxville'}
                  captured={captured}
                  onCaptured={capturePayment}
                />}

                {payMode === 'cash' && !(advanceToApply > 0 && amountDueAfterAdvance === 0) && (
                  <div className="space-y-3 rounded-2xl bg-[#F2F2F4] p-4 [.dark_&]:bg-[#1E1E1E]">
                    <div className="space-y-1.5">
                      <Label htmlFor="payment-method">Method</Label>
                      <Select
                        id="payment-method"
                        value={paymentMethod}
                        onChange={(event) => handlePaymentMethodChange(event.target.value)}
                        aria-invalid={errors.paymentMethod ? true : undefined}
                        className="bg-white [.dark_&]:bg-surface-3"
                      >
                        {DEFAULT_PAYMENT_METHODS.map((method) => (
                          <option key={method} value={method}>
                            {method === 'M-PESA' ? 'M-Pesa' : method.charAt(0) + method.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="amount-paid">Amount received (KSh)</Label>
                      <Input
                        id="amount-paid"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        disabled={paymentMethod === 'CREDIT'}
                        placeholder={String(amountDueAfterAdvance || 0)}
                        aria-invalid={errors.amountPaid ? true : undefined}
                        className="bg-white [.dark_&]:bg-surface-3"
                        {...register('amountPaid')}
                      />
                      {paymentMethod === 'CREDIT' ? (
                        <p className="text-[12px] text-foreground-4">On credit: the full amount goes on the client's balance.</p>
                      ) : isPartial ? (
                        <p className="text-[12px] font-medium text-warning">
                          {formatKES(balanceOwed)} short: the rest goes on the client's balance.
                        </p>
                      ) : (
                        total > 0 && amountPaid + advanceToApply >= total && <p className="text-[12px] font-medium text-success">Paid in full.</p>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Discount, tucked away */}
              <section>
                <button
                  type="button"
                  onClick={() => setShowDiscount((v) => !v)}
                  className="flex w-full items-center justify-between px-1 py-1 text-[13px] font-medium text-foreground-3"
                  aria-expanded={showDiscount}
                >
                  {appliedDiscount > 0 ? `Discount · ${formatKES(appliedDiscount)}` : 'Add a discount'}
                  <ChevronDown className={`h-4 w-4 transition-transform ${showDiscount ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {showDiscount && (
                  <div className="mt-2 space-y-1.5">
                    <Input
                      id="discount"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="0"
                      aria-label="Discount in KSh"
                      aria-invalid={errors.discount ? true : undefined}
                      {...register('discount')}
                    />
                    {errors.discount && <p className="text-xs text-danger">{errors.discount.message}</p>}
                  </div>
                )}
              </section>

              {/* Confirm */}
              <section className="space-y-2.5">
                {needsClient && (
                <Alert variant="warning" inline>Enter the client's name so their WiFi subscription starts or renews.</Alert>
              )}
              {errors.root && (
                <Alert variant="error" inline>{errors.root.message}</Alert>
              )}
                <Button
                  type="submit"
                  form="record-sale-form"
                  size="lg"
                  className="h-14 w-full rounded-2xl bg-brand-600 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(45,160,67,0.7)] hover:bg-brand-700"
                  disabled={lineItems.length === 0 || total <= 0 || (!invoicing && payMode !== 'cash' && !captured)}
                  loading={mutation.isPending}
                >
                  <Lock className="h-4 w-4" aria-hidden />
                  {invoicing ? 'Generate invoice' : 'Confirm sale'} · {formatKES(total)}
                </Button>
                <p className="text-center text-[11px] text-foreground-4">
                  {invoicing
                    ? 'Saved as an unpaid invoice on the client’s account.'
                    : payMode === 'cash'
                    ? 'The sale is saved with the amount received.'
                    : captured
                      ? 'Payment confirmed. Saving starts or renews the WiFi package.'
                      : payMode === 'prompt'
                        ? 'Send the prompt; confirm once the client has paid.'
                        : 'Read the M-Pesa message to confirm the payment.'}
                </p>
              </section>
            </div>
          </Dialog>
      </form>
    </div>
  );
}
