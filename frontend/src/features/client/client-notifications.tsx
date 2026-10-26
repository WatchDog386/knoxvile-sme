import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Download, Loader2, PieChart, SearchX } from 'lucide-react';
import type { ClientHome } from '@/api/endpoints';
import { clientApi } from '@/api/endpoints';
import { WorkspaceLoader } from '@/components/ui/workspace-loader';
import { formatKES, formatTime, titleCase } from '@/lib/utils';
import { ClientShell, ClientSearch, useClientHome } from './client-pages';

type Payment = ClientHome['payments'][number];

/** Nairobi calendar day, so payments made late at night land on the right group. */
const DAY = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Africa/Nairobi',
});

/** "Today" / "Yesterday" / the date itself, for the group heading. */
function dayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = DAY.format(new Date());
  const yesterday = DAY.format(new Date(Date.now() - 86400000));
  const key = DAY.format(date);
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' }).format(date);
}

/** What each payment state is called on the alert list. */
function titleFor(payment: Payment): string {
  if (payment.status === 'PAID') return 'Payment received';
  if (payment.status === 'PARTIAL') return 'Part payment received';
  return 'Invoice issued';
}

/** The line under the title: what it was for, and how it was paid. */
function bodyFor(payment: Payment): string {
  const method = payment.method === 'M-PESA' ? 'M-Pesa' : titleCase(payment.method);
  return [
    `${formatKES(payment.total)}`,
    method,
    payment.number ? `No. ${payment.number}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function Icon({ status }: { status: string }) {
  if (status === 'PAID') {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-400/20">
        <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden />
      </span>
    );
  }
  if (status === 'PARTIAL') {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-400/20">
        <PieChart className="h-5 w-5 text-sky-300" aria-hidden />
      </span>
    );
  }
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-400/20">
      <Clock3 className="h-5 w-5 text-amber-300" aria-hidden />
    </span>
  );
}

/**
 * The subscriber's alerts: every transaction on their account, newest first,
 * grouped by the day it happened. Each alert opens its invoice or receipt.
 */
export function ClientNotificationsPage() {
  const { home, isLoading } = useClientHome();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (home?.payments ?? []).filter(
      (p) =>
        q === '' ||
        formatKES(p.total).toLowerCase().includes(q) ||
        p.method.toLowerCase().includes(q) ||
        (p.number ? String(p.number).includes(q) : false) ||
        titleFor(p).toLowerCase().includes(q),
    );
    const byDay = new Map<string, Payment[]>();
    for (const p of list) {
      const key = DAY.format(new Date(p.at));
      const bucket = byDay.get(key);
      if (bucket) bucket.push(p);
      else byDay.set(key, [p]);
    }
    return [...byDay.entries()].map(([day, payments]) => ({ day, label: dayLabel(day), payments }));
  }, [home?.payments, query]);

  if (isLoading || !home) return <WorkspaceLoader />;

  const open = async (payment: Payment) => {
    setBusy(payment.id);
    try {
      await clientApi.document(payment.id, payment.status === 'PAID' ? 'receipt' : 'invoice');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ClientShell title="Notifications">
      <ClientSearch value={query} onChange={setQuery} placeholder="Search transactions" />

      {groups.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <SearchX className="h-8 w-8 text-white/50" aria-hidden />
          <p className="text-[14px] text-white/75">
            {query.trim() ? `Nothing matches “${query.trim()}”.` : 'No transactions yet.'}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.day} className="mt-5">
            <h2 className="mb-1 px-1 pt-1 text-center text-[13px] font-semibold text-white/80">{group.label}</h2>
            <ul className="divide-y divide-white/10">
              {group.payments.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => open(p)}
                    disabled={busy === p.id}
                    className="flex w-full items-start gap-3 py-3 text-left transition-transform active:scale-[0.99] disabled:opacity-70"
                  >
                    <Icon status={p.status} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate text-[14px] font-semibold text-white">{titleFor(p)}</span>
                        <span className="shrink-0 text-[11px] font-medium text-[#8BC53F]">{formatTime(p.at)}</span>
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-white/70">{bodyFor(p)}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/55">
                        {busy === p.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        ) : (
                          <Download className="h-3 w-3" aria-hidden />
                        )}
                        {p.status === 'PAID' ? 'Tap for receipt' : 'Tap for invoice'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </ClientShell>
  );
}