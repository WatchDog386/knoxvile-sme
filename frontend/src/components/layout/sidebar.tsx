import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  BarChart3,
  Bell,
  ChevronDown,
  Download,
  Home,
  Package,
  PhoneCall,
  PiggyBank,
  Repeat,
  Scissors,
  Settings,
  ShoppingCart,
  UserPlus,
  Users,
  Wallet,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { dashboardApi } from '@/api/endpoints';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { useRole } from '@/hooks/use-role';
import { useActiveBusiness, useBusinessStore } from '@/stores/business';
import { useNotifications } from '@/features/notifications/notifications-shared';
import { BusinessSwitchDialog } from './topbar';

type NavItem = { to: string; label: string; icon: LucideIcon; badge?: number; end?: boolean };

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Accountant',
  EMPLOYEE: 'Staff',
  CLIENT: 'Client',
};

/**
 * Desktop navigation: a navy column with the business at the top, grouped
 * sections with small uppercase labels, and the active page in blue.
 */
export function Sidebar() {
  const { canInstall, install } = useInstallPrompt();
  const { canApprove, role, isEmployee } = useRole();
  const business = useActiveBusiness();
  const businesses = useBusinessStore((s) => s.businesses);
  const [switchOpen, setSwitchOpen] = useState(false);
  const { unread } = useNotifications();
  // Shares the dashboard query cache, so this adds no extra request.
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });
  const pending = canApprove ? data?.pendingApprovals ?? 0 : 0;

  const sections: Array<{ label?: string; items: NavItem[] }> = [
    { items: [{ to: '/dashboard', label: 'Home', icon: Home }] },
    // Employees record sales and submit expenses but never see the figures
    isEmployee
      ? {
          label: 'Work',
          items: [
            { to: '/sales/new', label: 'Record sale', icon: ShoppingCart },
            { to: '/expenses', label: 'Submit expense', icon: Wallet, end: true },
          ],
        }
      : {
      label: 'Money',
      items: [
        { to: '/sales', label: 'Sales', icon: ShoppingCart },
        { to: '/expenses', label: 'Expenses', icon: Wallet, badge: pending, end: true },
        { to: '/expenses/recurring', label: 'Recurring', icon: Repeat },
        { to: '/budgets', label: 'Budgets', icon: PiggyBank },
        { to: '/account', label: 'Account', icon: Banknote },
      ],
    },
    {
      label: 'Clients',
      items: [
        { to: '/customers', label: 'Customers', icon: Users },
        { to: '/subscribers', label: 'Subscribers', icon: Wifi },
        { to: '/calls', label: 'Calls', icon: PhoneCall },
      ],
    },
    {
      label: 'Catalogue',
      items: [
        { to: '/products', label: 'Products', icon: Package },
        { to: '/services', label: 'Services', icon: Scissors },
      ],
    },
    ...(isEmployee ? [] : [{ label: 'Insights', items: [{ to: '/reports', label: 'Reports', icon: BarChart3 }] }]),
  ];

  const footer: NavItem[] = [
    { to: '/notifications', label: 'Notifications', icon: Bell, badge: unread },
    { to: '/staff', label: 'Team', icon: UserPlus },
    { to: '/profile', label: 'Settings', icon: Settings },
  ];

  const canSwitch = businesses.length > 1;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-nav-bg text-nav-text lg:flex">
      <div className="p-2">
        <button
          type="button"
          onClick={() => canSwitch && setSwitchOpen(true)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md bg-nav-hover/[0.06] px-3 py-2.5 text-left',
            canSwitch ? 'hover:bg-nav-hover/10' : 'cursor-default',
          )}
          aria-label={canSwitch ? 'Switch business' : undefined}
        >
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[14px] font-semibold text-white">{business?.name ?? 'Knoxville'}</span>
            <span className="block truncate text-[11px] text-nav-muted">
              {role ? ROLE_LABEL[role] ?? role : 'Workspace'}
            </span>
          </span>
          {canSwitch && <ChevronDown className="h-4 w-4 shrink-0 text-nav-muted" aria-hidden />}
        </button>
      </div>

      <nav className="scrollbar-none flex-1 overflow-y-auto px-2 pb-4 pt-2" aria-label="Main">
        {sections.map((section, i) => (
          <div key={section.label ?? i} className={cn(i > 0 && 'mt-4')}>
            {section.label && (
              <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-[0.08em] text-nav-muted">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <SideLink item={item} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-0.5 border-t border-nav-hover/10 px-2 py-3">
        {canInstall && (
          <button
            type="button"
            onClick={() => void install()}
            className="flex h-9 w-full items-center gap-3 rounded-md px-2 text-[13.5px] text-nav-text transition-colors hover:bg-nav-hover/5 hover:text-white"
          >
            <Download className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            Install app
          </button>
        )}
        {footer.map((item) => (
          <SideLink key={item.to} item={item} />
        ))}
      </div>

      <BusinessSwitchDialog open={switchOpen} onOpenChange={setSwitchOpen} />
    </aside>
  );
}

function SideLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex h-9 items-center gap-3 rounded-md px-2 text-[13.5px] transition-colors',
          isActive ? 'text-nav-active' : 'text-nav-text hover:bg-nav-hover/5 hover:text-white',
        )
      }
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="truncate">{item.label}</span>
      {item.badge ? (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      ) : null}
    </NavLink>
  );
}
