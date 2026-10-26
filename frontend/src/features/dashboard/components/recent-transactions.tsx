import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react';
import type { DashboardData } from '@/api/types';
import { cn, formatKES, formatTime } from '@/lib/utils';
import { DashSection } from './dash-section';

const filters = [
  { key: 'ALL', label: 'All' },
  { key: 'SALE', label: 'Sales' },
  { key: 'EXPENSE', label: 'Expenses' },
] as const;

// Rows shown before "See all"
const PREVIEW = 3;

type Filter = (typeof filters)[number]['key'];

/** Latest sales and expenses, money in green and money out in red. */
export function RecentTransactions({
  transactions,
}: {
  transactions: DashboardData['recentTransactions'];
}) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [expanded, setExpanded] = useState(false);
  const matching = filter === 'ALL' ? transactions : transactions.filter((t) => filter === 'SALE' ? t.type === 'SALE' || t.type === 'PAYMENT' : t.type === filter);
  const visible = expanded ? matching : matching.slice(0, PREVIEW);
  const hasMore = matching.length > PREVIEW;
  // Once expanded, "See all" leads to the full history for that filter
  const fullList = filter === 'EXPENSE' ? '/expenses' : '/sales';

  return (
    <DashSection
      title="Recent activity"
      action={
        hasMore && !expanded
          ? { label: `See all (${matching.length})`, onClick: () => setExpanded(true), pill: true }
          : expanded
            ? { label: 'Show less', onClick: () => setExpanded(false), pill: true }
            : { label: 'History', to: fullList, pill: true }
      }
    >
      {/* Filter bar in the loan strip's look: green panel with a slanted dark panel marking the active filter */}
      <div className="mb-3 grid h-12 grid-cols-3 overflow-hidden rounded-2xl bg-[linear-gradient(90deg,#1D6B46_0%,#135A3A_55%,#0B4A31_100%)] text-white">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'relative h-full text-[13px] font-medium transition-colors',
              filter === f.key ? 'text-white' : 'text-white/70',
            )}
          >
            {filter === f.key && (
              <motion.span
                layoutId="activity-filter"
                className="absolute inset-0 bg-[#063B26] shadow-[inset_14px_0_16px_-12px_rgba(0,0,0,0.7)]"
                style={{ clipPath: 'polygon(14% 0, 100% 0, 86% 100%, 0 100%)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{f.label}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-3 text-foreground-4">
            <Receipt className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 text-[13px] font-semibold text-foreground">Nothing here yet</p>
          <p className="text-[12px] text-foreground-4">New sales and expenses will show up here.</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.ul
            key={filter}
            className="space-y-1"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {visible.map((t) => {
              const isSale = t.type === 'SALE' || t.type === 'PAYMENT';
              const href = isSale ? (t.saleId ? `/sales/${t.saleId}` : '/sales') : '/expenses';
              return (
                <li key={`${t.type}-${t.id}`}>
                  <Link
                    to={href}
                    className="flex items-center gap-3 -mx-1 rounded-xl px-1 py-2.5 transition-[transform,background-color] active:scale-[0.99] active:bg-surface-3"
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                        isSale
                          ? 'bg-emerald-100 text-emerald-600 [.dark_&]:bg-emerald-500/15 [.dark_&]:text-emerald-400'
                          : 'bg-red-100 text-red-600 [.dark_&]:bg-red-500/15 [.dark_&]:text-red-400',
                      )}
                    >
                      {isSale ? <ArrowDownLeft className="h-5 w-5" aria-hidden /> : <ArrowUpRight className="h-5 w-5" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-foreground">
                        {t.type === 'PAYMENT' ? (t.customerName ?? 'Walk-in customer') : isSale ? (t.customerName ?? 'Walk-in customer') : t.description}
                      </span>
                      <span className="block truncate text-[12px] text-foreground-4">
                        {t.type === 'PAYMENT' ? `${t.description} · ${formatTime(t.createdAt)} · ${t.paymentMethod}` : `${formatTime(t.createdAt)} · ${t.paymentMethod}`}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 text-[13px] font-semibold tabular-nums',
                        isSale ? 'text-emerald-600 [.dark_&]:text-emerald-400' : 'text-red-600 [.dark_&]:text-red-400',
                      )}
                    >
                      {isSale ? '+' : '−'}
                      {formatKES(t.amount)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </motion.ul>
        </AnimatePresence>
      )}
      {expanded && (
        <Link
          to={fullList}
          className="mt-3 flex h-11 items-center justify-center rounded-full bg-surface-3 text-[13px] font-semibold text-foreground-2 active:scale-[0.99]"
        >
          Open full {filter === 'EXPENSE' ? 'expenses' : 'sales'} history
        </Link>
      )}
    </DashSection>
  );
}
