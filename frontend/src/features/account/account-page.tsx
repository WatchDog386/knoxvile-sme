import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart,
  TrendingUp,
  Wallet,
  Users,
  CalendarRange,
  Receipt,
  PiggyBank,
  type LucideIcon,
} from 'lucide-react';
import { dashboardApi } from '@/api/endpoints';
import { PageLoader } from '@/components/ui/spinner';
import { Alert } from '@/components/ui/alert';
import { apiErrorMessage } from '@/api/client';
import { cn, formatKES } from '@/lib/utils';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { DesktopAccountPage } from './desktop-account-page';

/** Desktop gets the daily books with a balances panel; phones keep the summary tiles. */
export function AccountPage() {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DesktopAccountPage /> : <AccountMobilePage />;
}

function AccountMobilePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.get,
  });

  if (isLoading) {
    return <PageLoader inline message="Loading" />;
  }

  if (error || !data) {
    return (
      <Alert variant="error" title="Could not load your account" inline>
        {apiErrorMessage(error)}
      </Alert>
    );
  }

  const { today } = data;
  const isProfitable = today.netProfit >= 0;

  return (
    <div className="space-y-6 pb-2">
      {/* Balance summary */}
      <div className="relative overflow-hidden rounded-3xl border border-edge bg-surface p-5 shadow-lift sm:p-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground-4">
          Account summary
        </p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground-2">Ksh</span>
          <span className="text-3xl font-medium leading-none tracking-tight text-brand-600 tabular-nums sm:text-4xl">
            {today.sales.toLocaleString('en-KE')}
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          Total sales today ·{' '}
          <span
            className={cn(
              'font-semibold tabular-nums',
              isProfitable ? 'text-accent-text' : 'text-danger',
            )}
          >
            {formatKES(today.netProfit)} net profit
          </span>
        </p>
      </div>

      {/* Today's amounts */}
      <section>
        <h2 className="mb-3 text-[14px] font-medium tracking-tight text-foreground">
          Today&apos;s breakdown
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AmountTile
            label="Sales"
            value={formatKES(today.sales)}
            hint={`${today.salesCount} transactions`}
            icon={ShoppingCart}
            iconClass="bg-accent-soft text-accent"
          />
          <AmountTile
            label="Expenses"
            value={formatKES(today.expenses)}
            hint="Operating costs"
            icon={Wallet}
            iconClass="bg-warning-soft text-warning"
          />
          <AmountTile
            label="Gross profit"
            value={formatKES(today.grossProfit)}
            hint="Before expenses"
            icon={TrendingUp}
            iconClass="bg-info-soft text-info"
          />
          <AmountTile
            label="Net profit"
            value={formatKES(today.netProfit)}
            hint="After expenses"
            icon={PiggyBank}
            iconClass="bg-success-soft text-success"
            valueClass={isProfitable ? 'text-accent-text' : 'text-danger'}
          />
        </div>
      </section>

      {/* Wider balances */}
      <section>
        <h2 className="mb-3 text-[14px] font-medium tracking-tight text-foreground">
          Balances & totals
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AmountTile
            label="Debtors"
            value={formatKES(data.outstandingDebts)}
            hint="Outstanding balances"
            icon={Users}
            iconClass="bg-danger-soft text-danger"
          />
          <AmountTile
            label="Week revenue"
            value={formatKES(data.weekRevenue)}
            hint="Last 7 days"
            icon={CalendarRange}
            iconClass="bg-accent-soft text-accent-strong"
          />
          <AmountTile
            label="Month revenue"
            value={formatKES(data.monthRevenue)}
            hint="This month"
            icon={Receipt}
            iconClass="bg-warning-soft text-warning-strong"
          />
        </div>
      </section>
    </div>
  );
}

function AmountTile({
  label,
  value,
  hint,
  icon: Icon,
  iconClass,
  valueClass,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  iconClass: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-edge bg-surface p-3.5 shadow-soft sm:p-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-foreground-4">
            {label}
          </p>
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
              iconClass,
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
        <p
          className={cn(
            'mt-2 text-base font-medium leading-tight tracking-tight tabular-nums sm:text-lg',
            valueClass,
          )}
        >
          {value}
        </p>
      </div>
      <p className="mt-2 text-[10px] font-medium leading-snug text-foreground-4">{hint}</p>
    </div>
  );
}
