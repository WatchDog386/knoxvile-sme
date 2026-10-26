import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Screen app bar with a plain back icon on the left,
 * centred title, optional action on the right. Pinned on phones via `page-head`.
 */
export function AppBar({
  title,
  onBack,
  right,
  className,
  titleClassName,
  backClassName,
}: {
  title: string;
  /** Defaults to going back, or to the dashboard when there's no history. */
  onBack?: () => void;
  right?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  backClassName?: string;
}) {
  const navigate = useNavigate();
  const goBack = onBack ?? (() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard')));

  return (
    <div className={cn('page-head grid min-h-14 grid-cols-[1fr_auto_1fr] items-center gap-2', className)}>
      <div className="justify-self-start">
        <AppBarButton onClick={goBack} aria-label="Back" className={cn('!h-10 !w-auto min-w-12 justify-start px-1 text-[14px] font-semibold', backClassName)}>
          Back
        </AppBarButton>
      </div>
      <h1 className={cn('max-w-[52vw] truncate text-center text-[17px] font-medium tracking-tight text-foreground lg:max-w-none', titleClassName)}>
        {title}
      </h1>
      <div className="flex items-center justify-self-end">{right}</div>
    </div>
  );
}

/** Unboxed, accessible hit area for page back navigation. */
export function AppBarButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-12 w-12 shrink-0 items-center justify-center text-foreground-2 transition-transform active:scale-90 active:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

/** Plain coloured text action for the app bar, like "Mark all as read". */
export function AppBarTextAction({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'px-1 py-2 text-[13px] font-medium text-brand-600 transition-opacity active:opacity-60 disabled:opacity-40 [.dark_&]:text-brand-300',
        className,
      )}
      {...props}
    />
  );
}

export type ChipItem<T extends string> = {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Small trailing badge, e.g. how many expenses are waiting for approval. */
  count?: number;
};

/** Filled pill tabs that scroll sideways, edge to edge on phones. */
export function Chips<T extends string>({
  items,
  value,
  onChange,
  className,
  outline = false,
}: {
  items: ChipItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  /** Outlined pills, the same style as the dashboard's Manage button. */
  outline?: boolean;
}) {
  return (
    <div className={cn('-mx-4 flex gap-2.5 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:px-0', className)}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-pressed={active}
            className={cn(
              'flex shrink-0 items-center gap-1.5 transition-colors active:scale-[0.97]',
              outline
                ? cn(
                    'h-9 rounded-full border-2 px-5 text-[15px] font-semibold text-brand-600 [.dark_&]:text-brand-400',
                    active ? 'border-brand-600 [.dark_&]:border-brand-400' : 'border-edge-2',
                  )
                : cn(
                    'h-10 rounded-full px-5 text-[13px] font-medium',
                    active ? 'bg-brand-600 text-white [.dark_&]:bg-brand-500' : 'bg-surface-3 text-foreground-2',
                  ),
            )}
          >
            {item.icon && <item.icon className="h-4 w-4" />}
            {item.label}
            {!!item.count && (
              <span
                className={cn(
                  'ml-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                  active
                    ? 'bg-brand-600 text-white [.dark_&]:bg-brand-500'
                    : 'bg-surface-3 text-foreground-2',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
