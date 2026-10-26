import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronRight, PhoneCall, ShieldCheck, ShoppingCart, Wallet } from 'lucide-react';
import { callsApi, dashboardApi, expensesApi } from '@/api/endpoints';
import { apiErrorMessage } from '@/api/client';
import { Alert } from '@/components/ui/alert';
import { WorkspaceLoader } from '@/components/ui/workspace-loader';
import { CARD_THEMES, FiberHeroCard } from '@/components/brand/fiber-card';
import {
  DuoCalls,
  DuoCustomers,
  DuoExpenses,
  DuoProducts,
  DuoSales,
  DuoScan,
  DuoServices,
  DuoSubscribers,
} from '@/components/brand/duo-icons';
import { Badge, statusLabel, statusVariant } from '@/components/ui/badge';
import { cn, formatDate, formatKES } from '@/lib/utils';
import { useActiveBusiness } from '@/stores/business';
import { useAuthStore } from '@/stores/auth';
import { DashboardHeader } from './components/dashboard-header';
import { QuickActions, type QuickAction } from './components/quick-actions';
import { IspOverview } from './components/isp-overview';
import { ScanSaleDialog } from './components/scan-sale-dialog';
import { DashSection } from './components/dash-section';

// Employees: selling, expenses and client follow-up (no reports or staff)
const EMPLOYEE_ACTIONS: QuickAction[] = [
  { to: '/sales/new', label: 'Record sale', icon: DuoSales },
  { to: '/expenses?new=1', label: 'Submit expense', icon: DuoExpenses },
  { to: '/subscribers', label: 'Subscribers', icon: DuoSubscribers },
  { to: '/calls', label: 'Calls', icon: DuoCalls },
  { to: '/customers', label: 'Customers', icon: DuoCustomers },
  { to: '/products', label: 'Packages', icon: DuoProducts },
  { to: '/services', label: 'Services', icon: DuoServices },
  { to: '/sales', label: 'Sales', icon: DuoSales },
];

const REASON: Record<string, string> = {
  FOLLOW_UP: 'Call-back',
  EXPIRING: 'Expiring',
  EXPIRED: 'Expired',
  BALANCE: 'Owes',
};

/**
 * Employee dashboard: the working day. Today's sales to record, clients to
 * call, subscribers to renew and the employee's own expense submissions.
 */
export function EmployeeDashboard() {
  const navigate = useNavigate();
  const business = useActiveBusiness();
  const user = useAuthStore((s) => s.user);
  const [scanOpen, setScanOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  const { data, error, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });
  const calls = useQuery({ queryKey: ['calls', 'due'], queryFn: callsApi.due });
  // Employees see their own submissions
  const myExpenses = useQuery({
    queryKey: ['expenses', { page: 1, limit: 5, mine: true }],
    queryFn: () => expensesApi.list({ page: 1, limit: 5 }),
  });

  useEffect(() => {
    document.body.classList.add('page-white', 'dash-glow-body');
    return () => document.body.classList.remove('page-white', 'dash-glow-body');
  }, []);

  if (isLoading) return <WorkspaceLoader />;
  if (error || !data) {
    return (
      <Alert variant="error" title="Could not load your dashboard" inline>
        {apiErrorMessage(error)}
      </Alert>
    );
  }

  const pending = (myExpenses.data?.items ?? []).filter((e) => e.status === 'PENDING').length;
  const callList = calls.data ?? [];
  const cards = [
    {
      key: 'sales',
      theme: CARD_THEMES.sales,
      label: 'Sales today',
      value: String(data.today.salesCount),
      note: data.today.salesCount === 1 ? 'sale' : 'sales',
      footerRight: data.packagesToday ? `${data.packagesToday.count} packages` : undefined,
      icon: ShoppingCart,
      action: { label: 'Record sale', onClick: () => navigate('/sales/new') },
    },
    {
      key: 'calls',
      theme: CARD_THEMES.packages,
      label: 'Clients to call',
      value: String(data.callsDue ?? callList.length),
      note: 'today',
      footerRight: data.subscribers ? `${data.subscribers.expiringSoon} expiring` : undefined,
      icon: PhoneCall,
      action: { label: 'Call list', onClick: () => navigate('/calls') },
    },
    {
      key: 'expenses',
      theme: CARD_THEMES.expenses,
      label: 'My expenses',
      value: String(pending),
      note: 'pending',
      footerRight: myExpenses.data ? `${myExpenses.data.total} submitted` : undefined,
      icon: Wallet,
      action: { label: 'Submit', onClick: () => navigate('/expenses?new=1') },
    },
  ];

  const rise = (order: number) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: order * 0.07, type: 'spring' as const, stiffness: 300, damping: 30 },
  });

  return (
    <div className="relative isolate space-y-6 pb-2">
      <div className="dash-glow pointer-events-none absolute -left-4 -right-4 top-0 -z-10 h-80" aria-hidden />
      <DashboardHeader />

      {/* Swipeable cards, like the admin dashboard */}
      <motion.div {...rise(1)}>
        <div
          className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4"
          onScroll={(e) => {
            const el = e.currentTarget;
            const firstCard = el.firstElementChild as HTMLElement | null;
            const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
            const step = (firstCard?.offsetWidth ?? el.clientWidth * 0.86) + gap;
            setSlide(Math.min(cards.length - 1, Math.round(el.scrollLeft / step)));
          }}
        >
          {cards.map((c) => (
            <div key={c.key} className="w-[86%] shrink-0 snap-center">
              <FiberHeroCard
                theme={c.theme}
                label={c.label}
                value={c.value}
                note={c.note}
                maskedValue={Number(c.value) || 0}
                footerLeft={user?.fullName ?? business?.name ?? 'Knoxville'}
                footerRight={c.footerRight}
                icon={c.icon}
                action={c.action}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-center gap-1.5">
          {cards.map((c, i) => (
            <span key={c.key} className={cn('h-1.5 rounded-full transition-all', i === slide ? 'w-6 bg-[#3A8F91]' : 'w-1.5 bg-foreground-5/40')} />
          ))}
        </div>
      </motion.div>

      <motion.div {...rise(2)}>
        <QuickActions items={EMPLOYEE_ACTIONS} viewAll={false} />
      </motion.div>

      <motion.div {...rise(3)}>
        <IspOverview data={data} />
      </motion.div>

      {/* Clients to call today */}
      <motion.div {...rise(4)}>
        <DashSection title="Clients to call" subtitle="Renewals, call-backs and balances" action={{ label: 'See all', to: '/calls' }}>
          {callList.length === 0 ? (
            <p className="px-1 text-[13px] text-foreground-4">No calls due today.</p>
          ) : (
            <ul className="space-y-1">
              {callList.slice(0, 5).map((c) => (
                <li key={c.customer.id}>
                  <Link to={`/customers/${c.customer.id}`} className="-mx-1 flex items-center gap-3 rounded-xl px-1 py-2.5 active:bg-surface-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E8F3F3] text-[#2F7F81] [.dark_&]:bg-white/10 [.dark_&]:text-[#7CC3C4]">
                      <PhoneCall className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-foreground">{c.customer.name}</span>
                      <span className="block truncate text-[12px] text-foreground-4">
                        {c.reasons.map((r) => REASON[r] ?? r).join(' · ')}
                        {c.subscription ? ` · ${c.subscription.packageName}` : ''}
                      </span>
                    </span>
                    {c.customer.outstandingBalance > 0 && (
                      <span className="shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                        {formatKES(c.customer.outstandingBalance)}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-foreground-5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashSection>
      </motion.div>

      {/* The employee's own expense submissions */}
      <motion.div {...rise(5)}>
        <DashSection title="My expenses" subtitle="What you submitted and its status" action={{ label: 'See all', to: '/expenses' }}>
          {(myExpenses.data?.items ?? []).length === 0 ? (
            <p className="px-1 text-[13px] text-foreground-4">You haven't submitted any expenses.</p>
          ) : (
            <ul className="space-y-1">
              {myExpenses.data!.items.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-1 py-2">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F7E3E6] text-[#9B2B3D] [.dark_&]:bg-[#9B2B3D]/20 [.dark_&]:text-[#F2B8C0]">
                    <Wallet className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-foreground">{e.description}</span>
                    <span className="block truncate text-[12px] text-foreground-4">
                      {formatDate(e.expense_date)} · {formatKES(e.amount)}
                    </span>
                  </span>
                  <Badge variant={statusVariant(e.status)}>{statusLabel(e.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </DashSection>
      </motion.div>

      <motion.div {...rise(6)} className="flex items-center justify-center gap-2 py-2 text-foreground-5">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
        <p className="text-[11px]">© {new Date().getFullYear()} Knoxville Technologies Ltd.</p>
      </motion.div>

      {createPortal(
        <motion.button
          type="button"
          onClick={() => setScanOpen(true)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileTap={{ scale: 0.96 }}
          className="fixed right-4 z-30 flex h-14 items-center gap-3 rounded-2xl bg-[#2F2F33] pl-4 pr-5 text-white shadow-[0_10px_24px_rgba(0,0,0,0.35)] lg:hidden"
          style={{ bottom: 'calc(1.25rem + 64px + 14px + var(--sab))' }}
          aria-label="Scan to record a sale"
        >
          <DuoScan className="h-7 w-7 text-brand-400" />
          <span className="text-[17px] font-medium tracking-wide">Scan to sell</span>
        </motion.button>,
        document.body,
      )}
      <ScanSaleDialog open={scanOpen} onOpenChange={setScanOpen} />
    </div>
  );
}
