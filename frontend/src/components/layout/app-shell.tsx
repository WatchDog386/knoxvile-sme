import { useEffect, useState } from 'react';
import { WorkspaceLoader } from '@/components/ui/workspace-loader';
import { Navigate, useLocation } from 'react-router-dom';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { useBusinessStore } from '@/stores/business';
import { useAuthStore } from '@/stores/auth';
import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { AnimatedOutlet } from './animated-outlet';
import { Topbar } from './topbar';
import { Brand } from './brand';
import { cn } from '@/lib/utils';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { hasOnboarded } from '@/features/onboarding/onboarding-state';
import { useTheme } from '@/lib/theme';
import { useRole } from '@/hooks/use-role';
import { SetPasswordGate } from '@/features/auth/set-password-gate';
import { SetPinGate, TrustDevicePrompt } from '@/features/auth/set-pin-gate';
import { pinDeviceSkipped, readPinDevice } from '@/lib/pin-device';
import { MoneyPopups } from '@/features/notifications/notifications-shared';

/** The only pages a subscriber (CLIENT role) may open. */
const CLIENT_PATHS = [
  '/dashboard',
  '/my-account',
  '/my-packages',
  '/my-pay',
  '/my-amount',
  '/my-method',
  '/my-notifications',
  '/my-payments',
  '/my-contact',
];

export function AppShell() {
  const { token, loading } = useBootstrap();
  const businesses = useBusinessStore((s) => s.businesses);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  // Asked once per visit whether this device should open with the PIN
  const [trustAsked, setTrustAsked] = useState(pinDeviceSkipped);
  const isDashboard = location.pathname === '/dashboard';
  const { isClient, isEmployee } = useRole();

  // Pinned headers only show their edge once the page has scrolled under them
  useEffect(() => {
    const onScroll = () => document.documentElement.classList.toggle('page-scrolled', window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.documentElement.classList.remove('page-scrolled');
    };
  }, []);
  const isDesktop = useIsDesktop();
  const [theme] = useTheme();

  // Inside the app the phone's status bar matches the page (sky glow, or
  // #16202F in dark mode); the opening splash alone keeps the Knoxville navy
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    // Phone pages have a soft sky glow at the top: the status bar matches it
    const glow = !isDesktop;
    document.body.classList.toggle('app-glow', glow);
    meta.content = theme === 'dark' ? (glow ? '#16202F' : '#121212') : glow ? '#D7E7FF' : '#FFFFFF';
    return () => {
      // Back on sign-in pages, which are pure white
      meta.content = '#FFFFFF';
      document.body.classList.remove('app-glow');
    };
  }, [theme, isDesktop]);

  if (!token) {
    // Desktop: sign-in. Phones: first-time users see the welcome page, everyone else the home page
    if (isDesktop) return <Navigate to="/login" replace />;
    return <Navigate to={hasOnboarded() ? '/' : '/welcome'} replace />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <WorkspaceLoader />
      </div>
    );
  }

  if (businesses.length === 0) {
    return <NoAccess name={user?.fullName} onSignOut={logout} />;
  }

  // Still on a password the office gave them: they set their own before the app
  if (user?.mustChangePassword) return <SetPasswordGate />;

  // Then a PIN of their own, as on a banking app
  if (user && user.hasPin === false) return <SetPinGate />;
  if (user?.hasPin && !trustAsked && readPinDevice()?.userId !== user.id) {
    return <TrustDevicePrompt onDone={() => setTrustAsked(true)} />;
  }

  // Clients only have their own dashboard and account page: no staff menu, footer bar
  // or any other page. CLIENT_PATHS lists what they are allowed to open.
  if (isClient) {
    if (!CLIENT_PATHS.some((p) => location.pathname === p)) {
      return <Navigate to="/dashboard" replace />;
    }
    return (
      <main className="mx-auto w-full max-w-xl px-4 pb-[calc(2rem+var(--sab))] pt-2 lg:pt-8">
        <AnimatedOutlet />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* "Payment received" / "Sale recorded" pop-ups on any page (admins only) */}
      {!isEmployee && <MoneyPopups />}
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main
          className={cn(
            // Bottom room so the last item scrolls clear of the floating nav bar
            // overflow-x-clip: pages slide in from the side; without it the page is briefly
            // wider than the screen and the fixed footer bar shifts with it
            'min-w-0 flex-1 overflow-x-clip px-4 pb-[calc(9rem+var(--sab))] lg:px-6 lg:pb-10',
            isDashboard ? 'pt-2 lg:pt-6' : 'pt-6 lg:pt-6',
          )}
        >
          <div className="mx-auto w-full max-w-6xl lg:max-w-none">
            <AnimatedOutlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

/** Signed-in user who hasn't been added to the company yet. */
function NoAccess({ name, onSignOut }: { name?: string; onSignOut: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm space-y-4 text-center">
        <Brand className="justify-center" compact />
        <h1 className="text-lg font-medium text-foreground">
          {name ? `Hi ${name.split(' ')[0]}, ` : ''}your account isn&apos;t active yet
        </h1>
        <p className="text-sm text-foreground-4">
          Ask an Knoxville administrator to add you from the Staff page, then sign in again.
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-full border border-edge px-5 py-2 text-sm font-medium text-foreground hover:bg-surface-2"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
