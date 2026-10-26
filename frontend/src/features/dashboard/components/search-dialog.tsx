import * as React from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bike,
  BookOpen,
  Camera,
  Carrot,
  ChevronRight,
  Coffee,
  CupSoda,
  Dumbbell,
  Fish,
  Flower2,
  Footprints,
  Hammer,
  Headphones,
  Laptop,
  LayoutGrid,
  Milk,
  Package,
  Pill,
  Scissors,
  Search,
  Shirt,
  ShoppingBag,
  Smartphone,
  Truck,
  Users,
  Utensils,
  Wrench,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  customersApi,
  productsApi,
  servicesApi,
} from '@/api/endpoints';
import type { Customer, Product, Service } from '@/api/types';
import { cn } from '@/lib/utils';
import { SpeedWheel } from '@/components/ui/workspace-loader';

type Scope = 'all' | 'products' | 'services' | 'customers';

const scopes: Array<{ id: Scope; label: string; icon: LucideIcon; iconColor: string }> = [
  { id: 'all', label: 'All', icon: LayoutGrid, iconColor: 'text-emerald-600' },
  { id: 'products', label: 'Products', icon: Package, iconColor: 'text-emerald-600' },
  { id: 'services', label: 'Services', icon: Scissors, iconColor: 'text-emerald-600' },
  { id: 'customers', label: 'Customers', icon: Users, iconColor: 'text-emerald-600' },
];

const productIconMap: Array<[RegExp, LucideIcon]> = [
  [/phone|sim|charger|tablet/i, Smartphone],
  [/laptop|computer|printer|keyboard|mouse/i, Laptop],
  [/headphone|earphone|speaker|radio|sound/i, Headphones],
  [/camera|photo|lens/i, Camera],
  [/shoe|sneaker|boot|sandal|heel/i, Footprints],
  [/shirt|dress|jean|cloth|jacket|uniform|boutique/i, Shirt],
  [/coffee/i, Coffee],
  [/soda|juice|water|drink|energy/i, CupSoda],
  [/milk|yoghurt|yogurt|cheese|butter/i, Milk],
  [/vegetable|fruit|tomato|onion|potato|kale|sukuma|grocery/i, Carrot],
  [/fish|omena/i, Fish],
  [/pill|medicine|drug|panadol|paracetamol|health/i, Pill],
  [/book|notebook|pen|pencil|paper|stationery/i, BookOpen],
  [/flower|seedling|plant|fertilizer/i, Flower2],
  [/dumbbell|gym|fitness|weight|sport|ball/i, Dumbbell],
];

const serviceIconMap: Array<[RegExp, LucideIcon]> = [
  [/hair|salon|barber|plait|braid|nail|beauty|spa|massage|makeup/i, Scissors],
  [/repair|fix|plumb|carpenter|furniture|construction|mason/i, Hammer],
  [/electric|wiring|solar|installation/i, Zap],
  [/transport|delivery|courier|moving|taxi|matatu/i, Truck],
  [/bike|bicycle|boda/i, Bike],
  [/catering|food|restaurant|cook|chef|hotel/i, Utensils],
  [/photography|video|shoot/i, Camera],
  [/tuition|tutor|teach|training|lesson/i, BookOpen],
];

function pickProductIcon(name: string): LucideIcon {
  for (const [pattern, icon] of productIconMap) {
    if (pattern.test(name)) return icon;
  }
  return ShoppingBag;
}

function pickServiceIcon(name: string): LucideIcon {
  for (const [pattern, icon] of serviceIconMap) {
    if (pattern.test(name)) return icon;
  }
  return Wrench;
}

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [scope, setScope] = React.useState<Scope>('all');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  const products = useQuery({
    queryKey: ['search-browse', 'products'],
    queryFn: () => productsApi.list({ limit: 20 }),
    enabled: open,
  });

  const services = useQuery({
    queryKey: ['search-browse', 'services'],
    queryFn: () => servicesApi.list({}),
    enabled: open,
  });

  const customers = useQuery({
    queryKey: ['search-browse', 'customers'],
    queryFn: () => customersApi.list({ limit: 20 }),
    enabled: open,
  });

  if (!open) return null;

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const q = query.trim().toLowerCase();
  const match = (name: string) => name.toLowerCase().includes(q);

  const productItems = (products.data?.items ?? []).filter(
    (p: Product) => q === '' || match(p.name),
  );
  const serviceItems = (services.data ?? []).filter(
    (s: Service) => q === '' || match(s.name),
  );
  const customerItems = (customers.data?.items ?? []).filter(
    (c: Customer) =>
      q === '' ||
      match(c.name) ||
      (c.phone ?? '').toLowerCase().includes(q),
  );

  const loading = products.isLoading || services.isLoading || customers.isLoading;
  const total =
    productItems.length + serviceItems.length + customerItems.length;

  const groups = [
    {
      id: 'products' as const,
      visible: scope === 'all' || scope === 'products',
      title: 'Products',
      tone: 'bg-accent-soft text-accent-strong',
      seeAll: '/products',
      items: productItems.map((product: Product) => {
        const Icon = pickProductIcon(product.name);
        return {
          key: product.id,
          title: product.name,
          icon: <Icon className="h-3 w-3" aria-hidden />,
          onClick: () => go('/products'),
        };
      }),
    },
    {
      id: 'services' as const,
      visible: scope === 'all' || scope === 'services',
      title: 'Services',
      tone: 'bg-info-soft text-info',
      seeAll: '/services',
      items: serviceItems.map((service: Service) => {
        const Icon = pickServiceIcon(service.name);
        return {
          key: service.id,
          title: service.name,
          icon: <Icon className="h-3 w-3" aria-hidden />,
          onClick: () => go('/services'),
        };
      }),
    },
    {
      id: 'customers' as const,
      visible: scope === 'all' || scope === 'customers',
      title: 'Customers',
      tone: 'bg-warning-soft text-warning',
      seeAll: '/customers',
      items: customerItems.map((customer: Customer) => ({
        key: customer.id,
        title: customer.name,
        icon: (
          <span className="text-[9px] font-medium leading-none">
            {customer.name.charAt(0).toUpperCase()}
          </span>
        ),
        onClick: () => go(`/customers/${customer.id}`),
      })),
    },
  ].filter((group) => group.visible);

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-ink-950/70"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative z-10 mx-auto flex h-full w-full max-w-lg flex-col bg-[#F6F8F7] sm:my-16 sm:h-auto sm:max-h-[85vh] sm:rounded-3xl sm:border sm:border-edge sm:shadow-lg"
      >
        {/* Title bar */}
        <div className="relative flex h-14 shrink-0 items-center px-2">
          <button
            onClick={() => onOpenChange(false)}
            className="flex h-11 w-auto items-center justify-start px-1 text-[14px] font-semibold text-foreground-2 transition-opacity active:opacity-60"
            aria-label="Back"
          >
            Back
          </button>
          <h2 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-medium tracking-tight text-foreground">
            Search
          </h2>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="flex h-11 items-center gap-2.5 rounded-full border border-edge bg-field px-4 focus-within:border-edge-2">
            <Search className="h-4 w-4 shrink-0 text-foreground-4" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your business…"
              className="h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:font-medium placeholder:text-foreground-4"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Scope buttons — admin nav tab style */}
        <div className="flex items-center justify-center gap-1.5 px-4 pb-3">
          {scopes.map((item) => {
            const isActive = scope === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setScope(item.id)}
                className={cn(
                  'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'bg-transparent text-foreground-3 hover:bg-surface-2',
                )}
              >
                <item.icon className={cn('h-3.5 w-3.5', item.iconColor)} aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Grouped result cards */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-6">
          {loading && (
            <div role="status" aria-label="Loading" className="flex items-center justify-center py-12">
              <SpeedWheel />
            </div>
          )}

          {!loading && total === 0 && (
            <p className="py-12 text-center text-sm text-foreground-4">
              {q ? `No results found for "${query.trim()}".` : 'Nothing to search yet.'}
            </p>
          )}

          {!loading &&
            groups.map((group) =>
              group.items.length > 0 ? (
                  <div
                    key={group.id}
                    className="overflow-hidden rounded-3xl border border-edge bg-white"
                  >
                  <div className="flex items-center justify-between px-4 pb-1 pt-3.5">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground-3">
                      {group.title}
                    </p>
                    <button
                      onClick={() => go(group.seeAll)}
                      className="flex items-center gap-0.5 text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      See all
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-2">
                    {group.items.map((item) => (
                      <Tile
                        key={item.key}
                        icon={item.icon}
                        tone={group.tone}
                        title={item.title}
                        onClick={item.onClick}
                      />
                    ))}
                  </div>
                </div>
              ) : null,
            )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Tile({
  icon,
  tone,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 min-w-0 items-center gap-2 rounded-full border border-edge bg-transparent px-3 transition-all hover:bg-surface-2 active:bg-surface-3 active:scale-[0.97]"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${tone}`}
      >
        {icon}
      </span>
      <span className="min-w-0 truncate text-xs font-medium text-foreground">
        {title}
      </span>
    </button>
  );
}
