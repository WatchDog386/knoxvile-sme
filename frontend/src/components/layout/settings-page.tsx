import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import {
  BarChart3,
  Download,
  Wallet,
  Package,
  PiggyBank,
  Scissors,
  UserRound,
  Banknote,
  Users,
  LogOut,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TwoFactorSetting } from './two-factor-setting';
import { BubbleTile } from './profile-visuals';
import { requestLogout } from './session-timeout';
import { AccountPrefixCard } from './account-prefix-card';

interface Item {
  to: string;
  icon: LucideIcon;
  label: string;
  description?: string;
}

const businessItems: Item[] = [
  { to: '/reports', icon: BarChart3, label: 'Reports', description: 'Sales insights & analytics' },
  { to: '/staff', icon: Users, label: 'Team Members', description: 'Invite & manage staff' },
  { to: '/products', icon: Package, label: 'Products', description: 'Inventory & stock levels' },
  { to: '/services', icon: Scissors, label: 'Services', description: 'Your service catalog' },
  { to: '/expenses', icon: Wallet, label: 'Expenses', description: 'Track your spending' },
  { to: '/budgets', icon: PiggyBank, label: 'Budgets', description: 'Monthly limits & alerts' },
];

const accountItems: Item[] = [
  { to: '/profile', icon: UserRound, label: 'My Profile', description: 'Details, theme & log out' },
  { to: '/account', icon: Banknote, label: 'My Account', description: 'Settings & preferences' },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 ml-1 text-[15px] font-medium tracking-tight text-foreground">
      {children}
    </p>
  );
}

interface SettingsPageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsPage({ open, onOpenChange }: SettingsPageProps) {
  const { canInstall, install } = useInstallPrompt();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const close = () => onOpenChange(false);

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-surface-2 scrollbar-none animate-fade-in">
      {/* Header: plain bar on the page — Back on the left, Log Out on the right */}
      <header className="sticky top-0 z-10 bg-surface-2 px-4 pb-2 pt-[calc(var(--sat)+0.5rem)]">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between">
          <button
            type="button"
            onClick={close}
            className="flex h-11 w-auto shrink-0 items-center justify-start px-1 text-[14px] font-semibold text-foreground-2 transition-opacity active:opacity-60"
            aria-label="Back"
          >
            Back
          </button>
          <h1 className="flex-1 text-center text-[17px] font-semibold tracking-tight text-foreground">Settings</h1>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              requestLogout();
            }}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-danger pl-3 pr-4 text-[13px] font-bold text-white transition-transform active:scale-90"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Log out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pb-10 pt-6">
        {/* Business group */}
        <section className="mt-6">
          <SectionLabel>Business</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {businessItems.map((item) => (
              <BubbleTile key={item.label} icon={item.icon} title={item.label} description={item.description} onClick={() => go(item.to)} />
            ))}
          </div>
        </section>

        <AccountPrefixCard />

        {/* Account group */}
        <section className="mt-6">
          <SectionLabel>Account</SectionLabel>
          {/* Three smaller tiles in one row */}
          <div className="grid grid-cols-3 gap-2.5">
            {accountItems.map((item) => (
              <BubbleTile key={item.label} icon={item.icon} title={item.label} description={item.description} onClick={() => go(item.to)} compact />
            ))}
            <TwoFactorSetting tile />
          </div>
        </section>

        {canInstall && (
          <Button className="mt-6 w-full bg-[#549913] text-white hover:bg-[#467F10]" onClick={() => void install()}>
            <Download className="h-4 w-4" aria-hidden />
            Install Knoxville app
          </Button>
        )}

        <p className="pt-6 text-center text-[11px] text-foreground-5">
          Theme and photo are in My Profile · Knoxville Technologies Ltd
        </p>
      </div>
    </div>,
    document.body,
  );
}
