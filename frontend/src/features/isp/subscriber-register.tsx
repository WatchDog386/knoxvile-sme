import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Eye, Pencil, Search, Trash2, Wifi } from 'lucide-react';
import { customersApi, subscriptionsApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { SubscriberRow, SubscriberStatus } from '@/api/types';
import { Alert } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/ui/spinner';
import { cn, formatKES } from '@/lib/utils';
import { useRole } from '@/hooks/use-role';
import { CHARCOAL, LIME } from '@/components/brand/fiber-card';

type Filter = 'ALL' | SubscriberStatus | 'DUE3' | 'DUE7';

const SERVICE_LABEL = { HOTSPOT: 'Hotspot', PPPOE: 'PPPoE', STATIC: 'Static IP' } as const;

const STATUS: Record<SubscriberStatus, { label: string; pill: string }> = {
  ACTIVE: { label: 'Active', pill: 'bg-emerald-50 text-emerald-700 [.dark_&]:bg-emerald-500/15 [.dark_&]:text-emerald-300' },
  INACTIVE: { label: 'Inactive', pill: 'bg-red-50 text-red-700 [.dark_&]:bg-red-500/15 [.dark_&]:text-red-300' },
  INCOMPLETE: { label: 'Incomplete', pill: 'bg-amber-50 text-amber-700 [.dark_&]:bg-amber-500/15 [.dark_&]:text-amber-300' },
};

/** Stat tiles double as the filter, like the billing system's cards and tabs. */
const TILES: { id: Filter; label: string; note: string; dot: string }[] = [
  { id: 'ALL', label: 'Total', note: 'All subscribers', dot: 'bg-brand-600' },
  { id: 'ACTIVE', label: 'Active', note: 'Package running', dot: 'bg-emerald-500' },
  { id: 'INACTIVE', label: 'Inactive', note: 'Package ran out', dot: 'bg-red-500' },
  { id: 'INCOMPLETE', label: 'Incomplete', note: 'Phone or package missing', dot: 'bg-amber-500' },
  { id: 'DUE3', label: 'Due in 3 days', note: 'Renew soon', dot: 'bg-orange-500' },
  { id: 'DUE7', label: 'Due in 7 days', note: 'Renewal attention', dot: 'bg-sky-500' },
];

function matches(s: SubscriberRow, filter: Filter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'DUE3' || filter === 'DUE7') {
    return s.status === 'ACTIVE' && s.daysLeft !== null && s.daysLeft <= (filter === 'DUE3' ? 3 : 7);
  }
  return s.status === filter;
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

function StatusPill({ status }: { status: SubscriberStatus }) {
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold', STATUS[status].pill)}>{STATUS[status].label}</span>;
}

/** Desktop subscriber register (phones keep the card layout): every client with account, package, router, wallet and status. */
export function SubscriberRegister({ onAdd, onEdit }: { onAdd: () => void; onEdit: (id: string) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useRole();
  const canDelete = role === 'OWNER' || role === 'MANAGER';
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<SubscriberRow | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['subscribers'], queryFn: () => subscriptionsApi.register() });

  const remove = useMutation({
    mutationFn: (id: string) => customersApi.remove(id),
    onSuccess: async () => {
      setDeleting(null);
      await Promise.all(['subscribers', 'subscriptions', 'customers'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    },
  });

  const all = data ?? [];
  const count = (f: Filter) => all.filter((s) => matches(s, f)).length;
  const term = search.trim().toLowerCase();
  const visible = all.filter(
    (s) =>
      matches(s, filter) &&
      (!term ||
        [s.name, s.username, s.accountNumber, s.phone, s.location, s.packageName, s.router].some((v) => v?.toLowerCase().includes(term))),
  );

  const actions = (s: SubscriberRow) => (
    <div className="flex items-center gap-1.5">
      <ActionButton label="View" onClick={() => navigate(`/customers/${s.id}`)} icon={Eye} />
      <ActionButton label="Edit" onClick={() => onEdit(s.id)} icon={Pencil} />
      {canDelete && <ActionButton label="Delete" onClick={() => setDeleting(s)} icon={Trash2} danger />}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-brand-600">Subscriber CRM</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Subscribers</h1>
          <p className="mt-1 text-sm text-foreground-4">Account details, packages, renewals and balances for every client.</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-semibold"
          style={{ backgroundColor: LIME, color: CHARCOAL }}
        >
          <Wifi className="h-4 w-4" aria-hidden /> Add subscriber
        </button>
      </div>

      <div className="grid grid-cols-6 gap-3">
        {TILES.map((t) => {
          const selected = filter === t.id;
          return (
            <motion.button
              key={t.id}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilter(t.id)}
              aria-pressed={selected}
              className={cn(
                'rounded-2xl border p-3 text-left transition-colors',
                selected ? 'border-brand-500 bg-brand-50 [.dark_&]:bg-white/10' : 'border-edge bg-surface hover:bg-surface-2',
              )}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-4">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', t.dot)} aria-hidden />
                <span className="truncate">{t.label}</span>
              </span>
              <span className="mt-1 block text-[22px] font-semibold tabular-nums text-foreground">{data ? count(t.id) : '—'}</span>
              <span className="hidden truncate text-[11px] text-foreground-4 sm:block">{t.note}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-5" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, account, phone, location, package or router"
          className="h-12 pl-11"
        />
      </div>

      {error && (
        <Alert variant="error" title="Could not load subscribers" inline>
          {apiErrorMessage(error)}
        </Alert>
      )}
      {isLoading && <PageLoader inline message="Loading" />}

      {data && visible.length === 0 && (
        <div className="flex flex-col items-center py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: CHARCOAL, color: LIME }}>
            <Wifi className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-foreground">{term || filter !== 'ALL' ? 'No subscribers found' : 'No subscribers yet'}</p>
          <p className="mt-1 text-[13px] text-foreground-4">
            {term || filter !== 'ALL' ? 'Try a different search or filter.' : 'Click "Add subscriber" to record your first client.'}
          </p>
        </div>
      )}

      {data && visible.length > 0 && (
        <>
          <p className="px-1 text-[13px] font-medium text-foreground-3">
            {visible.length} matching subscriber{visible.length === 1 ? '' : 's'}
          </p>

          {/* Desktop: the full register table */}
          <div className="overflow-x-auto rounded-2xl border border-edge bg-surface">
            <table className="w-full min-w-[1100px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-edge text-[11px] font-semibold uppercase tracking-wider text-foreground-4">
                  {['Customer', 'Account', 'Phone', 'Location', 'Package', 'Service', 'Router / NAS', 'Due', 'Wallet', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-3 first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((s) => (
                  <tr key={s.id} className="border-b border-edge last:border-0 hover:bg-surface-2">
                    <td className="px-3 py-3 pl-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold" style={{ backgroundColor: CHARCOAL, color: LIME }}>
                          {initials(s.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block max-w-[180px] truncate font-semibold text-foreground">{s.name}</span>
                          {s.username && <span className="block text-[12px] text-foreground-4">@{s.username}</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{s.accountNumber ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums">{s.phone ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3">{s.location ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-medium text-foreground">{s.packageName ?? '—'}</td>
                    <td className="px-3 py-3">{s.serviceType ? SERVICE_LABEL[s.serviceType] : '—'}</td>
                    <td className="px-3 py-3">{s.router ?? '—'}</td>
                    <td className={cn('whitespace-nowrap px-3 py-3', s.status === 'INACTIVE' && 'text-red-600')}>
                      {s.expiresAt ? new Date(s.expiresAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums">{formatKES(s.wallet)}</td>
                    <td className="px-3 py-3">
                      <StatusPill status={s.status} />
                    </td>
                    <td className="px-3 py-3 pr-5">{actions(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? 'subscriber'}?`}
        description="Their package, calls and app login are deleted. Past sales stay in your records."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        error={remove.error ? apiErrorMessage(remove.error) : null}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />

    </div>
  );
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  danger,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold transition-transform active:scale-95',
        danger ? 'bg-red-50 text-red-700 [.dark_&]:bg-red-500/15 [.dark_&]:text-red-300' : 'bg-surface-3 text-foreground-2',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}
