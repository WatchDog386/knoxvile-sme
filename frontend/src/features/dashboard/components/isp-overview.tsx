import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PhoneCall } from 'lucide-react';
import type { DashboardData } from '@/api/types';
import { cn } from '@/lib/utils';
import { DashSection } from './dash-section';

/** Subscriber health at a glance, plus today's call list. */
export function IspOverview({ data }: { data: DashboardData }) {
  const subs = data.subscribers ?? { active: 0, expiringSoon: 0, expired: 0 };
  const tiles = [
    // Pastel tiles in light mode; charcoal tiles with coloured numbers in dark mode
    { label: 'Active', value: subs.active, bg: 'bg-emerald-50 [.dark_&]:bg-surface', text: 'text-emerald-700 [.dark_&]:text-emerald-400' },
    { label: 'Expiring', value: subs.expiringSoon, bg: 'bg-amber-50 [.dark_&]:bg-surface', text: 'text-amber-700 [.dark_&]:text-amber-400' },
    { label: 'Expired', value: subs.expired, bg: 'bg-red-50 [.dark_&]:bg-surface', text: 'text-red-700 [.dark_&]:text-red-400' },
  ];
  const callsDue = data.callsDue ?? 0;

  return (
    <DashSection title="Subscribers" action={{ label: 'See all', to: '/subscribers', pill: true }}>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t, i) => (
          <motion.div key={t.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
            <Link to="/subscribers" className={cn('block rounded-2xl p-3 active:scale-95', t.bg)}>
              <p className={cn('text-[22px] font-semibold tabular-nums', t.text)}>{t.value}</p>
              <p className="text-[11px] font-medium text-foreground-3">{t.label}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      <Link to="/calls" className="-mx-1 mt-2 flex items-center gap-3 rounded-xl px-1 py-2.5 transition-[transform,background-color] active:scale-[0.99] active:bg-surface-3">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 [.dark_&]:bg-violet-500/20 [.dark_&]:text-violet-300">
          <PhoneCall className="h-5 w-5" aria-hidden />
          {callsDue > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white ring-2 ring-surface">
              {callsDue}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-foreground">Calls due today</span>
          <span className="block truncate text-[12px] text-foreground-4">
            {callsDue > 0 ? `${callsDue} client${callsDue === 1 ? '' : 's'}: renewals, call-backs and balances` : 'All caught up'}
          </span>
        </span>
      </Link>
    </DashSection>
  );
}
