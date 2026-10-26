import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ReceiptText } from 'lucide-react';
import { salesApi } from '@/api/endpoints';
import type { Sale } from '@/api/types';
import { formatKES } from '@/lib/utils';
import { DashSection } from './dash-section';

const PREVIEW = 4;

/**
 * Subscribers with unpaid or part-paid invoices, most owed first. Tapping one
 * opens their details, where each invoice has a "Prompt" to pay.
 */
export function UnpaidInvoicesSection() {
  const [expanded, setExpanded] = useState(false);
  const unpaid = useQuery({ queryKey: ['sales', 'dash-unpaid', 'UNPAID'], queryFn: () => salesApi.list({ paymentStatus: 'UNPAID', limit: 100 }) });
  const partial = useQuery({ queryKey: ['sales', 'dash-unpaid', 'PARTIAL'], queryFn: () => salesApi.list({ paymentStatus: 'PARTIAL', limit: 100 }) });

  const debtors = useMemo(() => {
    const byClient = new Map<string, { id: string; name: string; count: number; due: number }>();
    const sales: Sale[] = [...(unpaid.data?.items ?? []), ...(partial.data?.items ?? [])];
    for (const s of sales) {
      if (!s.customerId || s.sale_type === 'ADVANCE') continue;
      const due = Math.max(0, s.total - (s.amount_paid ?? 0) - (s.advance_credit ?? 0));
      if (due <= 0) continue;
      const row = byClient.get(s.customerId) ?? { id: s.customerId, name: s.customer_name ?? 'Client', count: 0, due: 0 };
      row.count += 1;
      row.due += due;
      byClient.set(s.customerId, row);
    }
    return [...byClient.values()].sort((a, b) => b.due - a.due);
  }, [unpaid.data, partial.data]);

  if (!debtors.length) return null;
  const total = debtors.reduce((s, d) => s + d.due, 0);

  return (
    <DashSection
      title="Unpaid invoices"
      subtitle={`${debtors.length} subscriber${debtors.length === 1 ? '' : 's'} · ${formatKES(total)} due`}
      action={debtors.length > PREVIEW ? { label: expanded ? 'Show less' : `See all (${debtors.length})`, onClick: () => setExpanded((v) => !v) } : undefined}
    >
      <ul className="space-y-1">
        {(expanded ? debtors : debtors.slice(0, PREVIEW)).map((d) => (
          <li key={d.id}>
            <Link
              to={`/customers/${d.id}`}
              className="-mx-1 flex items-center gap-3 rounded-xl px-1 py-2.5 transition-[transform,background-color] active:scale-[0.99] active:bg-surface-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 [.dark_&]:bg-red-500/15 [.dark_&]:text-red-400">
                <ReceiptText className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-foreground">{d.name}</span>
                <span className="block truncate text-[12px] text-foreground-4">
                  {d.count} unpaid invoice{d.count === 1 ? '' : 's'} · tap to prompt
                </span>
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-danger">{formatKES(d.due)}</span>
              <ChevronRight className="h-4 w-4 text-foreground-5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </DashSection>
  );
}
