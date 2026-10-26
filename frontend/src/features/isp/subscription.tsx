import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Receipt, RefreshCw, Wifi } from 'lucide-react';
import { callsApi, subscriptionsApi } from '@/api/endpoints';
import type { SubscriptionStatus } from '@/api/types';
import { cn, formatKES } from '@/lib/utils';
import { PackageHeroCard } from '@/components/brand/package-hero-card';
import { outcomeInfo } from './contact';

export const STATUS_STYLE: Record<SubscriptionStatus, { label: string; pill: string; onDark: string }> = {
  ACTIVE: { label: 'Active', pill: 'bg-emerald-100 text-emerald-700', onDark: 'bg-emerald-400/20 text-emerald-200' },
  EXPIRING: { label: 'Expiring soon', pill: 'bg-amber-100 text-amber-700', onDark: 'bg-amber-400/20 text-amber-200' },
  EXPIRED: { label: 'Expired', pill: 'bg-red-100 text-red-700', onDark: 'bg-red-400/20 text-red-200' },
};

export function StatusPill({ status, variant = 'light' }: { status: SubscriptionStatus; variant?: 'light' | 'dark' }) {
  const s = STATUS_STYLE[status];
  return <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold', variant === 'dark' ? s.onDark : s.pill)}>{s.label}</span>;
}

export function daysText(daysLeft: number): string {
  if (daysLeft > 1) return `${daysLeft} days left`;
  if (daysLeft === 1) return '1 day left';
  if (daysLeft === 0) return 'Expires today';
  return `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`;
}

/** A client's WiFi package with status and a one-tap renew. */
export function SubscriptionCard({ customerId, name }: { customerId: string; name?: string }) {
  const navigate = useNavigate();
  const { data: sub, isLoading } = useQuery({
    queryKey: ['subscription', customerId],
    queryFn: () => subscriptionsApi.forCustomer(customerId),
  });
  if (isLoading) return <div className="h-44 animate-pulse rounded-lg bg-surface-3" />;

  if (!sub) {
    return (
      <section className="flex items-center gap-3 px-1 py-2">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-foreground-4">
          <Wifi className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground">No WiFi package yet</p>
          <p className="text-[12px] text-foreground-4">Sell a package to connect this client.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/sales/new?customer=${customerId}`)}
          className="h-9 shrink-0 rounded-full bg-brand-600 px-4 text-[12px] font-semibold text-white active:scale-95"
        >
          Connect
        </button>
      </section>
    );
  }

  return (
    <PackageHeroCard
      label="WiFi package"
      name={name}
      headline={sub.packageName.replace(/\s*\d+\s*mbps\s*$/i, '')}
      sub={sub.speedMbps ? `${sub.speedMbps} Mbps` : 'Unlimited'}
      actions={[
        {
          label: 'Renew',
          icon: RefreshCw,
          onClick: () => navigate(`/sales/new?customer=${customerId}&product=${sub.productId}`),
        },
        { label: 'Sales', icon: Receipt, onClick: () => navigate(`/sales?customer=${customerId}`) },
      ]}
      footer={`${Math.max(0, sub.daysLeft)} days left · ${formatKES(sub.price)}/mo`}
      status={{
        label: STATUS_STYLE[sub.status].label,
        tone: sub.status === 'ACTIVE' ? 'ok' : sub.status === 'EXPIRING' ? 'warn' : 'bad',
      }}
    />
  );
}


/** Latest calls with a client, newest first. */
export function CallHistory({ customerId }: { customerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['calls', customerId],
    queryFn: () => callsApi.history(customerId),
  });
  if (isLoading) return <div className="h-20 animate-pulse rounded-2xl bg-surface-3" />;
  if (!data?.length) return <p className="px-1 text-[13px] text-foreground-4">No calls logged yet.</p>;
  return (
    <ul className="divide-y divide-edge max-lg:divide-y-0">
      {data.slice(0, 8).map((c) => {
        const info = outcomeInfo(c.outcome);
        return (
          <li key={c.id} className="px-1 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', info.tone)}>{info.label}</span>
              <span className="text-[11px] text-foreground-4">
                {new Date(c.calledAt).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {c.calledBy}
              </span>
            </div>
            {c.notes && <p className="mt-1.5 text-[13px] text-foreground-2">{c.notes}</p>}
            {c.followUpAt && !c.followUpDone && (
              <p className="mt-1 text-[12px] font-medium text-violet-600">
                Call back {new Date(c.followUpAt).toLocaleString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
