import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn, formatKES } from '@/lib/utils';
import { barColor, barStripes } from '@/lib/chart-colors';
import { DashSection } from './dash-section';

const TZ = 'Africa/Nairobi';
const keyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const labelFormat = new Intl.DateTimeFormat('en-KE', { timeZone: TZ, weekday: 'short' });

/**
 * Nairobi calendar day as YYYY-MM-DD. The API sends each day as Nairobi
 * midnight in UTC (e.g. 2026-10-09T21:00Z is 10 Oct), so never slice the string.
 */
function dayKey(d: Date): string {
  return keyFormat.format(d);
}

/** Height of the tallest bar, in pixels. */
const BAR_AREA = 112;

/**
 * Sales for the last seven days, ending today. Today is highlighted; tap any
 * bar to read its exact total. Days without sales show as empty, not invented.
 */
export function SalesChart({
  series,
}: {
  series: Array<{ date: string; total: string }>;
  weekRevenue: number;
}) {
  const days = useMemo(() => {
    const totals = new Map<string, number>();
    for (const point of series ?? []) {
      const key = dayKey(new Date(point.date));
      totals.set(key, (totals.get(key) ?? 0) + Number(point.total));
    }
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today.getTime() - (6 - i) * 86_400_000);
      return {
        key: dayKey(d),
        label: labelFormat.format(d).slice(0, 3),
        total: totals.get(dayKey(d)) ?? 0,
      };
    });
  }, [series]);

  const [selected, setSelected] = useState(days.length - 1);
  const max = Math.max(...days.map((d) => d.total), 1);
  const weekTotal = days.reduce((sum, d) => sum + d.total, 0);
  const active = days[selected];

  return (
    <DashSection title="Sales this week" subtitle="Last 7 days" action={{ label: 'Reports', to: '/reports' }} card>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[24px] font-semibold tabular-nums tracking-tight text-foreground">{formatKES(weekTotal)}</p>
          <p className="text-[12px] text-foreground-4">Avg {formatKES(Math.round(weekTotal / 7))} a day</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-wider text-foreground-4">
            {selected === days.length - 1 ? 'Today' : active.label}
          </p>
          <p className="text-[15px] font-semibold tabular-nums text-brand-600 [.dark_&]:text-brand-300">
            {formatKES(active.total)}
          </p>
        </div>
      </div>

      <div className="flex h-36 items-end gap-2" role="list" aria-label="Daily sales">
        {days.map((day, i) => {
          const isActive = i === selected;
          const height = day.total > 0 ? Math.max(8, Math.round((day.total / max) * BAR_AREA)) : 4;
          return (
            <button
              key={day.key}
              type="button"
              role="listitem"
              onClick={() => setSelected(i)}
              className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              aria-label={`${day.label}: ${formatKES(day.total)}`}
              aria-pressed={isActive}
            >
              <motion.span
                className={cn(
                  'w-full max-w-[34px] rounded-full transition-opacity duration-300',
                  isActive && 'shadow-[0_8px_18px_-8px_rgba(15,23,42,0.45)]',
                )}
                // Every bar has its own colour; the selected day is striped
                style={{ background: isActive ? barStripes(i) : barColor(i).solid, opacity: isActive ? 1 : 0.85 }}
                initial={{ height: 0 }}
                animate={{ height }}
                transition={{ delay: 0.2 + i * 0.05, type: 'spring', stiffness: 170, damping: 22 }}
              />
              <span
                className={cn(
                  'text-[11px] leading-none',
                  isActive ? 'font-semibold text-foreground' : 'font-medium text-foreground-4',
                )}
              >
                {day.label}
              </span>
            </button>
          );
        })}
      </div>
    </DashSection>
  );
}
