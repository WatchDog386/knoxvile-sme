import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Clock, Search, UserCog, Wifi, X } from 'lucide-react';
import { subscriptionsApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { SubscriberRow, SubscriptionStatus, UserRole } from '@/api/types';
import { Dialog } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/ui/spinner';
import { cn, formatKES } from '@/lib/utils';
import { useActiveBusiness } from '@/stores/business';
import { useRole } from '@/hooks/use-role';
import { CHARCOAL, FiberHeroCard, LIME, ProfileHeader, RoundFilters } from '@/components/brand/fiber-card';
import { SubscriberForm } from './subscriber-form';
import { SubscriberRegister } from './subscriber-register';
import { ContactButtons, LogCallSheet, SendSmsSheet } from './contact';
import { StatusPill, daysText } from './subscription';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { DesktopSubscribersPage } from './desktop-subscribers-page';

type Filter = SubscriptionStatus | 'ALL' | 'INCOMPLETE';

const ROLE_LABEL: Record<UserRole, string> = {
  OWNER: 'Admin',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Accountant',
  EMPLOYEE: 'Employee',
  CLIENT: 'Client',
};

const RING: Record<SubscriptionStatus, string> = {
  ACTIVE: 'bg-emerald-500',
  EXPIRING: 'bg-amber-500',
  EXPIRED: 'bg-red-500',
};

/** Amber pill for a subscriber whose phone or package is still missing. */
function IncompletePill() {
  return <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Incomplete</span>;
}

function missingText(row: SubscriberRow | undefined): string {
  return row?.missing.length ? `No ${row.missing.join(', no ')} yet` : '';
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

/** Every client's WiFi package, soonest expiry first. Same layout as the Clients page; renew from the client's page. */
/** Desktop gets its own table view; phones keep the card layout. Separate components so each keeps its own hooks. */
export function SubscribersPage() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopSubscribersPage /> : <SubscribersMobilePage />;
}

function SubscribersMobilePage() {
  const navigate = useNavigate();
  const business = useActiveBusiness();
  const { role } = useRole();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [logFor, setLogFor] = useState<{ id: string; name: string } | null>(null);
  const [smsFor, setSmsFor] = useState<{ id: string; name: string; phone: string | null } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // Desktop register's Edit opens the same sheet for that subscriber
  const [editId, setEditId] = useState<string | null>(null);
  const closeSheet = () => {
    setAddOpen(false);
    setEditId(null);
  };
  const { data, isLoading, error } = useQuery({ queryKey: ['subscriptions'], queryFn: () => subscriptionsApi.list() });
  // The register knows who is missing a phone or package (e.g. added from a paybill payment)
  const register = useQuery({ queryKey: ['subscribers'], queryFn: () => subscriptionsApi.register() });
  const incomplete = new Map((register.data ?? []).filter((r) => r.status === 'INCOMPLETE').map((r) => [r.id, r]));
  // No package yet, so they have no subscription row: listed on their own
  const noPackage = [...incomplete.values()].filter((r) => r.missing.includes('package'));

  const all = data ?? [];
  const counts = {
    ALL: all.length + noPackage.length,
    ACTIVE: all.filter((s) => s.status === 'ACTIVE' && !incomplete.has(s.customerId)).length,
    EXPIRING: all.filter((s) => s.status === 'EXPIRING').length,
    EXPIRED: all.filter((s) => s.status === 'EXPIRED').length,
    INCOMPLETE: incomplete.size,
  };
  const monthly = all.filter((s) => s.status !== 'EXPIRED').reduce((sum, s) => sum + s.price, 0);
  const term = search.trim().toLowerCase();
  const visible = all.filter(
    (s) =>
      (filter === 'ALL' ||
        (filter === 'INCOMPLETE' ? incomplete.has(s.customerId) : s.status === filter && !(filter === 'ACTIVE' && incomplete.has(s.customerId)))) &&
      (!term || s.customer?.name.toLowerCase().includes(term) || s.packageName.toLowerCase().includes(term)),
  );
  const visibleNoPackage =
    filter === 'ALL' || filter === 'INCOMPLETE'
      ? noPackage.filter((r) => !term || r.name.toLowerCase().includes(term) || (r.accountNumber ?? '').toLowerCase().includes(term))
      : [];
  // Faces row: clients to chase first (expiring, then expired)
  const dueSoon = all.filter((s) => s.status !== 'ACTIVE').sort((a, b) => b.daysLeft - a.daysLeft);

  return (
    <div className="space-y-5 pb-10">
      {/* Desktop: the full register table */}
      <div className="hidden lg:block">
        <SubscriberRegister onAdd={() => setAddOpen(true)} onEdit={setEditId} />
      </div>

      {/* Phones: unchanged card layout */}
      <div className="space-y-5 lg:hidden">
      <ProfileHeader roleLabel={role ? ROLE_LABEL[role] : undefined} showBackButton />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
        <FiberHeroCard
          label="Subscribers"
          value={data ? counts.ALL : '—'}
          note={`${counts.ACTIVE} active`}
          maskedValue={counts.ALL}
          footerLeft={business?.name ?? 'Knoxville'}
          footerRight={`${formatKES(monthly)}/mo`}
          icon={Wifi}
          action={{ label: 'Add subscriber', onClick: () => setAddOpen(true) }}
        />
      </motion.div>

      <RoundFilters<Filter>
        value={filter}
        onChange={setFilter}
        items={[
          { id: 'ALL', label: 'Everyone', icon: Wifi, count: counts.ALL, iconClass: 'text-brand-600', hoverClass: 'hover:bg-brand-50', selectedClass: 'bg-brand-50 border-brand-500' },
          { id: 'ACTIVE', label: 'Active', icon: CheckCircle2, count: counts.ACTIVE, iconClass: 'text-emerald-600', hoverClass: 'hover:bg-emerald-50', selectedClass: 'bg-emerald-50 border-emerald-500' },
          { id: 'EXPIRING', label: 'Expiring', icon: Clock, count: counts.EXPIRING, iconClass: 'text-amber-500', hoverClass: 'hover:bg-amber-50', selectedClass: 'bg-amber-50 border-amber-500' },
          { id: 'EXPIRED', label: 'Expired', icon: AlertCircle, count: counts.EXPIRED, iconClass: 'text-red-600', hoverClass: 'hover:bg-red-50', selectedClass: 'bg-red-50 border-red-500' },
          { id: 'INCOMPLETE', label: 'Incomplete', icon: UserCog, count: counts.INCOMPLETE, iconClass: 'text-amber-600', hoverClass: 'hover:bg-amber-50', selectedClass: 'bg-amber-50 border-amber-500' },
        ]}
      />

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-5" aria-hidden />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client or package" className="h-12 pl-11" />
      </div>

      {error && (
        <Alert variant="error" title="Could not load subscribers" inline>
          {apiErrorMessage(error)}
        </Alert>
      )}
      {isLoading && <PageLoader inline message="Loading" />}

      {/* Renew soon: tap a face to open that client */}
      {!isLoading && !term && filter === 'ALL' && dueSoon.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Renew soon</h2>
            <span className="text-[12px] font-medium text-foreground-4">{dueSoon.length} clients</span>
          </div>
          <div className="scrollbar-none -mx-1 flex gap-4 overflow-x-auto px-1">
            {dueSoon.slice(0, 12).map((s, i) => (
              <motion.button
                key={s.id}
                type="button"
                onClick={() => navigate(`/customers/${s.customerId}`)}
                className="flex w-14 shrink-0 flex-col items-center gap-1.5"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.04 * i, type: 'spring', stiffness: 400, damping: 26 }}
                whileTap={{ scale: 0.9 }}
              >
                <span
                  className="relative flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-semibold"
                  style={{ backgroundColor: CHARCOAL, color: LIME }}
                >
                  {initials(s.customer?.name ?? '?')}
                  <span className={cn('absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white', RING[s.status])} aria-hidden />
                </span>
                <span className="w-full truncate text-center text-[11px] font-medium text-foreground-2">
                  {(s.customer?.name ?? 'Client').split(' ')[0]}
                </span>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {data && visible.length === 0 && visibleNoPackage.length === 0 && (
        <div className="flex flex-col items-center py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: CHARCOAL, color: LIME }}>
            <Wifi className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-foreground">
            {term || filter !== 'ALL' ? 'No subscribers found' : 'No subscribers yet'}
          </p>
          <p className="mt-1 text-[13px] text-foreground-4">
            {term || filter !== 'ALL' ? 'Try a different search or filter.' : 'Add a subscriber or sell a WiFi package to start one.'}
          </p>
        </div>
      )}

      {data && (visible.length > 0 || visibleNoPackage.length > 0) && (
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Subscribers</h2>
            <span className="text-[12px] font-medium text-foreground-4">{visible.length + visibleNoPackage.length}</span>
          </div>
          <ul className="stagger-list space-y-1">
            {/* Added with just an account number and name: open them to add the phone and package */}
            {visibleNoPackage.map((r) => (
              <li key={`incomplete-${r.id}`} className="py-1">
                <div className="flex items-center gap-3">
                  <Link
                    to={`/customers/${r.id}`}
                    className="-mx-1 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1.5 transition-[transform,background-color] active:scale-[0.99] active:bg-surface-3"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
                      style={{ backgroundColor: CHARCOAL, color: LIME }}
                    >
                      {initials(r.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-foreground">{r.name}</span>
                      <span className="block truncate text-[12px] text-foreground-4">{r.accountNumber ?? 'No account number'}</span>
                      <span className="block text-[11px] font-medium text-amber-600">{missingText(r)}</span>
                    </span>
                  </Link>
                  <span className="shrink-0">
                    <IncompletePill />
                  </span>
                </div>
              </li>
            ))}
            {visible.map((s) => (
              <li key={s.id} className="py-1">
                <div className="flex items-center gap-3">
                  <Link
                    to={`/customers/${s.customerId}`}
                    className="-mx-1 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1.5 transition-[transform,background-color] active:scale-[0.99] active:bg-surface-3"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
                      style={{ backgroundColor: CHARCOAL, color: LIME }}
                    >
                      {initials(s.customer?.name ?? '?')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-foreground">{s.customer?.name ?? 'Client'}</span>
                      <span className="block truncate text-[12px] text-foreground-4">
                        {s.packageName} · {formatKES(s.price)}/mo
                      </span>
                      <span
                        className={cn(
                          'block text-[11px] font-medium',
                          s.status === 'EXPIRED' ? 'text-red-600' : s.status === 'EXPIRING' ? 'text-amber-600' : 'text-foreground-4',
                        )}
                      >
                        {daysText(s.daysLeft)}
                        {incomplete.has(s.customerId) && <span className="text-amber-600"> · {missingText(incomplete.get(s.customerId))}</span>}
                      </span>
                    </span>
                  </Link>
                  <span className="shrink-0">
                    {incomplete.has(s.customerId) ? <IncompletePill /> : <StatusPill status={s.status} />}
                  </span>
                </div>
                {s.status !== 'ACTIVE' && (
                  <div className="mt-1.5 pl-14">
                    <ContactButtons
                      size="sm"
                      phone={s.customer?.phone}
                      message={`Hello ${s.customer?.name ?? ''}, this is Knoxville. Your ${s.packageName} ${s.status === 'EXPIRED' ? 'has expired' : 'expires soon'}. Renew via M-Pesa to stay connected.`}
                      onMessage={() =>
                        s.customer && setSmsFor({ id: s.customer.id, name: s.customer.name, phone: s.customer.phone })
                      }
                      onLog={() => s.customer && setLogFor({ id: s.customer.id, name: s.customer.name })}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      </div>

      {/* Add subscriber: same panel style as "Add client" and "Add staff" */}
      <Dialog open={addOpen || Boolean(editId)} onOpenChange={(o) => !o && closeSheet()}>
        <div className="relative">
          <button
            type="button"
            onClick={closeSheet}
            className="absolute -right-1 -top-1 flex h-9 items-center gap-1.5 rounded-full pl-1.5 pr-3.5 text-[12px] font-semibold"
            style={{ backgroundColor: LIME, color: CHARCOAL }}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ backgroundColor: CHARCOAL }}>
              <X className="h-3.5 w-3.5" aria-hidden />
            </span>
            Close
          </button>
          <div className="flex flex-col items-center pb-5 pt-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: CHARCOAL, color: LIME }}>
              <Wifi className="h-7 w-7" aria-hidden />
            </span>
            <h2 className="mt-3 text-[20px] font-semibold tracking-tight text-foreground">{editId ? 'Edit subscriber' : 'Add subscriber'}</h2>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-4">{editId ? 'Update account details' : 'Connect a client to WiFi'}</p>
          </div>
          {(addOpen || editId) && <SubscriberForm key={editId ?? 'new'} customerId={editId ?? undefined} onDone={closeSheet} onCancel={closeSheet} />}
        </div>
      </Dialog>

      {logFor && (
        <LogCallSheet open={Boolean(logFor)} onOpenChange={(o) => !o && setLogFor(null)} customerId={logFor.id} customerName={logFor.name} />
      )}
      {smsFor && (
        <SendSmsSheet
          open
          onOpenChange={(o) => !o && setSmsFor(null)}
          customerId={smsFor.id}
          customerName={smsFor.name}
          phone={smsFor.phone}
          defaultMessage={`Hello ${smsFor.name}, this is Knoxville. Your monthly subscription is due for renewal. Pay via M-Pesa to stay connected. Thank you.`}
        />
      )}
    </div>
  );
}
