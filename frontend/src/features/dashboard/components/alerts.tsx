import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardCheck, PiggyBank } from 'lucide-react';
import type { DashboardData } from '@/api/types';
import { useRole } from '@/hooks/use-role';
import { cn } from '@/lib/utils';
import { DashSection } from './dash-section';

// Alerts shown before "See all"
const PREVIEW = 2;

type Alert = {
  icon: typeof PiggyBank;
  title: string;
  detail: string;
  tone: 'warning' | 'danger';
  link: string;
};

const toneClasses = {
  warning: { tile: 'bg-amber-100 text-amber-600 [.dark_&]:bg-amber-500/15 [.dark_&]:text-amber-400', dot: 'bg-amber-500' },
  danger: { tile: 'bg-red-100 text-red-600 [.dark_&]:bg-red-500/15 [.dark_&]:text-red-400', dot: 'bg-red-500' },
};

/** Spending alerts: budgets near or over their limit, and expenses awaiting approval. */
export function Alerts({ data }: { data: DashboardData }) {
  const { canApprove } = useRole();
  const [expanded, setExpanded] = useState(false);
  const alerts: Alert[] = [];

  if (canApprove && data.pendingApprovals > 0) {
    alerts.push({
      icon: ClipboardCheck,
      title: 'Expenses awaiting approval',
      detail: `${data.pendingApprovals} waiting for your review`,
      tone: 'warning',
      link: '/expenses?status=PENDING',
    });
  }

  for (const budget of data.budgetAlerts ?? []) {
    const over = budget.level === 'EXCEEDED';
    alerts.push({
      icon: PiggyBank,
      title: over ? `${budget.category_name} is over budget` : `${budget.category_name} is close to its limit`,
      detail: `${budget.percent}% of ${formatKes(budget.limit)} used this month`,
      tone: over ? 'danger' : 'warning',
      link: '/budgets',
    });
  }

  if (alerts.length === 0) return null;

  return (
    <DashSection
      title="Needs attention"
      subtitle={`${alerts.length} item${alerts.length === 1 ? '' : 's'} to check`}
      action={
        alerts.length > PREVIEW
          ? { label: expanded ? 'Show less' : `See all (${alerts.length})`, onClick: () => setExpanded((v) => !v) }
          : undefined
      }
    >
      <div className="space-y-1">
        {(expanded ? alerts : alerts.slice(0, PREVIEW)).map((alert, i) => (
          <motion.div
            key={alert.title}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.06 }}
          >
            <Link to={alert.link} className="flex items-center gap-3 -mx-1 rounded-xl px-1 py-2.5 transition-[transform,background-color] active:scale-[0.99] active:bg-surface-3">
              <span className={cn('relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', toneClasses[alert.tone].tile)}>
                <alert.icon className="h-5 w-5" aria-hidden />
                <span className={cn('absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface', toneClasses[alert.tone].dot)} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-foreground">{alert.title}</span>
                <span className="block truncate text-[12px] text-foreground-4">{alert.detail}</span>
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </DashSection>
  );
}

function formatKes(amount: number): string {
  return `KSh ${amount.toLocaleString('en-KE')}`;
}
