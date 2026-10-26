import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Section with a consistent heading. Sits straight on the page background, or
 * inside a dull grey tile when `card` is set (used for the sales chart).
 */
const actionClass =
  'flex shrink-0 items-center gap-0.5 text-[12px] font-semibold text-brand-600 active:opacity-70 [.dark_&]:text-brand-300';
/** Outlined pill, same as the Quick Actions "Manage" button. */
const pillClass =
  'flex h-9 shrink-0 items-center rounded-full border-2 border-edge-2 px-5 text-[15px] font-semibold text-brand-600 transition-transform active:scale-95 active:opacity-70 [.dark_&]:text-brand-400';

export function DashSection({
  title,
  subtitle,
  action,
  card = false,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  /** A link, or a button when `onClick` is given (e.g. expanding a list in place). */
  action?: { label: string; to?: string; onClick?: () => void; pill?: boolean };
  card?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        card
          ? 'rounded-3xl bg-[#F2F2F4] p-4 [.dark_&]:bg-[#1E1E1E]'
          : 'px-0.5',
        className,
      )}
    >
      <div className="mb-3.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] text-foreground-4">{subtitle}</p>}
        </div>
        {action &&
          (action.onClick || !action.to ? (
            <button type="button" onClick={action.onClick} className={action.pill ? pillClass : actionClass}>
              {action.label}
            </button>
          ) : (
            <Link to={action.to} className={action.pill ? pillClass : actionClass}>
              {action.label}
            </Link>
          ))}
      </div>
      {children}
    </section>
  );
}
