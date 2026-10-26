import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Desktop page with a full-height panel of figures on the right (Payouts /
 * Dashboard style). Cancels the shell's padding so the panel meets the top bar.
 */
export function RailLayout({
  children,
  rail,
  mainClassName,
}: {
  children: React.ReactNode;
  rail: React.ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="-mx-6 -mb-10 -mt-6 flex min-h-[calc(100vh-3.5rem)]">
      <div className={cn('min-w-0 flex-1 px-6 pb-10 pt-6', mainClassName)}>{children}</div>
      <aside className="w-72 shrink-0 space-y-3 overflow-y-auto border-l border-edge bg-surface-2 p-3 [.dark_&]:bg-surface">{rail}</aside>
    </div>
  );
}

/** Header band at the top of the rail ("KES"). */
export function RailHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-12 items-center justify-center rounded-2xl bg-surface text-[13.5px] font-medium text-foreground-2 shadow-sm">
      {children}
    </div>
  );
}

/** One centred figure in the rail: label, value, note and an optional action. */
export function RailStat({
  label,
  value,
  note,
  action,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'red' | 'green';
}) {
  return (
    <section className="rounded-2xl bg-surface px-5 py-6 text-center shadow-sm">
      <p className="text-[13.5px] text-foreground-3">{label}</p>
      <p
        className={cn(
          'mt-2 text-[22px] font-semibold tabular-nums text-foreground',
          tone === 'red' && 'text-red-600 [.dark_&]:text-red-400',
          tone === 'green' && 'text-emerald-600 [.dark_&]:text-emerald-400',
        )}
      >
        {value}
      </p>
      {note && <p className="mt-2 text-[12.5px] text-foreground-4">{note}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </section>
  );
}

/** Rail section of labelled bars (e.g. revenue by payment method). */
export function RailBars({
  title,
  rows,
  format = (n) => String(n),
  empty = 'Nothing yet.',
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  format?: (n: number) => string;
  empty?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <section className="rounded-2xl bg-surface px-5 py-6 shadow-sm">
      <p className="mb-4 text-center text-[13.5px] text-foreground-3">{title}</p>
      {rows.length === 0 || max === 0 ? (
        <p className="text-center text-[12.5px] text-foreground-4">{empty}</p>
      ) : (
        <ul className="space-y-3.5">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-foreground-2">{row.label}</span>
                <span className="tabular-nums text-foreground-4">{format(row.value)}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-edge">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((row.value / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Small outline button used inside the rail ("Withdraw", "View past payouts"). */
export function RailButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'h-8 rounded-full bg-[#3A8F91] px-4 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2F7F81] active:bg-[#2F7F81]',
        props.className,
      )}
    />
  );
}
