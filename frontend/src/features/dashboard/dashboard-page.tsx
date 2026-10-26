import { useEffect, useLayoutEffect } from 'react';
import { setTheme } from '@/lib/theme';
import { WorkspaceLoader } from '@/components/ui/workspace-loader';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { dashboardApi } from '@/api/endpoints';
import { Alert } from '@/components/ui/alert';
import { apiErrorMessage } from '@/api/client';
import { DashboardHeader } from './components/dashboard-header';
import { SummaryCards } from './components/summary-cards';
import { QuickActions } from './components/quick-actions';
import { Alerts } from './components/alerts';
import { RecentTransactions } from './components/recent-transactions';
import { IspOverview } from './components/isp-overview';
import { AdvertBanner } from '@/components/brand/advert-banner';
import { UnpaidInvoicesSection } from './components/unpaid-invoices-section';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { DesktopDashboard } from './desktop-dashboard';
import { useRole } from '@/hooks/use-role';
import { EmployeeDashboard } from './employee-dashboard';
import { ClientDashboard } from '@/features/client/client-dashboard';

/**
 * One dashboard per kind of user: admins (owner, manager, accountant) get the
 * full business view, employees their working day, clients their own WiFi.
 */
export function DashboardPage() {
  const { isClient, isEmployee } = useRole();
  if (isClient) return <ClientDashboard />;
  if (isEmployee) return <EmployeeDashboard />;
  return <AdminDashboard />;
}

/** Admin dashboard: the whole business. */
function AdminDashboard() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.get,
    refetchInterval: 5000,
  });
  const isDesktop = useIsDesktop();

  // The admin dashboard opens in dark mode by default.
  useLayoutEffect(() => {
    setTheme('dark');
  }, []);

  // Phone dashboard sits on pure white (light theme); other pages keep the soft grey
  useEffect(() => {
    if (isDesktop) return;
    document.body.classList.add('page-white', 'dash-glow-body');
    return () => document.body.classList.remove('page-white', 'dash-glow-body');
  }, [isDesktop]);

  // Same loader as "Loading your workspace" after sign-in, so nothing changes
  // on screen until the dashboard is ready.
  if (isLoading) return <WorkspaceLoader />;

  if (error || !data) {
    return (
      <Alert variant="error" title="Could not load your dashboard" inline>
        {apiErrorMessage(error)}
      </Alert>
    );
  }

  if (isDesktop) return <DesktopDashboard data={data} />;

  // Sections rise in one after another as the screen opens
  const rise = (order: number) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: order * 0.07, type: 'spring' as const, stiffness: 300, damping: 30 },
  });

  return (
    <div className="relative isolate space-y-6 pb-2">
      {/* Soft sky glow at the top of the page, continuing from the pinned header */}
      <div className="dash-glow pointer-events-none absolute -left-4 -right-4 top-0 -z-10 h-80" aria-hidden />
      {/* Not wrapped: its top row must sit directly in the page to stay pinned */}
      <DashboardHeader />
      <motion.div {...rise(1)}>
        <SummaryCards data={data} />
      </motion.div>
      <motion.div {...rise(2)}>
        <QuickActions />
      </motion.div>
      <motion.div {...rise(3)}>
        <IspOverview data={data} />
      </motion.div>
      {/* Paybill advert, below Calls due today */}
      <motion.div {...rise(3)}>
        <AdvertBanner />
      </motion.div>
      {/* Subscribers who owe: tap one to prompt them to pay */}
      <motion.div {...rise(3)}>
        <UnpaidInvoicesSection />
      </motion.div>
      <motion.div {...rise(3)}>
        <Alerts data={data} />
      </motion.div>
      <motion.div {...rise(5)}>
        <RecentTransactions transactions={data.recentTransactions} />
      </motion.div>
      <motion.div
        {...rise(6)}
        className="flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-black/55 p-4 text-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] backdrop-blur-md"
      >
        <ShieldCheck className="h-4 w-4 shrink-0 text-white/80" aria-hidden />
        <p className="text-[12px] text-white/80">© {new Date().getFullYear()} Knoxville Technologies Ltd.</p>
      </motion.div>

    </div>
  );
}
