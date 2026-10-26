import * as React from 'react';
import { ChevronDown, Download, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Desktop list toolbar: filters on the left, then a search box, with the
 * page's actions (add, export) on the right.
 */
export function ListToolbar({
  filters,
  search,
  onSearch,
  searchPlaceholder = 'Search',
  actions,
}: {
  filters?: React.ReactNode;
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      {filters && <div className="flex items-center gap-2 border-r border-edge pr-3">{filters}</div>}
      {onSearch && (
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-5" aria-hidden />
          <input
            value={search ?? ''}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-md border border-edge !bg-surface pl-8 pr-3 text-[13px] text-foreground placeholder:text-foreground-5"
          />
        </div>
      )}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Plain select styled as a toolbar filter ("All Time ▾", "Status ▾"). */
export function ToolbarSelect<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9 cursor-pointer appearance-none rounded-md border-0 !bg-transparent pl-1 pr-6 text-[13.5px] text-foreground-2 hover:text-foreground"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 h-3.5 w-3.5 text-foreground-4" aria-hidden />
    </label>
  );
}

/** Solid green toolbar button (Add Customer, Export CSV). */
export function ToolbarButton({
  children,
  icon = 'none',
  variant = 'solid',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: 'add' | 'export' | 'none'; variant?: 'solid' | 'outline' }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'solid'
          ? 'bg-accent text-white hover:bg-accent-strong'
          : 'border border-edge bg-surface text-foreground-2 hover:bg-surface-2',
        className,
      )}
      {...props}
    >
      {icon === 'add' && <Plus className="h-4 w-4" aria-hidden />}
      {icon === 'export' && <Download className="h-3.5 w-3.5" aria-hidden />}
      {children}
    </button>
  );
}
