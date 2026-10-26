import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AppBarButton } from './app-bar';

/**
 * Page title row. On phones the back + title row is pinned (it must sit
 * directly in the page to stay pinned), and the description and actions
 * follow underneath; on larger screens it's one row with actions on the right.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  const navigate = useNavigate();

  // Phones have no top bar, so give these screens their own way back
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/dashboard');
  };

  return (
    <>
      {/* Phones: plain back icon and centred title. Larger screens: one row, actions on the right */}
      <div className={cn('page-head grid min-h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:justify-between sm:gap-3', className)}>
        <div className="justify-self-start sm:hidden">
          <AppBarButton onClick={goBack} aria-label="Back">
            Back
          </AppBarButton>
        </div>
        <div className="min-w-0 space-y-1 text-center sm:text-left">
          <h1 className="max-w-[52vw] truncate text-[17px] font-medium tracking-tight text-foreground sm:max-w-none sm:text-xl">{title}</h1>
          {description && <p className="hidden text-sm text-foreground-4 sm:block">{description}</p>}
        </div>
        <span className="sm:hidden" aria-hidden />
        {actions && <div className="hidden items-center gap-2 sm:flex">{actions}</div>}
      </div>

      {/* Phones: description and actions scroll with the page */}
      {(description || actions) && (
        <div className="space-y-3 sm:hidden">
          {description && <p className="text-[14px] leading-relaxed text-foreground-3">{description}</p>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
    </>
  );
}
