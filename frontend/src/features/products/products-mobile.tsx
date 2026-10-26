import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowUpDown,
  ArrowUpRight,
  Bell,
  History,
  Minus,
  Package,
  Plus,
  Search,
  Target,
  Trash2,
  Wifi,
} from 'lucide-react';
import type { Category, Product } from '@/api/types';
import { useActiveBusiness } from '@/stores/business';
import { cn } from '@/lib/utils';
import { Chips } from '@/components/layout/app-bar';
import { PackageHeroCard } from '@/components/brand/package-hero-card';
import { Input } from '@/components/ui/input';
import type { StockActionType } from './stock-action-form';
import { PackageCard } from './package-card';

/*
 * Phone Products page in the style of the travel-ticket reference: category
 * tabs and search like the Sales page, lime main button, purple notched
 * tickets for WiFi packages and boarding-pass cards for products. Black in
 * dark mode, white in light mode.
 */

const LIME = '#B8F28B';
const PURPLE = '#248537'; // package ticket: deep Safaricom green
// Tiles: soft grey on white, charcoal on black
const TILE = 'bg-[#F2F2F4] [.dark_&]:bg-[#1E1E1E]';

/* ---------------- Ticket outline ---------------- */

/**
 * Card outline with real cut-outs: an optional U-shaped notch in the middle
 * of the top edge, and optional half-circle notches on both sides (where a
 * boarding pass tears off), `sideNotchFromBottom` px above the bottom.
 */
function ticketPath(
  w: number,
  h: number,
  { topNotch, sideNotchFromBottom }: { topNotch?: boolean; sideNotchFromBottom?: number },
): string {
  const R = 28; // card corners
  const parts = [`M ${R} 0`];
  if (topNotch) {
    const nw = 112; // notch width at the top edge
    const d = 26; // notch depth
    const f = 12; // rounded shoulders
    const r = 14; // rounded inner corners
    const x1 = w / 2 - nw / 2;
    const x2 = w / 2 + nw / 2;
    parts.push(
      `H ${x1}`,
      `A ${f} ${f} 0 0 1 ${x1 + f} ${f}`,
      `V ${d - r}`,
      `A ${r} ${r} 0 0 0 ${x1 + f + r} ${d}`,
      `H ${x2 - f - r}`,
      `A ${r} ${r} 0 0 0 ${x2 - f} ${d - r}`,
      `V ${f}`,
      `A ${f} ${f} 0 0 1 ${x2} 0`,
    );
  }
  parts.push(`H ${w - R}`, `A ${R} ${R} 0 0 1 ${w} ${R}`);
  const sr = 15;
  const sy = sideNotchFromBottom ? h - sideNotchFromBottom : 0;
  if (sideNotchFromBottom) parts.push(`V ${sy - sr}`, `A ${sr} ${sr} 0 0 0 ${w} ${sy + sr}`);
  parts.push(`V ${h - R}`, `A ${R} ${R} 0 0 1 ${w - R} ${h}`, `H ${R}`, `A ${R} ${R} 0 0 1 0 ${h - R}`);
  if (sideNotchFromBottom) parts.push(`V ${sy + sr}`, `A ${sr} ${sr} 0 0 0 0 ${sy - sr}`);
  parts.push(`V ${R}`, `A ${R} ${R} 0 0 1 ${R} 0`, 'Z');
  return parts.join(' ');
}

function TicketShape({
  fill,
  fillClass,
  topNotch,
  sideNotchFromBottom,
  className,
  children,
}: {
  fill: string;
  /** Classes on the shape (e.g. `fill-…` per theme); used instead of `fill` when set. */
  fillClass?: string;
  topNotch?: boolean;
  sideNotchFromBottom?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn('relative', className)}>
      {size.w > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden>
          <path
            d={ticketPath(size.w, size.h, { topNotch, sideNotchFromBottom })}
            fill={fillClass ? undefined : fill}
            className={fillClass}
          />
        </svg>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

/* ---------------- Header ---------------- */

/** Back on the left, title centred, notifications on the right. */
function ProductsHeader() {
  const navigate = useNavigate();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'));
  return (
    <header className="page-head relative flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={goBack}
        className="flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-[15px] font-semibold text-foreground-2 transition-transform active:scale-95 active:opacity-60"
        aria-label="Back"
      >
        Back
      </button>
      <h1 className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[22px] font-semibold leading-tight tracking-tight text-foreground">
        Products
      </h1>
      <button
        type="button"
        onClick={() => navigate('/notifications')}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-edge bg-surface text-foreground-2 active:scale-90"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" aria-hidden />
      </button>
    </header>
  );
}

function shortKsh(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('en-KE', { maximumFractionDigits: 1 })}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toLocaleString('en-KE', { maximumFractionDigits: 1 })}K`;
  return amount.toLocaleString('en-KE');
}

/* ---------------- Product boarding pass (white) ---------------- */

const STATUS: Record<string, { label: string; className: string }> = {
  IN_STOCK: { label: 'In stock', className: 'bg-emerald-100 text-emerald-700' },
  LOW_STOCK: { label: 'Low stock', className: 'bg-amber-100 text-amber-700' },
  OUT_OF_STOCK: { label: 'Out of stock', className: 'bg-red-100 text-red-700' },
};

// Height of the tear-off strip at the bottom of the pass
const STUB = 92;

function BoardingPass({
  product,
  onEdit,
  onStockAction,
  onHistory,
  onDelete,
}: {
  product: Product;
  onEdit: (p: Product) => void;
  onStockAction: (p: Product, type: StockActionType) => void;
  onHistory: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  const status = STATUS[product.stock_status ?? 'IN_STOCK'];
  const margin = product.selling_price > 0 ? Math.round(((product.selling_price - product.cost_price) / product.selling_price) * 100) : 0;
  const actions: { label: string; icon: typeof Plus; onClick: () => void; danger?: boolean }[] = [
    { label: 'Add', icon: Plus, onClick: () => onStockAction(product, 'restock') },
    { label: 'Set', icon: Target, onClick: () => onStockAction(product, 'adjust') },
    { label: 'Damaged', icon: Minus, onClick: () => onStockAction(product, 'damage') },
    { label: 'History', icon: History, onClick: () => onHistory(product) },
    { label: 'Delete', icon: Trash2, onClick: () => onDelete(product), danger: true },
  ];

  return (
    <TicketShape fill="#FFFFFF" fillClass="fill-[#F2F2F4] [.dark_&]:fill-white" sideNotchFromBottom={STUB} className="text-black">
      <button type="button" onClick={() => onEdit(product)} className="block w-full px-5 pb-4 pt-5 text-left">
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold">
            <Package className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{product.sku ?? 'NO SKU'}</span>
          </span>
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', status.className)}>{status.label}</span>
        </span>

        <span className="mt-3 block truncate text-[15px] font-semibold">{product.name}</span>

        <span className="mt-3 flex items-end justify-between gap-2">
          <span>
            <span className="block text-[22px] font-bold leading-none tracking-tight">{shortKsh(product.cost_price)}</span>
            <span className="mt-1 block text-[10px] text-neutral-500">Cost price</span>
          </span>
          <span className="mb-4 flex flex-1 items-center px-1" aria-hidden>
            <span className="h-px flex-1 border-t border-dashed border-black/70" />
            <ArrowUpRight className="-ml-1 h-3.5 w-3.5 rotate-45" />
          </span>
          <span className="text-right">
            <span className="block text-[22px] font-bold leading-none tracking-tight">{shortKsh(product.selling_price)}</span>
            <span className="mt-1 block text-[10px] text-neutral-500">Selling price</span>
          </span>
        </span>

        <span className="mt-4 grid grid-cols-3 gap-2">
          {[
            ['In stock', product.track_inventory ? String(product.stock_quantity) : '—'],
            ['Low at', product.track_inventory ? String(product.low_stock_threshold) : '—'],
            ['Margin', `${margin}%`],
          ].map(([label, value], i) => (
            <span key={label} className={cn(i === 1 && 'text-center', i === 2 && 'text-right')}>
              <span className="block text-[10px] text-neutral-500">{label}</span>
              <span className="block text-[13px] font-semibold">{value}</span>
            </span>
          ))}
        </span>
        <span className="mt-2 block truncate text-[10px] text-neutral-500">{product.category_name ?? 'No category'}</span>
      </button>

      {/* Perforation, then the tear-off strip with the stock actions */}
      <div className="mx-5 border-t-2 border-dashed border-neutral-300 [.dark_&]:border-neutral-200" />
      <div className="flex items-center justify-between px-4" style={{ height: STUB }}>
        {actions.map(({ label, icon: Icon, onClick, danger }) => (
          <button key={label} type="button" onClick={onClick} className="flex w-14 flex-col items-center gap-1 active:scale-95">
            <span className={cn('flex h-10 w-10 items-center justify-center rounded-full', danger ? 'bg-red-50 text-red-600' : 'bg-white text-black [.dark_&]:bg-neutral-100')}>
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-[10px] font-medium text-neutral-600">{label}</span>
          </button>
        ))}
      </div>
    </TicketShape>
  );
}

/* ---------------- Page ---------------- */

type Scope = 'ALL' | 'PACKAGES' | 'PRODUCTS';

const SCOPE_ITEMS: Array<{ id: `scope:${Scope}`; label: string }> = [
  { id: 'scope:ALL', label: 'All' },
  { id: 'scope:PACKAGES', label: 'Packages' },
  { id: 'scope:PRODUCTS', label: 'Products' },
];

export function ProductsMobile({
  items,
  total,
  page,
  totalPages,
  onPage,
  search,
  onSearch,
  categories,
  categoryFilter,
  onCategory,
  stockFilter,
  onStock,
  loading,
  errorNode,
  onAdd,
  onAddPackage,
  onEdit,
  onStockAction,
  onHistory,
  onDelete,
}: {
  items: Product[] | undefined;
  total: number;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  search: string;
  onSearch: (value: string) => void;
  categories: Category[] | undefined;
  categoryFilter: string;
  onCategory: (value: string) => void;
  stockFilter: string;
  onStock: (value: string) => void;
  loading: React.ReactNode;
  errorNode: React.ReactNode;
  onAdd: () => void;
  /** Opens the package form directly, skipping the chooser. */
  onAddPackage: () => void;
  onEdit: (p: Product) => void;
  onStockAction: (p: Product, type: StockActionType) => void;
  onHistory: (p: Product) => void;
  onDelete: (p: Product) => void;
}) {
  const [priceDesc, setPriceDesc] = useState(false);
  const [scope, setScope] = useState<Scope>('ALL');
  const business = useActiveBusiness();
  // Switched-off packages (like the retired Business Pro) are left out
  const allPackages = (items ?? []).filter((p) => p.billing_days && p.active).sort((a, b) => a.selling_price - b.selling_price);
  const allProducts = (items ?? [])
    .filter((p) => !p.billing_days)
    .sort((a, b) => (priceDesc ? b.selling_price - a.selling_price : 0));

  const packages = scope === 'PRODUCTS' ? [] : allPackages;
  const products = scope === 'PACKAGES' ? [] : allProducts;

  const outOfStock = products.filter((p) => p.stock_status === 'OUT_OF_STOCK').length;
  const lowStock = products.filter((p) => p.stock_status === 'LOW_STOCK').length;
  const stockStatus = outOfStock > 0
    ? { label: `${outOfStock} out of stock`, tone: 'bad' as const }
    : lowStock > 0
      ? { label: `${lowStock} low`, tone: 'warn' as const }
      : { label: 'All in stock', tone: 'ok' as const };

  return (
    <div className="space-y-5 text-foreground">
      <ProductsHeader />

      {/* Same green card the client sees on their own dashboard home */}
      <PackageHeroCard
        label="Stock on hand"
        name={business?.name ?? 'Knoxville'}
        headline={String(total)}
        sub={total === 1 ? 'product' : 'products'}
        actions={[
          { label: 'Add product', icon: Plus, onClick: onAdd },
          { label: 'WiFi package', icon: Wifi, onClick: onAddPackage },
        ]}
        footer={`${products.length} equipment · ${packages.length} packages`}
        status={stockStatus}
      />

      {/* Scope tabs then the category chips, in one row, same pills as the Sales page */}
      <Chips
        outline
        items={[...SCOPE_ITEMS, ...(categories ?? []).map((c) => ({ id: `cat:${c.id}`, label: c.name }))]}
        value={categoryFilter ? `cat:${categoryFilter}` : `scope:${scope}`}
        onChange={(id) => {
          if (id.startsWith('cat:')) {
            onCategory(id.slice(4));
          } else {
            onCategory('');
            setScope(id.slice(6) as Scope);
          }
        }}
      />

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-5" aria-hidden />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search products by name or SKU..."
            className="h-11 rounded-full bg-field pl-9"
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          onClick={() => setPriceDesc((v) => !v)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-3 text-foreground active:scale-90"
          aria-label={priceDesc ? 'Sort by price, low to high' : 'Sort by price, high to low'}
          title="Sort by price"
        >
          <ArrowUpDown className={cn('h-4 w-4 transition-transform', priceDesc && 'rotate-180')} />
        </button>
      </div>

      {/* Three equal tiles: stock filter and counts */}
      <div className="grid grid-cols-3 gap-2">
        <label className={cn('flex h-[68px] flex-col items-center justify-center rounded-[22px] px-2 text-center', TILE)}>
          <span className="text-[11px] leading-4 text-foreground-4">Stock</span>
          <select
            value={stockFilter}
            onChange={(e) => onStock(e.target.value)}
            className="mt-1 h-5 w-full appearance-none !bg-transparent p-0 text-center text-[14px] leading-5 text-foreground outline-none [&>option]:text-black"
          >
            <option value="">All</option>
            <option value="IN_STOCK">In stock</option>
            <option value="LOW_STOCK">Low</option>
            <option value="OUT_OF_STOCK">Out</option>
          </select>
        </label>
        <div className={cn('flex h-[68px] flex-col items-center justify-center rounded-[22px] px-2', TILE)}>
          <span className="text-[11px] leading-4 text-foreground-4">Products</span>
          <span className="mt-1 h-5 text-[14px] leading-5">{products.length}</span>
        </div>
        <div className={cn('flex h-[68px] flex-col items-center justify-center rounded-[22px] px-2', TILE)}>
          <span className="text-[11px] leading-4 text-foreground-4">Packages</span>
          <span className="mt-1 h-5 text-[14px] leading-5">{packages.length}</span>
        </div>
      </div>

      <motion.button
        type="button"
        onClick={onAdd}
        whileTap={{ scale: 0.98 }}
        className="flex h-[60px] w-full items-center justify-center rounded-[22px] text-[16px] font-medium text-black"
        style={{ backgroundColor: LIME }}
      >
        Add
      </motion.button>

      {errorNode}
      {loading}

      {packages.length > 0 && (
        <section>
          <h2 className="mb-3 text-[17px]">WiFi Packages</h2>
          <div className="stagger-list grid grid-cols-2 gap-3">
            {packages.map((p, i) => (
              <PackageCard key={p.id} product={p} index={i} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </section>
      )}

      {items && (
        <section>
          <h2 className="mb-3 text-[17px]">{packages.length ? 'Equipment & Products' : 'Products'}</h2>
          {products.length === 0 ? (
            <div className={cn('rounded-[28px] px-5 py-10 text-center text-[13px] text-foreground-4', TILE)}>
              {search ? 'No products match your search.' : 'No products yet. Tap “Add” to add one.'}
            </div>
          ) : (
            <div className="stagger-list space-y-4">
              {products.map((p) => (
                <BoardingPass key={p.id} product={p} onEdit={onEdit} onStockAction={onStockAction} onHistory={onHistory} onDelete={onDelete} />
              ))}
            </div>
          )}
        </section>
      )}

      {total > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-foreground-4">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
              className={cn('h-10 rounded-full px-4 text-[13px] text-foreground disabled:opacity-40', TILE)}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPage(page + 1)}
              className="h-10 rounded-full px-4 text-[13px] font-medium text-white disabled:opacity-40"
              style={{ backgroundColor: PURPLE }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
