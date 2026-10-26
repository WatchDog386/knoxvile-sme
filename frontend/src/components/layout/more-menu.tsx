import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Bell,
  ChevronRight,
  Landmark,
  LogOut,
  Moon,
  Package,
  PiggyBank,
  Repeat,
  Scissors,
  ShoppingCart,
  Sun,
  UserCircle,
  UserPlus,
  Users,
  Wallet,
  Wifi,
  PhoneCall,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { useActiveBusiness } from '@/stores/business';
import { requestLogout } from './session-timeout';
import { useAuthStore } from '@/stores/auth';
import { useTheme } from '@/lib/theme';

const sections = [
  { to: '/sales', label: 'Sales', icon: ShoppingCart },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/subscribers', label: 'Subscribers', icon: Wifi },
  { to: '/calls', label: 'Calls', icon: PhoneCall },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/services', label: 'Services', icon: Scissors },
  { to: '/expenses', label: 'Expenses', icon: Wallet },
  { to: '/expenses/recurring', label: 'Recurring', icon: Repeat },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/staff', label: 'Staff', icon: UserPlus },
  { to: '/account', label: 'Account', icon: Landmark },
  { to: '/notifications', label: 'Alerts', icon: Bell },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];

export function MoreMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const active = useActiveBusiness();
  const user = useAuthStore((s) => s.user);
  const [theme, setTheme] = useTheme();
  const navigate = useNavigate();

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Cover: Unsplash photo bundled in public/images */}
      <div className="relative -mx-5 -mt-5 h-36 overflow-hidden">
        <img src="/images/menu-cover.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900/90 via-brand-800/50 to-brand-700/10" aria-hidden />
        <button
          type="button"
          onClick={() => go('/profile')}
          className="absolute inset-x-5 bottom-4 flex items-center gap-3 text-left text-white active:opacity-80"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-base font-semibold ring-2 ring-white/70 backdrop-blur">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              user?.fullName?.charAt(0).toUpperCase() ?? '?'
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold">{user?.fullName ?? ''}</span>
            <span className="block truncate text-xs text-white/75">
              {active?.name ?? user?.email ?? ''}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/80" aria-hidden />
        </button>
      </div>

      <p className="mb-4 mt-5 text-[15px] font-semibold tracking-tight text-foreground">All sections</p>
      <div className="grid grid-cols-4 gap-x-2 gap-y-5">
        {sections.map((section, i) => (
          <motion.button
            key={section.to}
            type="button"
            onClick={() => go(section.to)}
            className="flex flex-col items-center gap-2"
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.05 + i * 0.025, type: 'spring', stiffness: 420, damping: 28 }}
            whileTap={{ scale: 0.9 }}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-3 text-brand-600 [.dark_&]:bg-[#1E1E1E] [.dark_&]:text-brand-400">
              <section.icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="line-clamp-2 text-center text-[12px] leading-tight text-foreground-2">{section.label}</span>
          </motion.button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl bg-surface">
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'brand' : 'dark')}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-foreground-2 active:bg-surface-2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-3 text-foreground-3">
            {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" aria-hidden /> : <Moon className="h-[18px] w-[18px]" aria-hidden />}
          </span>
          <span className="flex-1 text-left">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          {/* Android-style switch */}
          <span
            className={`relative h-6 w-11 rounded-full transition-colors ${theme === 'dark' ? 'bg-brand-600' : 'bg-foreground-5/30'}`}
            aria-hidden
          >
            <motion.span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
              animate={{ left: theme === 'dark' ? 22 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            />
          </span>
        </button>
        <div className="mx-4 h-px bg-edge" aria-hidden />
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            requestLogout();
          }}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-danger active:bg-danger-soft"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger-soft">
            <LogOut className="h-[18px] w-[18px]" aria-hidden />
          </span>
          Log out
        </button>
      </div>
    </Dialog>
  );
}
