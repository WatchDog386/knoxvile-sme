import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'brand' : 'dark')}
      className="flex h-12 w-12 items-center justify-center rounded-full text-foreground-2 transition-colors hover:bg-surface-2 hover:text-accent active:bg-surface-3"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="h-6 w-6" strokeWidth={2.5} aria-hidden />
      ) : (
        <Moon className="h-6 w-6" strokeWidth={2.5} aria-hidden />
      )}
    </button>
  );
}
