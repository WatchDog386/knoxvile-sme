import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Banknote, Search, Star, UserPlus, Users, Wallet, X } from 'lucide-react';
import { customersApi, dashboardApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { UserRole } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import { cn, formatKES } from '@/lib/utils';
import { PageLoader } from '@/components/ui/spinner';
import { useActiveBusiness } from '@/stores/business';
import { useRole } from '@/hooks/use-role';
import { CHARCOAL, FiberHeroCard, LIME, ProfileHeader, RoundFilters } from '@/components/brand/fiber-card';
import { CustomerForm } from './customer-form';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { DesktopCustomersPage } from './desktop-customers-page';

const PAGE_SIZE = 20;

type Filter = 'all' | 'debtors' | 'creditors' | 'loyal';

const ROLE_LABEL: Record<UserRole, string> = {
  OWNER: 'Admin',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Accountant',
  EMPLOYEE: 'Employee',
  CLIENT: 'Client',
};

const avatarTints = [
  'bg-blue-600',
  'bg-emerald-600',
  'bg-amber-500',
  'bg-violet-600',
  'bg-rose-500',
  'bg-cyan-700',
  'bg-sky-600',
  'bg-orange-500',
] as const;

function tintFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarTints[Math.abs(hash) % avatarTints.length];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}]+/u, ''))
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Desktop gets its own table view; phones keep the card layout. Separate components so each keeps its own hooks. */
export function CustomersPage() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopCustomersPage /> : <CustomersMobilePage />;
}

function CustomersMobilePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const business = useActiveBusiness();
  const { role } = useRole();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (searchParams.get('new') === '1') setFormOpen(true);
  }, [searchParams]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['customers', { page, search: debouncedSearch }],
    queryFn: () => customersApi.list({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined }),
  });
  // Business-wide figures for the card (shared with the dashboard's cache)
  const dashboard = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const items = data?.items ?? [];
  const counts = {
    all: items.length,
    debtors: items.filter((c) => c.outstanding_balance > 0).length,
    creditors: items.filter((c) => c.outstanding_balance < 0).length,
    loyal: items.filter((c) => c.visit_count > 5).length,
  };
  const filteredItems = items.filter((c) => {
    if (filter === 'debtors') return c.outstanding_balance > 0;
    if (filter === 'creditors') return c.outstanding_balance < 0;
    if (filter === 'loyal') return c.visit_count > 5;
    return true;
  });

  const onWifi = dashboard.data?.subscribers?.active ?? 0;
  const owed = dashboard.data?.outstandingDebts ?? 0;

  return (
    <div className="space-y-5 pb-10">
      <ProfileHeader roleLabel={role ? ROLE_LABEL[role] : undefined} />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
        <FiberHeroCard
          label="Clients"
          value={data?.total ?? '—'}
          note={`${onWifi} on WiFi`}
          maskedValue={data?.total ?? 0}
          footerLeft={business?.name ?? 'Knoxville'}
          footerRight={owed > 0 ? `Owed ${formatKES(owed)}` : 'No balances owed'}
          icon={Users}
          action={{ label: 'Add client', onClick: () => setFormOpen(true) }}
        />
      </motion.div>

      <RoundFilters<Filter>
        value={filter}
        onChange={setFilter}
        items={[
          { id: 'all', label: 'Everyone', icon: Users, count: counts.all, iconClass: 'text-brand-600', hoverClass: 'hover:bg-brand-50', selectedClass: 'bg-brand-50 border-brand-500' },
          { id: 'debtors', label: 'Debtors', icon: Wallet, count: counts.debtors, iconClass: 'text-red-600', hoverClass: 'hover:bg-red-50', selectedClass: 'bg-red-50 border-red-500' },
          { id: 'creditors', label: 'Creditors', icon: Banknote, count: counts.creditors, iconClass: 'text-emerald-600', hoverClass: 'hover:bg-emerald-50', selectedClass: 'bg-emerald-50 border-emerald-500' },
          { id: 'loyal', label: 'Loyal', icon: Star, count: counts.loyal, iconClass: 'text-amber-500', hoverClass: 'hover:bg-amber-50', selectedClass: 'bg-amber-50 border-amber-500' },
        ]}
      />

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-5" aria-hidden />
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            window.setTimeout(() => setDebouncedSearch(event.target.value), 300);
          }}
          placeholder="Search by name, phone or email"
          className="h-12 pl-11"
        />
      </div>

      {error && (
        <Alert variant="error" title="Could not load customers" inline>
          {apiErrorMessage(error)}
        </Alert>
      )}

      {isLoading && <PageLoader inline message="Loading" />}

      {/* Quick contact: tap a face to open that client */}
      {!isLoading && !debouncedSearch && filter === 'all' && items.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Quick contact</h2>
            <span className="text-[12px] font-medium text-foreground-4">{items.length} clients</span>
          </div>
          <div className="scrollbar-none -mx-1 flex gap-4 overflow-x-auto px-1">
            {items.slice(0, 12).map((c, i) => (
              <motion.button
                key={c.id}
                type="button"
                onClick={() => navigate(`/customers/${c.id}`)}
                className="flex w-14 shrink-0 flex-col items-center gap-1.5"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.04 * i, type: 'spring', stiffness: 400, damping: 26 }}
                whileTap={{ scale: 0.9 }}
              >
                <span className={cn('relative flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-semibold text-white', tintFor(c.name))}>
                  {initials(c.name)}
                  {c.outstanding_balance > 0 && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" aria-label="Owes money" />
                  )}
                </span>
                <span className="w-full truncate text-center text-[11px] font-medium text-foreground-2">{c.name.split(' ')[0]}</span>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {data && filteredItems.length === 0 && (
        <div className="flex flex-col items-center py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: CHARCOAL, color: LIME }}>
            <Users className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-foreground">
            {debouncedSearch || filter !== 'all' ? 'No clients found' : 'No clients yet'}
          </p>
          <p className="mt-1 text-[13px] text-foreground-4">
            {debouncedSearch || filter !== 'all' ? 'Try a different search or filter.' : 'Add your first client to start tracking their WiFi and payments.'}
          </p>
        </div>
      )}

      {data && filteredItems.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Clients</h2>
            <span className="text-[12px] font-medium text-foreground-4">{filteredItems.length}</span>
          </div>
          <ul className="stagger-list space-y-1">
            {filteredItems.map((customer) => {
              const tier = customer.visit_count > 5 ? 'Loyal' : customer.visit_count > 2 ? 'Regular' : 'New';
              return (
                <li key={customer.id}>
                  <Link to={`/customers/${customer.id}`} className="-mx-1 flex items-center gap-3 rounded-xl px-1 py-2.5 transition-[transform,background-color] active:scale-[0.99] active:bg-surface-3">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
                      style={{ backgroundColor: CHARCOAL, color: LIME }}
                    >
                      {initials(customer.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-foreground">{customer.name}</span>
                      <span className="block truncate text-[12px] text-foreground-4">
                        {customer.phone ?? 'No phone'} · {customer.visit_count} visit{customer.visit_count === 1 ? '' : 's'}
                      </span>
                    </span>
                    {customer.outstanding_balance !== 0 ? (
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                          customer.outstanding_balance > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700',
                        )}
                      >
                        {customer.outstanding_balance > 0
                          ? `Owes ${formatKES(customer.outstanding_balance)}`
                          : `Credit ${formatKES(Math.abs(customer.outstanding_balance))}`}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11px] font-semibold text-foreground-4">{tier}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          {data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-1 py-3">
              <p className="text-xs text-foreground-5">
                Page {page} of {totalPages} · {data.total} clients
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Add client: same panel style as "Add staff" */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="absolute -right-1 -top-1 flex h-9 items-center gap-1.5 rounded-full pl-1.5 pr-3.5 text-[12px] font-semibold"
            style={{ backgroundColor: LIME, color: CHARCOAL }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ backgroundColor: CHARCOAL }}>
              <X className="h-3.5 w-3.5" aria-hidden />
            </span>
            Close
          </button>
          <div className="flex flex-col items-center pb-5 pt-4 text-center">
            <motion.span
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: CHARCOAL, color: LIME }}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            >
              <UserPlus className="h-7 w-7" aria-hidden />
            </motion.span>
            <h2 className="mt-3 text-[20px] font-semibold tracking-tight text-foreground">Add client</h2>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-4">New WiFi customer</p>
          </div>
          <CustomerForm onClose={() => setFormOpen(false)} sheetStyle />
        </div>
      </Dialog>
    </div>
  );
}
