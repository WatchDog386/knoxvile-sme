import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Same green the client sees on their own dashboard card. */
const CARD_GRADIENT = 'linear-gradient(135deg, #12463A 0%, #0D5B3F 55%, #072A21 100%)';

export type HeroCardStatus = { label: string; tone: 'ok' | 'warn' | 'bad' };
export type HeroCardAction = { label: string; icon: LucideIcon; onClick: () => void };

const STATUS_TONE: Record<HeroCardStatus['tone'], string> = {
  ok: 'bg-emerald-400/20 text-emerald-200',
  warn: 'bg-amber-400/20 text-amber-200',
  bad: 'bg-red-400/20 text-red-200',
};

/** Outlined pill that sits on the card. */
function CardPill({ action }: { action: HeroCardAction }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={action.onClick}
      className="flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-white/70 text-[13px] font-semibold text-white transition-transform active:scale-[0.97]"
    >
      <Icon className="h-4 w-4" aria-hidden />
      {action.label}
    </button>
  );
}

/**
 * The green package card from the client dashboard's hero, reused wherever a
 * staff view summarises the same thing from the other side.
 */
export function PackageHeroCard({
  label,
  name,
  headline,
  sub,
  actions = [],
  footer,
  status,
  className,
}: {
  label: string;
  /** Small uppercase line under the label, usually a person's or shop's name. */
  name?: string | null;
  headline: ReactNode;
  /** Secondary figure on the right of the headline. */
  sub?: ReactNode;
  actions?: HeroCardAction[];
  footer?: ReactNode;
  status?: HeroCardStatus;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-lg border border-white/15 p-5 text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,0.85)]',
        className,
      )}
      style={{ background: CARD_GRADIENT }}
    >
      {/* Faint decorative arcs on the right, like the client dashboard card */}
      <svg
        className="pointer-events-none absolute -right-10 top-0 h-full w-1/2 opacity-25"
        viewBox="0 0 200 200"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <g fill="none" stroke="white" strokeWidth="0.7">
          {[26, 44, 62, 80, 98].map((r) => (
            <circle key={r} cx="200" cy="70" r={r} />
          ))}
        </g>
      </svg>

      <div className="relative">
        <p className="text-[13px] text-white/80">{label}</p>
        {name && <p className="mt-1 text-[13px] font-semibold uppercase tracking-wide text-white/90">{name}</p>}

        <p className="mt-3 flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-[22px] font-semibold leading-tight">{headline}</span>
          {sub && <span className="shrink-0 text-[15px] font-medium text-white/85">{sub}</span>}
        </p>

        {actions.length > 0 && (
          <div className={cn('mt-3 grid gap-3', actions.length > 2 ? 'grid-cols-3' : 'grid-cols-2')}>
            {actions.map((action) => (
              <CardPill key={action.label} action={action} />
            ))}
          </div>
        )}

        {(footer || status) && (
          <p className="mt-3 text-[12px] text-white/70">
            {footer}
            {status && (
              <span className={cn('ml-2 inline-flex align-middle rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_TONE[status.tone])}>
                {status.label}
              </span>
            )}
          </p>
        )}
      </div>
    </article>
  );
}