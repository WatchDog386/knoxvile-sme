import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  ChevronsUpDown,
  Menu,
  Search,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useActiveBusiness, useBusinessStore } from '@/stores/business';
import { useAuthStore } from '@/stores/auth';
import { useNotifications } from '@/features/notifications/notifications-shared';
import { SearchDialog } from '@/features/dashboard/components/search-dialog';
import { usePageMetaStore } from '@/stores/page-meta';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Dialog } from '@/components/ui/dialog';
import { ThemeToggle } from './theme-toggle';
import { SettingsPage } from './settings-page';
import { UserMenu } from './user-menu';

const TZ = 'Africa/Nairobi';

/** Current Nairobi time, refreshed every 15 seconds. */
function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function Topbar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const now = useClock();
  // Only notifications not yet read on this device
  const { unread: notificationCount } = useNotifications();

  const dateLabel = new Intl.DateTimeFormat('en-KE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ,
  }).format(now);
  const timeLabel = new Intl.DateTimeFormat('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  }).format(now);
  const initials =
    user?.fullName
      ?.split(' ')
      .map((p) => p.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? '?';

  return (
    <>
    <DesktopTopbar />
    <header className="hidden sm:flex lg:hidden sticky top-0 z-30 h-16 items-center justify-between gap-3 border-b border-edge bg-surface-2/90 px-6 backdrop-blur lg:px-8">
      <BusinessSwitcher />
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-2 rounded-full border border-edge bg-surface px-4 py-1.5 text-xs text-foreground-4 shadow-sm md:inline-flex">
          Indicators for
          <span className="flex items-center gap-1 font-medium text-foreground">
            <CalendarDays className="h-3.5 w-3.5 text-brand-600" aria-hidden />
            {dateLabel}
          </span>
        </span>
        <time
          className="hidden text-xl font-semibold tabular-nums tracking-tight text-foreground md:block"
          dateTime={now.toISOString()}
        >
          {timeLabel}
        </time>
        <button
          onClick={() => navigate('/notifications')}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-brand-700 transition-colors hover:bg-surface-3 [.dark_&]:text-brand-200"
          aria-label={notificationCount > 0 ? `Notifications (${notificationCount})` : 'Notifications'}
        >
          <Bell className="h-5 w-5" aria-hidden />
          {notificationCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-2 ring-surface-2">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>
        <ThemeToggle />
        {/* Tablets keep the settings sheet; desktop uses the account menu instead. */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-3 lg:hidden"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        </button>
        <div className="hidden lg:block">
          <UserMenu />
        </div>
        <button
          onClick={() => navigate('/profile')}
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-white/85 text-lg font-black italic text-white shadow-[0_2px_6px_rgba(0,0,0,0.5)] lg:hidden"
          style={{ background: 'radial-gradient(circle at 50% 30%, #2F4A36 0%, #111C15 65%, #050A07 100%)', textShadow: '0 0 1px #000, 0 1px 2px #000, 0 2px 3px rgba(0,0,0,0.8)' }}
          aria-label="My profile"
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </button>
      </div>
      <SettingsPage open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
    </>
  );
}

/** Desktop page titles, by route prefix (first match wins, so longer prefixes come first). */
const PAGE_TITLES: Array<[string, string]> = [
  ['/expenses/recurring', 'Recurring expenses'],
  ['/sales/new', 'Record sale'],
  ['/dashboard', 'Home'],
  ['/sales', 'Sales'],
  ['/customers', 'Customers'],
  ['/subscribers', 'Subscribers'],
  ['/calls', 'Calls'],
  ['/products', 'Products'],
  ['/services', 'Services'],
  ['/expenses', 'Expenses'],
  ['/budgets', 'Budgets'],
  ['/account', 'Account'],
  ['/reports', 'Reports'],
  ['/staff', 'Team'],
  ['/profile', 'Settings'],
  ['/notifications', 'Notifications'],
];

/** Desktop top bar: page title and count on the left; theme switch, search, alerts and account on the right. */
function DesktopTopbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const count = usePageMetaStore((s) => s.count);
  const { unread } = useNotifications();
  const [theme, setTheme] = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const title = PAGE_TITLES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'Knoxville';
  const isDark = theme === 'dark';

  return (
    <header className="sticky top-0 z-30 hidden h-14 items-center justify-between gap-4 border-b border-edge bg-surface px-6 lg:flex">
      <h1 className="truncate text-[15px] font-normal text-foreground-2">
        {title}
        {count !== null && <span className="text-foreground-3"> - {count}</span>}
      </h1>
      <div className="flex items-center gap-4">
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          onClick={() => setTheme(isDark ? 'brand' : 'dark')}
          className="flex items-center gap-2 text-[13px] font-medium text-accent"
        >
          <span className={cn('relative h-5 w-9 rounded-full transition-colors', isDark ? 'bg-accent' : 'bg-edge-2')}>
            <span
              className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]',
                isDark ? 'left-[18px]' : 'left-0.5',
              )}
            />
          </span>
          {isDark ? 'Dark' : 'Light'}
        </button>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground-4 transition-colors hover:bg-surface-2 hover:text-foreground"
          aria-label="Search"
        >
          <Search className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => navigate('/notifications')}
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-foreground-4 transition-colors hover:bg-surface-2 hover:text-foreground"
          aria-label={unread > 0 ? `Notifications (${unread})` : 'Notifications'}
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white ring-2 ring-surface">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
        <UserMenu />
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}

export function BusinessSwitcher() {
  const [open, setOpen] = useState(false);
  const businesses = useBusinessStore((s) => s.businesses);
  const active = useActiveBusiness();

  // Single company: show its name, no switcher
  if (businesses.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-sm font-medium text-accent">
          {active?.name?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <p className="max-w-[220px] truncate text-sm font-medium text-foreground">{active?.name}</p>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
        aria-label="Switch business"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-sm font-medium text-accent">
          {active?.name?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div className="min-w-0 leading-tight">
          <p className="max-w-[160px] truncate text-sm font-medium text-foreground">
            {active?.name ?? 'Select business'}
          </p>
          <p className="text-[10px] text-foreground-5">
            {active ? 'Switch business' : 'No business yet'}
          </p>
        </div>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-foreground-5" aria-hidden />
      </button>

      <BusinessSwitchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Pick which business to manage; shared by the tablet top bar and the desktop sidebar. */
export function BusinessSwitchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const businesses = useBusinessStore((s) => s.businesses);
  const selectBusiness = useBusinessStore((s) => s.selectBusiness);
  const active = useActiveBusiness();
  const navigate = useNavigate();

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Switch business"
      description="Choose which business you want to manage."
    >
      <div className="space-y-2">
        {businesses.map((business) => {
          const isActive = business.id === active?.id;
          return (
            <button
              key={business.id}
              onClick={() => {
                selectBusiness(business);
                onOpenChange(false);
                navigate('/dashboard');
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded-full border px-3 py-3 text-left transition-colors',
                isActive
                  ? 'border-accent-border bg-accent-soft'
                  : 'border-edge hover:bg-surface-2',
              )}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-sm font-medium text-accent">
                {business.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {business.name}
                </p>
                <p className="text-xs text-foreground-5">
                  {business.business_type} · {business.county ?? '—'}
                </p>
              </div>
              {isActive && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-white">
                  ACTIVE
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
