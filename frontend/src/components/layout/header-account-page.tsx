import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { requestLogout } from './session-timeout';

interface HeaderAccountPageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Small account screen opened from the dashboard avatar. */
export function HeaderAccountPage({ open, onOpenChange }: HeaderAccountPageProps) {
  const [theme, setTheme] = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-surface-2 scrollbar-none animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="header-account-title"
    >
      <header className="sticky top-0 z-10 bg-surface-2 px-4 pb-2 pt-[calc(var(--sat)+0.5rem)]">
        <div className="mx-auto flex h-14 max-w-md items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-11 w-auto shrink-0 items-center justify-start px-1 text-[14px] font-semibold text-foreground-2 transition-opacity active:opacity-60"
            aria-label="Back to dashboard"
          >
            Back
          </button>
          <h1 id="header-account-title" className="flex-1 text-center text-[17px] font-semibold tracking-tight text-foreground">
            Account
          </h1>
          <span className="h-11 w-11 shrink-0" aria-hidden="true" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-10 pt-6">
        <section className="overflow-hidden rounded-2xl border border-edge bg-surface">
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'brand' : 'dark')}
            className="flex w-full items-center gap-3 px-4 py-4 text-left text-foreground-2 transition-colors active:bg-surface-2"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-3 text-foreground-3">
              {isDark ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
            </span>
            <span className="flex-1 text-sm font-medium">{isDark ? 'Light mode' : 'Dark mode'}</span>
            <span
              className={`relative h-6 w-11 rounded-full transition-colors ${isDark ? 'bg-brand-600' : 'bg-foreground-5/30'}`}
              aria-hidden="true"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isDark ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
              />
            </span>
          </button>

          <div className="mx-4 h-px bg-edge" aria-hidden="true" />

          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              requestLogout();
            }}
            className="flex w-full items-center gap-3 px-4 py-4 text-left text-sm font-medium text-danger transition-colors active:bg-danger-soft"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-soft">
              <LogOut className="h-5 w-5" aria-hidden />
            </span>
            Log out
          </button>
        </section>
      </main>
    </div>,
    document.body,
  );
}
