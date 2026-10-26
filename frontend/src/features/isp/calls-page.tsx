import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, PhoneCall } from 'lucide-react';
import { callsApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import type { CallDue } from '@/api/types';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { PageLoader } from '@/components/ui/spinner';
import { cn, formatKES } from '@/lib/utils';
import { ContactButtons, LogCallSheet } from './contact';

const REASON: Record<CallDue['reasons'][number], { label: string; tone: string }> = {
  FOLLOW_UP: { label: 'Call-back due', tone: 'bg-violet-100 text-violet-700' },
  EXPIRED: { label: 'Package expired', tone: 'bg-red-100 text-red-700' },
  EXPIRING: { label: 'Expiring soon', tone: 'bg-amber-100 text-amber-700' },
  BALANCE: { label: 'Owes money', tone: 'bg-sky-100 text-sky-700' },
};

function message(item: CallDue): string {
  const name = item.customer.name;
  if (item.subscription?.status === 'EXPIRED') return `Hello ${name}, this is Knoxville. Your ${item.subscription.packageName} has expired. Renew via M-Pesa to get back online.`;
  if (item.subscription) return `Hello ${name}, this is Knoxville. Your ${item.subscription.packageName} expires soon. Renew via M-Pesa to stay connected.`;
  if (item.customer.outstandingBalance > 0) return `Hello ${name}, this is Knoxville. A friendly reminder of your balance of ${formatKES(item.customer.outstandingBalance)}.`;
  return `Hello ${name}, this is Knoxville.`;
}

/** Today's call list: scheduled call-backs, renewals due and balances owed. */
export function CallsPage() {
  const queryClient = useQueryClient();
  const [logFor, setLogFor] = useState<{ id: string; name: string } | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['calls', 'due'], queryFn: callsApi.due });
  const done = useMutation({
    mutationFn: (id: string) => callsApi.done(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['calls'] }),
  });

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title="Calls" description="Who to call today, and why" />

      {error && <Alert variant="error">{apiErrorMessage(error)}</Alert>}
      {isLoading && <PageLoader inline message="Loading" />}

      {!isLoading && data?.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Check className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-foreground">All caught up</p>
          <p className="text-[13px] text-foreground-4">No call-backs, renewals or balances to chase today.</p>
        </div>
      )}

      {!!data?.length && (
        <p className="px-1 text-[13px] font-medium text-foreground-3">
          {data.length} client{data.length === 1 ? '' : 's'} to call
        </p>
      )}

      <ul className="stagger-list divide-y divide-edge max-lg:divide-y-0">
        {data?.map((item) => (
          <li key={item.customer.id} className="px-1 py-3">
            <div className="flex items-start justify-between gap-3">
              <Link to={`/customers/${item.customer.id}`} className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-foreground">{item.customer.name}</p>
                <p className="truncate text-[12px] text-foreground-4">{item.customer.phone ?? 'No phone number'}</p>
              </Link>
              <div className="flex flex-wrap justify-end gap-1">
                {item.reasons.map((r) => (
                  <span key={r} className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', REASON[r].tone)}>
                    {REASON[r].label}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-2 space-y-0.5 text-[12px] text-foreground-3">
              {item.followUp?.notes && <p>“{item.followUp.notes}”</p>}
              {item.subscription && (
                <p>
                  {item.subscription.packageName} · {item.subscription.status === 'EXPIRED' ? 'ended' : 'ends'}{' '}
                  {new Date(item.subscription.expiresAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                </p>
              )}
              {item.customer.outstandingBalance > 0 && <p>Balance {formatKES(item.customer.outstandingBalance)}</p>}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <ContactButtons
                size="sm"
                phone={item.customer.phone}
                message={message(item)}
                onLog={() => setLogFor({ id: item.customer.id, name: item.customer.name })}
              />
              {item.followUp ? (
                <button
                  type="button"
                  onClick={() => done.mutate(item.followUp!.id)}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-surface px-4 text-[12px] font-semibold text-foreground-2 active:scale-95"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden />
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setLogFor({ id: item.customer.id, name: item.customer.name })}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[12px] font-semibold text-white active:scale-95"
                >
                  <PhoneCall className="h-3.5 w-3.5" aria-hidden />
                  Log call
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {logFor && (
        <LogCallSheet open={Boolean(logFor)} onOpenChange={(o) => !o && setLogFor(null)} customerId={logFor.id} customerName={logFor.name} />
      )}
    </div>
  );
}
