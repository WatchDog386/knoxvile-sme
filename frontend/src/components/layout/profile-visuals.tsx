import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Pencil, User as UserIcon } from 'lucide-react';
import type { User } from '@/api/types';
import { cn } from '@/lib/utils';

/** Lime green used for the ring, bubble icons and the completion label. */
export const PROFILE_GREEN = '#76B82A';

/** How complete the profile is, 0-100: name, email, phone, photo, verified email, two-factor. */
export function profileCompletion(user: User | null | undefined): number {
  if (!user) return 0;
  const checks = [
    Boolean(user.fullName?.trim()),
    Boolean(user.email),
    Boolean(user.phone),
    Boolean(user.avatarUrl),
    user.emailVerified,
    Boolean(user.twoFactorEnabled),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/**
 * Centred round avatar inside a ring. The green arc grows from the bottom with
 * the completion percentage, a pill label sits on the bottom edge and an
 * optional pencil button sits on the right edge.
 */
export function ProfileRing({
  percent,
  label,
  avatarUrl,
  initial,
  onEdit,
  editLabel = 'Edit profile',
  size = 148,
}: {
  percent: number;
  label?: ReactNode;
  avatarUrl?: string | null;
  initial?: string;
  onEdit?: () => void;
  editLabel?: string;
  size?: number;
}) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* Track and progress arc; starts at the bottom and runs up the left side */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 rotate-90"
        aria-hidden
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-slate-200 [.dark_&]:stroke-white" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={PROFILE_GREEN}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>

      {/* Photo, initial or a person silhouette */}
      <div
        className="absolute flex items-center justify-center overflow-hidden rounded-full bg-slate-100 [.dark_&]:bg-black"
        style={{ inset: stroke + 4 }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : initial ? (
          <span className="text-5xl font-semibold text-slate-400 [.dark_&]:text-slate-300">{initial}</span>
        ) : (
          <UserIcon className="h-16 w-16 text-slate-300" aria-hidden />
        )}
      </div>

      {label != null && (
        <span
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/4 rounded-xl bg-white px-4 py-1 text-[15px] font-medium shadow-sm"
          style={{ color: PROFILE_GREEN }}
        >
          {label}
        </span>
      )}

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className="absolute right-0 top-1/2 flex h-10 w-10 translate-x-1/3 -translate-y-1/4 items-center justify-center rounded-full bg-slate-800 shadow-md transition-transform active:scale-90 [.dark_&]:bg-[#2A2A2A]"
        >
          <Pencil className="h-[18px] w-[18px]" style={{ color: PROFILE_GREEN }} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** Outlined speech-bubble frame with an icon inside, like the profile reference. */
export function BubbleIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={cn('relative inline-flex h-12 w-12 items-start justify-center', className)} style={{ color: PROFILE_GREEN }}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full" fill="none" aria-hidden>
        <path
          d="M10 4h28a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6h-8l-6 7-6-7h-8a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6Z"
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
      </svg>
      <Icon className="relative mt-[11px] h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden />
    </span>
  );
}

/** Bordered card with the bubble icon, title and short description, all centred. */
export function BubbleTile({
  icon,
  title,
  description,
  onClick,
  badge,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  onClick?: () => void;
  badge?: ReactNode;
  /** Smaller tile, for three in a row. */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // No border: the tile stands off the page by its own fill and a soft shadow
        'relative flex flex-col items-center justify-center rounded-2xl bg-surface text-center shadow-sm transition-transform active:scale-[0.98]',
        compact ? 'min-h-[118px] px-2 py-3.5' : 'min-h-[150px] px-3 py-5',
      )}
    >
      {badge != null && (
        <span
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-semibold text-foreground-2"
          style={{ borderColor: PROFILE_GREEN }}
        >
          {badge}
        </span>
      )}
      <BubbleIcon icon={icon} className={compact ? 'h-10 w-10 [&>svg+svg]:mt-[9px] [&>svg+svg]:h-4 [&>svg+svg]:w-4' : undefined} />
      <span className={cn('block font-semibold leading-snug text-foreground', compact ? 'mt-2 text-[12.5px]' : 'mt-3 text-[14px]')}>{title}</span>
      {description && (
        <span className={cn('mt-1 block leading-snug text-foreground-3', compact ? 'line-clamp-2 text-[10.5px]' : 'line-clamp-1 text-[11.5px]')}>
          {description}
        </span>
      )}
    </button>
  );
}
