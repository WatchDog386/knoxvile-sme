import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { applyTheme, getTheme } from '@/lib/theme';
import { AppShell } from '@/components/layout/app-shell';
import { useAuthStore } from '@/stores/auth';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { OfflineBanner } from '@/components/layout/offline-banner';
import { SessionTimeout } from '@/components/layout/session-timeout';
import { PopupHost } from '@/components/ui/popup-host';
import { InstallAppPrompt } from '@/components/layout/install-app-prompt';
import { SHOW_MOBILE_HOME } from '@/lib/flags';
import { SignInReveal } from '@/components/ui/workspace-loader';

const LoginPage = lazy(() => import('@/features/auth/login-page').then((m) => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import('@/features/auth/forgot-password-page').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/features/auth/reset-password-page').then((m) => ({ default: m.ResetPasswordPage })));
const SuccessPage = lazy(() => import('@/features/auth/success-page').then((m) => ({ default: m.SuccessPage })));
const WelcomePage = lazy(() => import('@/features/onboarding/welcome-page').then((m) => ({ default: m.WelcomePage })));
const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage })));
const CustomersPage = lazy(() => import('@/features/customers/customers-page').then((m) => ({ default: m.CustomersPage })));
const CustomerDetailPage = lazy(() => import('@/features/customers/customer-detail-page').then((m) => ({ default: m.CustomerDetailPage })));
const ProductsPage = lazy(() => import('@/features/products/products-page').then((m) => ({ default: m.ProductsPage })));
const ServicesPage = lazy(() => import('@/features/products/services-page').then((m) => ({ default: m.ServicesPage })));
const SalesPage = lazy(() => import('@/features/sales/sales-page').then((m) => ({ default: m.SalesPage })));
const RecordSalePage = lazy(() => import('@/features/sales/record-sale-page').then((m) => ({ default: m.RecordSalePage })));
const SaleDetailPage = lazy(() => import('@/features/sales/sale-detail-page').then((m) => ({ default: m.SaleDetailPage })));
const ExpensesPage = lazy(() => import('@/features/expenses/expenses-page').then((m) => ({ default: m.ExpensesPage })));
const ExpenseDetailPage = lazy(() => import('@/features/expenses/expense-detail-page').then((m) => ({ default: m.ExpenseDetailPage })));
const RecurringExpensesPage = lazy(() => import('@/features/expenses/recurring-expenses-page').then((m) => ({ default: m.RecurringExpensesPage })));
const BudgetsPage = lazy(() => import('@/features/budgets/budgets-page').then((m) => ({ default: m.BudgetsPage })));
const AccountPage = lazy(() => import('@/features/account/account-page').then((m) => ({ default: m.AccountPage })));
const ReportsPage = lazy(() => import('@/features/reports/reports-page').then((m) => ({ default: m.ReportsPage })));
const ProfilePage = lazy(() => import('@/features/profile/profile-page').then((m) => ({ default: m.ProfilePage })));
const NotificationsPage = lazy(() => import('@/features/notifications/notifications-page').then((m) => ({ default: m.NotificationsPage })));
const StaffPage = lazy(() => import('@/features/business/staff-page').then((m) => ({ default: m.StaffPage })));
const SubscribersPage = lazy(() => import('@/features/isp/subscribers-page').then((m) => ({ default: m.SubscribersPage })));
const CallsPage = lazy(() => import('@/features/isp/calls-page').then((m) => ({ default: m.CallsPage })));
const MobileHomePage = lazy(() => import('@/features/home/mobile-home-page').then((m) => ({ default: m.MobileHomePage })));
const HelpPage = lazy(() => import('@/features/home/help-page').then((m) => ({ default: m.HelpPage })));
const ClientProfilePage = lazy(() => import('@/features/client/client-profile-page').then((m) => ({ default: m.ClientProfilePage })));
const ClientContactPage = lazy(() => import('@/features/client/client-pages').then((m) => ({ default: m.ClientContactPage })));
const ClientPackagesPage = lazy(() => import('@/features/client/client-pages').then((m) => ({ default: m.ClientPackagesPage })));
const ClientPayPage = lazy(() => import('@/features/client/client-pages').then((m) => ({ default: m.ClientPayPage })));
const ClientPaymentsPage = lazy(() => import('@/features/client/client-pages').then((m) => ({ default: m.ClientPaymentsPage })));
const ClientAmountPage = lazy(() => import('@/features/client/client-pay-flow').then((m) => ({ default: m.ClientAmountPage })));
const ClientMethodPage = lazy(() => import('@/features/client/client-pay-flow').then((m) => ({ default: m.ClientMethodPage })));
const ClientNotificationsPage = lazy(() => import('@/features/client/client-notifications').then((m) => ({ default: m.ClientNotificationsPage })));
const NotFoundPage = lazy(() => import('@/features/misc/not-found-page').then((m) => ({ default: m.NotFoundPage })));

/** Signed-in users go straight to the dashboard; everyone else to login. */
function HomeRoute() {
  const token = useAuthStore((s) => s.token);
  const isDesktop = useIsDesktop();
  if (token) return <Navigate to="/dashboard" replace />;
  if (SHOW_MOBILE_HOME && !isDesktop) return <MobileHomePage />;
  return <Navigate to="/login" replace />;
}

/** Re-applies the theme on every route change; home/auth/success stay light. */
function ThemeScope() {
  const { pathname } = useLocation();

  useEffect(() => {
    // applyTheme handles the light-only routes too (dark off, white status bar)
    applyTheme(getTheme());
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <>
      <ThemeScope />
      <OfflineBanner />
      <SessionTimeout />
      <PopupHost />
      <InstallAppPrompt />
      <SignInReveal />
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/splash" element={<Navigate to="/" replace />} />
          <Route path="/" element={<HomeRoute />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/login" element={<LoginPage />} />
          {/* Accounts are created by the company admin — no public sign-up */}
          <Route path="/register" element={<Navigate to="/login" replace />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth-success" element={<SuccessPage />} />

          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            {/* Subscriber's own pages (packages, pay, receipts, support, account) */}
            <Route path="/my-account" element={<ClientProfilePage />} />
            <Route path="/my-packages" element={<ClientPackagesPage />} />
            <Route path="/my-pay" element={<ClientPayPage />} />
            <Route path="/my-amount" element={<ClientAmountPage />} />
            <Route path="/my-method" element={<ClientMethodPage />} />
            <Route path="/my-notifications" element={<ClientNotificationsPage />} />
            <Route path="/my-payments" element={<ClientPaymentsPage />} />
            <Route path="/my-contact" element={<ClientContactPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/new" element={<Navigate to="/products?new=1" replace />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/services/new" element={<Navigate to="/services?new=1" replace />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/sales/new" element={<RecordSalePage />} />
            <Route path="/sales/:id" element={<SaleDetailPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/expenses/recurring" element={<RecurringExpensesPage />} />
    <Route path="/expenses/:id" element={<ExpenseDetailPage />} />
            <Route path="/budgets" element={<BudgetsPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/subscribers" element={<SubscribersPage />} />
            <Route path="/calls" element={<CallsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}

function RouteLoading() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center px-6 text-sm text-foreground-4">
      Loading page…
    </div>
  );
}
