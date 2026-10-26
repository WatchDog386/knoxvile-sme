import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dismissPopup, notify, type PopupKind, type PopupOptions } from './popup-host';

type AlertVariant = Exclude<PopupKind, 'loading'>;

const config: Record<AlertVariant, { icon: typeof Info; tile: string; label: string }> = {
  info: {
    icon: Info,
    tile: 'bg-[#2F6FB5]/10 text-[#2F6FB5]',
    label: 'Information',
  },
  success: {
    icon: CheckCircle2,
    tile: 'bg-[#7CB82F]/12 text-[#7CB82F]',
    label: 'Success',
  },
  warning: {
    icon: AlertTriangle,
    tile: 'bg-amber-100 text-amber-600 [.dark_&]:bg-amber-500/15 [.dark_&]:text-amber-400',
    label: 'Warning',
  },
  error: {
    icon: XCircle,
    tile: 'bg-red-100 text-red-600 [.dark_&]:bg-red-500/15 [.dark_&]:text-red-400',
    label: 'Error',
  },
};

/** Pulls the readable text out of a message, whatever it is wrapped in. */
function textOf(node: React.ReactNode): string | undefined {
  if (node === null || node === undefined || node === false || node === true) return undefined;
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) {
    const parts = node.map(textOf).filter(Boolean);
    return parts.length ? parts.join(' ') : undefined;
  }
  if (typeof node === 'object' && 'props' in node) {
    return textOf((node as { props?: { children?: React.ReactNode } }).props?.children);
  }
  return undefined;
}

/**
 * Page messages arrive as popups, in the same style as the Log Out confirmation.
 * Keep using `<Alert variant="error">{error}</Alert>` wherever an action fails and
 * it shows up centred on screen, then closes itself.
 *
 * `inline` keeps the message on the page instead, for the ones that are not
 * feedback: form validation, a prompt that waits for an answer, or a note with
 * a button in it.
 */
export function Alert({
  variant = 'info',
  title,
  children,
  inline = false,
  tone,
  illustration,
  actionLabel,
  duration,
}: {
  variant?: AlertVariant;
  title?: string;
  children?: React.ReactNode;
  /** Stay on the page instead of popping up. */
  inline?: boolean;
  /** Dark popup with a dashed rule, as on the sign-in page. */
  tone?: PopupOptions['tone'];
  illustration?: React.ReactNode;
  actionLabel?: string;
  /** Milliseconds before the popup closes itself; null waits for Okay. */
  duration?: number | null;
}) {
  const message = textOf(children);
  const heading = title ?? (variant === 'error' ? 'Something went wrong' : undefined);

  useEffect(() => {
    if (inline) return;
    const id = notify(variant, heading ?? (variant === 'success' ? 'Done' : 'Notice'), message, {
      tone,
      illustration,
      actionLabel,
      duration,
    });
    // The state behind the message can clear sooner than the popup: take it down
    return () => dismissPopup(id);
  }, [inline, variant, heading, message, tone, illustration, actionLabel, duration]);

  if (!inline) return null;

  const { icon: Icon, tile, label } = config[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-label={label}
      className="flex items-start gap-4 rounded-2xl bg-white px-5 py-4 shadow-[0_10px_24px_-12px_rgba(15,23,42,0.35)] ring-1 ring-black/5 [.dark_&]:bg-[#1E1E1E] [.dark_&]:ring-white/10"
    >
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', tile)} aria-hidden>
        <Icon className="h-6 w-6" strokeWidth={1.7} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        {title && (
          <p className="text-[15px] font-semibold leading-snug text-slate-900 [.dark_&]:text-white">{title}</p>
        )}
        {children && (
          <div className={cn('text-[13.5px] leading-relaxed text-slate-700 [.dark_&]:text-slate-300', title && 'mt-1')}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
