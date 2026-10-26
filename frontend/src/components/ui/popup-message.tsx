import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { SpeedWheel } from './workspace-loader';
import { cn } from '@/lib/utils';

export type PopupKind = 'success' | 'error' | 'info' | 'warning' | 'loading';

/* Colours taken from the Log Out confirmation: green #7CB82F for success, red for errors. */
const ICON_CLASS: Record<Exclude<PopupKind, 'loading'>, string> = {
  success: 'text-[#7CB82F]',
  error: 'text-[#DC2626]',
  info: 'text-[#2F6FB5]',
  warning: 'text-[#D97706]',
};

const BUTTON_CLASS: Record<Exclude<PopupKind, 'loading'>, string> = {
  success: 'bg-[#7CB82F]',
  error: 'bg-[#DC2626]',
  info: 'bg-[#2F6FB5]',
  warning: 'bg-[#D97706]',
};

const ICON: Record<Exclude<PopupKind, 'loading'>, typeof Info> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
  warning: AlertTriangle,
};

export interface PopupMessageProps {
  isOpen: boolean;
  type: PopupKind;
  title: string;
  message?: string;
  onClose?: () => void;
  /** Dark card with a dashed rule and an illustration: the "Invalid Details" look. */
  tone?: 'light' | 'dark';
  illustration?: React.ReactNode;
  /** Button wording: "Continue" by default, "Okay" on the dark popups. */
  actionLabel?: string;
}

/**
 * The message card itself, built on the Log Out confirmation's design: a card,
 * big line icon, bold title, and a single full-width action button. The backdrop
 * and the stacking belong to PopupHost.
 */
export function PopupMessage({
  isOpen,
  type,
  title,
  message,
  onClose,
  tone = 'light',
  illustration,
  actionLabel,
}: PopupMessageProps) {
  if (!isOpen) return null;

  if (type === 'loading') {
    return (
      <div className="w-full max-w-[340px] rounded-2xl bg-white px-6 py-7 text-center text-slate-900 shadow-2xl animate-scale-in">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="mt-4 flex justify-center">
          <SpeedWheel />
        </div>
      </div>
    );
  }

  const dark = tone === 'dark';
  const Icon = ICON[type];

  return (
    <div
      className={cn(
        'w-full max-w-[340px] rounded-2xl px-6 pb-6 pt-6 text-center shadow-2xl animate-scale-in',
        dark ? 'bg-[#111112] text-white ring-1 ring-white/10' : 'bg-white text-slate-900',
      )}
    >
      <h2 className={cn('text-lg font-semibold', dark && 'text-white')}>{title}</h2>

      {/* Dashed rule, as on the invalid-details popup */}
      {dark && (
        <span
          aria-hidden
          className="mx-auto mt-4 block h-px w-24 bg-[repeating-linear-gradient(to_right,#6B7280_0_10px,transparent_10px_20px)]"
        />
      )}

      {illustration ? (
        <div className="mx-auto mt-6 w-full max-w-[240px]">{illustration}</div>
      ) : (
        <Icon className={cn('mx-auto mt-6 h-20 w-20', ICON_CLASS[type])} strokeWidth={1.6} aria-hidden />
      )}

      {message && (
        <p className={cn('mt-6 text-[15px] leading-relaxed', dark ? 'text-white/85' : 'text-slate-700')}>
          {message}
        </p>
      )}

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'mt-6 h-12 w-full rounded-2xl text-[15px] font-medium text-white transition-transform active:scale-[0.98]',
            dark ? 'bg-gradient-to-b from-[#8BC53F] to-[#6C9E2A]' : BUTTON_CLASS[type],
          )}
        >
          {actionLabel ?? 'Continue'}
        </button>
      )}
    </div>
  );
}
