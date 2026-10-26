import { useState } from 'react';
import { HomePhoto } from '@/components/brand/home-photo';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, MessageCircle, Phone, Search, Wallet } from 'lucide-react';
import { clientApi, type ClientHome } from '@/api/endpoints';
import { WorkspaceLoader } from '@/components/ui/workspace-loader';
import { PackageCard, planStyle } from '@/features/products/package-card';
import type { Product } from '@/api/types';
import { cn, formatKES } from '@/lib/utils';
import { PaymentRow } from './client-shared';

/** Client packages are the lean shape; PackageCard expects the staff Product shape. */
export function toProduct(p: ClientHome['packages'][number]): Product {
  return {
    id: p.id,
    businessId: '',
    name: p.name,
    sku: null,
    categoryId: null,
    cost_price: 0,
    selling_price: p.price,
    stock_quantity: 0,
    low_stock_threshold: 0,
    track_inventory: false,
    active: true,
    created_at: '',
    updated_at: '',
    billing_days: p.billingDays,
    speed_mbps: p.speedMbps,
    description: p.description,
  };
}

/** Photo background, dark scrim and the back-titled header every client page shares. */
export function ClientShell({ title, children }: { title: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="relative isolate -mx-4 -mt-2 min-h-[100dvh] pb-8">
      <HomePhoto className="fixed inset-0 -z-20 h-full w-full object-cover" />
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/45 to-black/75"
      />

      <header className="sticky top-0 z-30 -mx-4 flex items-center gap-3 bg-black/45 py-3 pl-4 pr-4 pt-[max(0.75rem,var(--sat))] backdrop-blur-md">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex h-12 w-12 shrink-0 items-center justify-center text-white active:scale-90 active:opacity-60"
          aria-label="Back"
        >
          Back
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold text-white">{title}</h1>
        <span className="h-12 w-12 shrink-0" aria-hidden />
      </header>

      <div className="px-4 pt-4">{children}</div>
    </div>
  );
}

/** Outlined pill button on a dark surface, shared with the dashboard. */
export function ClientPillButton({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-white/70 text-[13px] font-semibold text-white transition-transform active:scale-[0.97]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Load the subscriber's account, showing the shared loader while it arrives. */
export function useClientHome() {
  const query = useQuery({ queryKey: ['client-me'], queryFn: clientApi.me });
  if (query.isLoading) return { ...query, home: null as ClientHome | null };
  return { ...query, home: query.data ?? null };
}

/** Search field over the page's list, same flat styling as the dashboard's. */
export function ClientSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60"
        aria-hidden
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-white/15 bg-black/40 py-3 pl-11 pr-4 text-sm font-medium text-white outline-none placeholder:font-medium placeholder:text-white/60"
        autoComplete="off"
        aria-label={placeholder}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ packages */

/** Every package the provider offers, with a pay button on each. */
export function ClientPackagesPage() {
  const { home, isLoading } = useClientHome();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');

  if (isLoading || !home) return <WorkspaceLoader />;

  const q = query.trim().toLowerCase();
  const mine = home.subscription?.productId ?? null;
  const list = home.packages
    .map((pkg, index) => ({ pkg, index }))
    .filter(({ pkg }) => q === '' || pkg.name.toLowerCase().includes(q));

  return (
    <ClientShell title="Packages">
      <ClientSearch value={query} onChange={setQuery} placeholder="Search packages…" />

      {list.length === 0 ? (
        <p className="mt-6 text-center text-[13px] text-white/75">No package matches “{query.trim()}”.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {list.map(({ pkg: p, index: i }) => {
            const name = p.name.replace(/\s*\d+\s*mbps\s*$/i, '') || p.name;
            const style = planStyle(name, i);
            const isMine = p.id === mine;
            return (
              <PackageCard
                key={p.id}
                product={toProduct(p)}
                index={i}
                onAdd={() => navigate(`/my-amount?pkg=${p.id}`)}
                footer={
                  <button
                    type="button"
                    onClick={() => navigate(`/my-amount?pkg=${p.id}`)}
                    className="inline-flex h-10 items-center rounded-xl border-[1.5px] px-3.5 text-[13px] font-medium tabular-nums transition-colors active:opacity-70"
                    style={
                      isMine
                        ? { background: style.from, borderColor: style.from, color: '#FFFFFF' }
                        : { borderColor: style.from, color: style.from }
                    }
                  >
                    {isMine ? 'My package · Pay' : `Pay · KSh ${p.price.toLocaleString('en-KE')}`}
                  </button>
                }
              />
            );
          })}
        </div>
      )}
    </ClientShell>
  );
}

/* ---------------------------------------------------------------------- pay */

/** Renew or switch package, with the provider's packages as a list. */
export function ClientPayPage() {
  const { home, isLoading } = useClientHome();
  const navigate = useNavigate();

  if (isLoading || !home) return <WorkspaceLoader />;

  const mine = home.packages.find((p) => p.id === home.subscription?.productId) ?? null;
  const others = home.packages.filter((p) => p.id !== mine?.id);

  return (
    <ClientShell title="Pay with M-Pesa">
      <section className="rounded-lg border border-white/15 bg-black/55 p-4 backdrop-blur-md">
        <h2 className="text-[15px] font-semibold text-white">Pay for your package</h2>
        <p className="mt-0.5 text-[12px] text-white/75">
          Pick how much to pay and you'll get an M-Pesa prompt on your phone.
        </p>

        {mine && (
          <button
            type="button"
            onClick={() => navigate(`/my-amount?pkg=${mine.id}`)}
            className="mt-3 flex w-full items-center gap-3 rounded-lg bg-white/10 p-3 text-left transition-transform active:scale-[0.99]"
          >
            <Wallet className="h-5 w-5 shrink-0 text-[#8BC53F]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-white">
                {mine.name.replace(/\s*\d+\s*mbps\s*$/i, '')}
              </span>
              <span className="block text-[12px] text-white/70">
                Your package · {formatKES(mine.price)}
              </span>
            </span>
            <span className="shrink-0 rounded-lg bg-[#8BC53F] px-3 py-1.5 text-[12px] font-semibold text-white">
              Pay
            </span>
          </button>
        )}
      </section>

      <h2 className="mt-5 px-1 text-[15px] font-semibold text-white">
        {mine ? 'Switch to another package' : 'Choose a package'}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {others.map((p, i) => (
          <PackageCard
            key={p.id}
            product={toProduct(p)}
            index={home.packages.indexOf(p) || i}
            onAdd={() => navigate(`/my-amount?pkg=${p.id}`)}
            footer={
              <button
                type="button"
                onClick={() => navigate(`/my-amount?pkg=${p.id}`)}
                className="inline-flex h-10 items-center rounded-xl border-[1.5px] px-3.5 text-[13px] font-medium tabular-nums transition-colors active:opacity-70"
                style={{ borderColor: planStyle(p.name.replace(/\s*\d+\s*mbps\s*$/i, ''), i).from, color: planStyle(p.name.replace(/\s*\d+\s*mbps\s*$/i, ''), i).from }}
              >
                Pay · KSh {p.price.toLocaleString('en-KE')}
              </button>
            }
          />
        ))}
      </div>
    </ClientShell>
  );
}

/* ------------------------------------------------------------------ payments */

/** Statement: every payment with its invoice or receipt. */
export function ClientPaymentsPage() {
  const { home, isLoading } = useClientHome();
  const [query, setQuery] = useState('');

  if (isLoading || !home) return <WorkspaceLoader />;

  const q = query.trim().toLowerCase();
  const list = home.payments.filter(
    (p) =>
      q === '' ||
      formatKES(p.total).toLowerCase().includes(q) ||
      (p.method ?? '').toLowerCase().includes(q),
  );

  return (
    <ClientShell title="Receipts">
      <ClientSearch value={query} onChange={setQuery} placeholder="Search receipts…" />

      <section className="mt-4 rounded-lg border border-white/15 bg-black/55 p-4 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-white">My payments</h2>
          <span className="text-[12px] text-white/70">{home.payments.length}</span>
        </div>

        {list.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-white/70">
            {home.payments.length === 0 ? 'No payments yet.' : `No receipt matches “${query.trim()}”.`}
          </p>
        ) : (
          <ul className="space-y-1">
            {list.map((p) => (
              <PaymentRow key={p.id} payment={p} />
            ))}
          </ul>
        )}
      </section>
    </ClientShell>
  );
}

/* ------------------------------------------------------------------- contact */

/** Support: call, WhatsApp or email the provider. */
export function ClientContactPage() {
  const { home, isLoading } = useClientHome();

  if (isLoading || !home) return <WorkspaceLoader />;

  const digits = (home.business.phone ?? '').replace(/\D/g, '').replace(/^0/, '254');

  const channels = [
    home.business.phone && {
      icon: Phone,
      label: 'Call us',
      hint: home.business.phone,
      onClick: () => window.location.assign(`tel:${home.business.phone}`),
    },
    home.business.phone && {
      icon: MessageCircle,
      label: 'WhatsApp',
      hint: home.business.phone,
      onClick: () => window.open(`https://wa.me/${digits}`, '_blank'),
    },
    home.business.email && {
      icon: Mail,
      label: 'Email',
      hint: home.business.email,
      onClick: () => window.location.assign(`mailto:${home.business.email}`),
    },
  ].filter(Boolean) as { icon: typeof Phone; label: string; hint: string; onClick: () => void }[];

  return (
    <ClientShell title="Support">
      <section className="rounded-lg border border-white/15 bg-black/55 p-4 backdrop-blur-md">
        <h2 className="text-[15px] font-semibold text-white">{home.business.name}</h2>
        <p className="mt-0.5 text-[12px] text-white/75">
          Our support team is here to help with your WiFi.
        </p>

        <div className="mt-3 space-y-2.5">
          {channels.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-white/70">
              No contact details have been shared yet.
            </p>
          ) : (
            channels.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={c.onClick}
                className="flex w-full items-center gap-3 rounded-lg bg-white/10 p-3 text-left transition-transform active:scale-[0.99]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
                  <c.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-white">{c.label}</span>
                  <span className="block truncate text-[12px] text-white/70">{c.hint}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </section>
    </ClientShell>
  );
}
