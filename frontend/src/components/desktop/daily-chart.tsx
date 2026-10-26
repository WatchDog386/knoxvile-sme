import { cn } from '@/lib/utils';

/** A round axis maximum at or above `max`, split into 5 ticks (1, 2, 2.5, 5 × 10ⁿ steps). */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 0.2, 0.4, 0.6, 0.8, 1];
  const raw = max / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * 5 >= max) ?? 10 * pow;
  return Array.from({ length: 6 }, (_, i) => i * step);
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  return String(+n.toFixed(1));
}

/**
 * Bars per day with a light grid and dated x axis. With no values it draws a
 * dashed baseline, like an empty revenue chart.
 */
export function DailyChart({
  points,
  format,
  height = 'h-48',
  barClass = 'bg-accent',
  showGrid = true,
}: {
  points: Array<{ label: string; value: number }>;
  format: (n: number) => string;
  height?: string;
  barClass?: string;
  showGrid?: boolean;
}) {
  const max = Math.max(...points.map((p) => p.value), 0);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const empty = max <= 0;
  // Label every day up to ~16 days, then every other one so they don't collide
  const every = points.length > 16 ? 2 : 1;

  return (
    <div className="flex gap-2">
      {showGrid && (
        <div className={cn('relative w-9 shrink-0', height)}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 translate-y-1/2 text-[10.5px] tabular-nums text-foreground-4"
              style={{ bottom: `${(t / top) * 100}%` }}
            >
              {compact(t)}
            </span>
          ))}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className={cn('relative', height)}>
          {showGrid &&
            ticks.map((t) => (
              <div
                key={t}
                className="absolute inset-x-0 border-t border-edge"
                style={{ bottom: `${(t / top) * 100}%` }}
                aria-hidden
              />
            ))}
          {empty ? (
            <div className="absolute inset-x-0 bottom-0 border-t-2 border-dashed border-accent" aria-hidden />
          ) : (
            <div className="absolute inset-0 flex items-end gap-[3px]">
              {points.map((p) => (
                <div
                  key={p.label}
                  className={cn('min-w-0 flex-1 rounded-t-[2px] transition-opacity hover:opacity-80', barClass)}
                  style={{ height: `${(p.value / top) * 100}%` }}
                  title={`${p.label}: ${format(p.value)}`}
                />
              ))}
            </div>
          )}
        </div>
        <div className="mt-1 flex gap-[3px]" aria-hidden>
          {points.map((p, i) => (
            <div key={p.label} className="relative h-9 min-w-0 flex-1">
              {i % every === 0 && (
                <span className="absolute right-1/2 top-1 origin-top-right -rotate-45 whitespace-nowrap text-[10px] text-foreground-4">
                  {p.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** "Sep 13" style label for a YYYY-MM-DD day. */
export function chartDayLabel(date: string): string {
  return new Date(`${date}T12:00:00+03:00`).toLocaleDateString('en-US', {
    timeZone: 'Africa/Nairobi',
    month: 'short',
    day: 'numeric',
  });
}
