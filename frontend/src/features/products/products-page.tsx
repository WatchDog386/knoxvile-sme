import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Package,
  History,
  Minus,
  Target,
  AlertTriangle,
  ChevronRight,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { categoriesApi, productsApi } from '@/api/endpoints';
import { AppBar } from '@/components/layout/app-bar';
import { apiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { Badge, statusVariant, statusLabel } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatKES } from '@/lib/utils';
import { ProductsMobile } from './products-mobile';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { PackageCard } from './package-card';
import { ProductForm, type ProductKind } from './product-form';
import { DuoProducts, DuoSubscribers } from '@/components/brand/duo-icons';
import { StockActionForm, type StockActionType } from './stock-action-form';
import type { Product } from '@/api/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

const stockStatusConfig = {
  IN_STOCK: { icon: Shield, color: 'bg-emerald-500 text-white', label: 'In Stock' },
  LOW_STOCK: { icon: AlertTriangle, color: 'bg-amber-500 text-white', label: 'Low Stock' },
  OUT_OF_STOCK: { icon: AlertCircle, color: 'bg-red-500 text-white', label: 'Out of Stock' },
};

const trackConfig = {
  true: { icon: Shield, tint: 'success', desc: 'Stock tracking enabled' },
  false: { icon: Package, tint: 'cyan', desc: 'Not tracking stock' },
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 ml-1 text-[14px] font-medium tracking-tight text-foreground">
      {children}
    </p>
  );
}

function ProductRow({
  product,
  onEdit,
  onStockAction,
  onHistory,
  onDelete,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onStockAction: (product: Product, type: StockActionType) => void;
  onHistory: (product: Product) => void;
  onDelete: (product: Product) => void;
}) {
  const status = product.stock_status ?? 'IN_STOCK';
  const statusInfo = stockStatusConfig[status];
  const StatusIcon = statusInfo.icon;
  const tracking = trackConfig[product.track_inventory.toString() as keyof typeof trackConfig];
  const TrackingIcon = tracking.icon;

  return (
    <button
      onClick={() => onEdit(product)}
      className="relative flex w-full items-center gap-3 px-1 py-3 text-center transition-colors duration-150 hover:bg-surface-2 active:bg-surface-3 group max-lg:rounded-xl"
    >
      <span className={cn(
        'flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px]',
        tracking.tint ? `bg-${tracking.tint}-500/10 text-${tracking.tint}-600 dark:text-${tracking.tint}-400` : 'bg-surface-3 text-foreground-2'
      )}>
        <TrackingIcon className="h-4.5 w-4.5" aria-hidden />
      </span>

      <span className="min-w-0 flex-1 flex flex-col items-center">
        <span className="block truncate text-sm font-medium text-foreground leading-snug w-full text-center">
          {product.name}
        </span>
        <span className="block truncate text-xs leading-snug text-foreground-4 w-full text-center">
          {product.sku ?? 'No SKU'} · {product.category_name ?? 'No category'} · Cost {formatKES(product.cost_price)}
        </span>
      </span>

      <div className="flex items-center gap-2 shrink-0">
        <div className="text-center hidden sm:block">
          <p className="text-sm font-semibold text-foreground">{formatKES(product.selling_price)}</p>
          <p className="text-[11px] text-foreground-5">selling price</p>
        </div>

        <Badge variant={statusVariant(status)} className="hidden sm:inline-flex items-center gap-1">
          <StatusIcon className="h-3 w-3" />
          {statusInfo.label}
        </Badge>

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onStockAction(product, 'restock'); }}
            className="p-1.5 rounded-lg text-foreground-4 hover:bg-surface-3 hover:text-accent transition-colors"
            title="Add stock"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onStockAction(product, 'adjust'); }}
            className="p-1.5 rounded-lg text-foreground-4 hover:bg-surface-3 hover:text-emerald-500 transition-colors"
            title="Set stock level"
          >
            <Target className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onStockAction(product, 'damage'); }}
            className="p-1.5 rounded-lg text-foreground-4 hover:bg-surface-3 hover:text-red-500 transition-colors"
            title="Record damaged stock"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onHistory(product); }}
            className="p-1.5 rounded-lg text-foreground-4 hover:bg-surface-3 hover:text-foreground transition-colors"
            title="Movement history"
          >
            <History className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(product); }}
            className="p-1.5 rounded-lg text-foreground-4 hover:bg-surface-3 hover:text-red-500 transition-colors"
            title="Delete product"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
          </button>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-foreground-5 group-hover:text-foreground transition-colors max-lg:hidden" aria-hidden />
      </div>
    </button>
  );
}

export function ProductsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  // "Add" first asks what to add, then opens the matching form
  const [chooserOpen, setChooserOpen] = useState(false);
  const [addKind, setAddKind] = useState<ProductKind | null>(null);
  const startAdd = () => setChooserOpen(true);

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    if (searchParams.get('package') === '1') setAddKind('package');
    else setChooserOpen(true);
  }, [searchParams]);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [stockAction, setStockAction] = useState<{
    product: Product;
    type: StockActionType;
  } | null>(null);

  const handleStockAction = (product: Product, type: StockActionType) => {
    setStockAction({ product, type });
  };
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ['categories', 'PRODUCT'],
    queryFn: () => categoriesApi.list('PRODUCT'),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'products',
      { page, search: debouncedSearch, categoryId: categoryFilter, stockStatus: stockFilter },
    ],
    queryFn: () =>
      productsApi.list({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        categoryId: categoryFilter || undefined,
        stockStatus: stockFilter || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: async () => {
      setConfirmDelete(null);
      setDeleteError(null);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setDeleteError(apiErrorMessage(err)),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const isDesktop = useIsDesktop();

  // Phones: pure white page in light mode (dark mode is black everywhere)
  useEffect(() => {
    if (isDesktop) return;
    document.body.classList.add('page-white');
    return () => document.body.classList.remove('page-white');
  }, [isDesktop]);

  const onSearch = (value: string) => {
    setSearch(value);
    setPage(1);
    window.setTimeout(() => setDebouncedSearch(value), 300);
  };

  const header = (
    <>
      <AppBar
        title="Products"
        onBack={() => window.history.back()}
        right={
          <div>
            <Button onClick={startAdd} className="h-9 px-3 gap-1.5">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
        }
      />

      <div className="px-4 pb-3">
        <div className="flex h-11 items-center gap-2.5 rounded-full border border-edge bg-field px-4 focus-within:border-edge-2">
          <Search className="h-4 w-4 shrink-0 text-foreground-4" aria-hidden />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
              window.setTimeout(() => setDebouncedSearch(event.target.value), 300);
            }}
            placeholder="Search products..."
            className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:font-medium placeholder:text-foreground-4"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-1.5 px-4 pb-3">
        <Select
          value={categoryFilter}
          onChange={(event) => {
            setCategoryFilter(event.target.value);
            setPage(1);
          }}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium transition-colors bg-transparent text-foreground-3 hover:bg-surface-2"
          placeholder="All categories"
        >
          {categoriesQuery.data?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        <Select
          value={stockFilter}
          onChange={(event) => {
            setStockFilter(event.target.value);
            setPage(1);
          }}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium transition-colors bg-transparent text-foreground-3 hover:bg-surface-2"
          placeholder="All stock statuses"
        >
          <option value="IN_STOCK">In stock</option>
          <option value="LOW_STOCK">Low stock</option>
          <option value="OUT_OF_STOCK">Out of stock</option>
        </Select>
      </div>
    </>
  );

  const emptyState = (
    <EmptyState
      icon={Package}
      title={debouncedSearch ? 'No products found' : 'No products yet'}
      description={
        debouncedSearch
          ? 'Try a different search or filter.'
          : 'Add the products you sell so you can start recording sales and tracking stock.'
      }
      actionLabel={debouncedSearch ? undefined : 'Add a product'}
      onAction={startAdd}
    />
  );

  const productList = data && data.items.length > 0 ? (
    <Card className="bg-surface mx-4 max-lg:mx-0 max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none">
      {/* WiFi packages first: they're what Knoxville sells most */}
      {data.items.some((p) => p.billing_days) && (
        <>
          <SectionLabel>WiFi packages</SectionLabel>
          <div className="stagger-list mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.items
              .filter((p) => p.billing_days && p.active)
              .sort((a, b) => a.selling_price - b.selling_price)
              .map((pkg, i) => (
                <PackageCard key={pkg.id} product={pkg} index={i} onEdit={setEditProduct} onDelete={setConfirmDelete} />
              ))}
          </div>
        </>
      )}
      <SectionLabel>{data.items.some((p) => p.billing_days) ? 'Equipment & products' : 'All Products'}</SectionLabel>
      <div className="stagger-list divide-y divide-edge/50 max-lg:divide-y-0 max-lg:space-y-2">
        {data.items.filter((p) => !p.billing_days).map((product) => (
          <ProductRow
            key={product.id}
            product={product}
            onEdit={setEditProduct}
            onStockAction={handleStockAction}
            onHistory={setHistoryProduct}
            onDelete={setConfirmDelete}
          />
        ))}
      </div>
      {data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-edge px-1 py-3">
          <p className="text-xs text-foreground-5">
            Page {page} of {totalPages} · {data.total} products
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  ) : null;

  const errorNode = error && <Alert variant="error" title="Could not load products" inline>{apiErrorMessage(error)}</Alert>;
  const loadingNode = isLoading && <PageLoader inline message="Loading" />;

  return (
    <div className="space-y-5">
      {isDesktop ? (
        <>
          {header}
          {errorNode}
          {loadingNode}
          {data && data.items.length === 0 && emptyState}
          {productList}
        </>
      ) : (
        <ProductsMobile
          items={data?.items}
          total={data?.total ?? 0}
          page={page}
          totalPages={totalPages}
          onPage={setPage}
          search={search}
          onSearch={onSearch}
          categories={categoriesQuery.data}
          categoryFilter={categoryFilter}
          onCategory={(v) => {
            setCategoryFilter(v);
            setPage(1);
          }}
          stockFilter={stockFilter}
          onStock={(v) => {
            setStockFilter(v);
            setPage(1);
          }}
          loading={loadingNode}
          errorNode={errorNode}
          onAdd={startAdd}
          onAddPackage={() => {
            setChooserOpen(false);
            setAddKind('package');
          }}
          onEdit={setEditProduct}
          onStockAction={handleStockAction}
          onHistory={setHistoryProduct}
          onDelete={setConfirmDelete}
        />
      )}

      <Dialog open={chooserOpen} onOpenChange={setChooserOpen} title="What would you like to add?">
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { kind: 'package', label: 'WiFi package', note: 'Monthly internet plan', Icon: DuoSubscribers },
              { kind: 'product', label: 'Product', note: 'Equipment kept in stock', Icon: DuoProducts },
            ] as const
          ).map(({ kind, label, note, Icon }) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                setChooserOpen(false);
                setAddKind(kind);
              }}
              className="flex flex-col items-center gap-3 rounded-2xl bg-surface-3 px-3 py-5 text-center transition-transform active:scale-[0.97]"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-brand-600 [.dark_&]:text-brand-400">
                <Icon className="h-7 w-7" />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-foreground">{label}</span>
                <span className="block text-[12px] text-foreground-3">{note}</span>
              </span>
            </button>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={addKind !== null}
        onOpenChange={(open) => !open && setAddKind(null)}
        title={addKind === 'package' ? 'Add a WiFi package' : 'Add a product'}
        description={
          addKind === 'package'
            ? 'A monthly plan. Selling it starts or renews a client’s subscription.'
            : 'Products are deducted from stock automatically when you sell them.'
        }
      >
        {addKind && <ProductForm key={addKind} kind={addKind} onClose={() => setAddKind(null)} />}
      </Dialog>

      <Dialog
        open={Boolean(editProduct)}
        onOpenChange={(open) => !open && setEditProduct(null)}
        title={editProduct?.billing_days ? 'Edit package' : 'Edit product'}
      >
        {editProduct && (
          <ProductForm
            onClose={() => setEditProduct(null)}
            defaultValues={editProduct}
          />
        )}
      </Dialog>

      <Dialog
        open={Boolean(stockAction)}
        onOpenChange={(open) => !open && setStockAction(null)}
        title={stockAction ? configTitle(stockAction.type) : ''}
      >
        {stockAction && (
          <StockActionForm
            type={stockAction.type}
            productId={stockAction.product.id}
            productName={stockAction.product.name}
            onClose={() => setStockAction(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={Boolean(historyProduct)}
        onOpenChange={(open) => !open && setHistoryProduct(null)}
        title={`Stock history — ${historyProduct?.name ?? ''}`}
      >
        {historyProduct && <ProductHistory productId={historyProduct.id} />}
      </Dialog>

      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Delete product?"
        description={`"${confirmDelete?.name}" will be permanently removed. Products that have been sold cannot be deleted — deactivate them instead.`}
      >
        <div className="space-y-4">
          {deleteError && <Alert variant="error">{deleteError}</Alert>}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
            >
              Delete product
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function configTitle(type: StockActionType): string {
  return type === 'restock'
    ? 'Add stock'
    : type === 'adjust'
      ? 'Set stock level'
      : 'Record damaged stock';
}

function ProductHistory({ productId }: { productId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['product-history', productId],
    queryFn: () => productsApi.history(productId),
  });

  if (isLoading) {
    return <PageLoader inline message="Loading" />;
  }

  if (error) return <Alert variant="error" inline>{apiErrorMessage(error)}</Alert>;

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No stock movements yet"
        description="Restock, adjust or damage entries will appear here."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {data.map((movement) => (
        <li
          key={movement.id}
          className="flex items-center justify-between rounded-xl border border-edge px-3 py-2"
        >
          <div>
            <p className="text-sm font-medium text-foreground">
              {statusLabel(movement.type)}
              {movement.quantity >= 0 ? ' +' : ' '}
              {movement.quantity}
            </p>
            <p className="text-xs text-foreground-5">
              {movement.reason ?? '—'}
            </p>
          </div>
          <span className="text-xs text-foreground-5">
            {new Date(movement.created_at).toLocaleDateString('en-KE', {
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}