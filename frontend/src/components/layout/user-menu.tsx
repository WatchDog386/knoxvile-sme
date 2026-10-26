import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  ChevronDown,
  Download,
  LogOut,
  Moon,
  Sun,
  UserCircle,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useActiveBusiness } from '@/stores/business';
import { requestLogout } from './session-timeout';
import { useInstallPrompt } from '@/hooks/use-install-prompt';
import { useRole } from '@/hooks/use-role';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * Desktop account menu on the avatar: everything the mobile settings sheet
 * offers that the sidebar doesn't (profile, account, team, theme, install,
 * sign out), as an anchored dropdown.
 */
export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const business = useActiveBusiness();
  const { role } = useRole();
  const { canInstall, install } = useInstallPrompt();
  const [theme, setTheme] = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initials =
    user?.fullName
      ?.split(' ')
      .map((p) => p.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase() ?? '?';

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const avatar = (size: string) => (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-foreground-3 text-[11px] font-semibold text-foreground-3',
        size,
      )}
    >
      {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  );

  const isDark = theme === 'dark';
  const items = [
    { icon: UserCircle, label: 'My profile', onClick: () => go('/profile') },
    { icon: Banknote, label: 'Account settings', onClick: () => go('/account') },
    { icon: Users, label: 'Team members', onClick: () => go('/staff') },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full p-0.5 transition-colors hover:bg-surface-2"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {avatar('h-8 w-8')}
        <ChevronDown className={cn('h-3.5 w-3.5 text-foreground-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-lg border border-edge bg-surface shadow-2xl animate-scale-in"
        >
          <div className="flex items-center gap-3 border-b border-edge p-4">
            {avatar('h-11 w-11')}
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{user?.fullName}</p>
              <p className="truncate text-sm text-foreground-4">{user?.email}</p>
              {role && (
                <p className="mt-0.5 text-xs text-foreground-5">
                  {role.charAt(0) + role.slice(1).toLowerCase()} · {business?.name}
                </p>
              )}
            </div>
          </div>
          <div className="p-1.5">
            {items.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                onClick={item.onClick}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground-2 hover:bg-surface-2"
              >
                <item.icon className="h-4 w-4 text-foreground-4" aria-hidden />
                {item.label}
              </button>
            ))}
            <button
              role="menuitemcheckbox"
              aria-checked={isDark}
              onClick={() => setTheme(isDark ? 'brand' : 'dark')}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground-2 hover:bg-surface-2"
            >
              {isDark ? <Sun className="h-4 w-4 text-foreground-4" aria-hidden /> : <Moon className="h-4 w-4 text-foreground-4" aria-hidden />}
              {isDark ? 'Light mode' : 'Dark mode'}
            </button>
            {canInstall && (
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void install();
                }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground-2 hover:bg-surface-2"
              >
                <Download className="h-4 w-4 text-foreground-4" aria-hidden />
                Install Knoxville app
              </button>
            )}
          </div>
          <div className="border-t border-edge p-1.5">
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                requestLogout();
              }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-danger hover:bg-danger-soft"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
