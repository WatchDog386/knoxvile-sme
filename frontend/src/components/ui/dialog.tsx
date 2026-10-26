import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { Button } from './button';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/** How far (px) or how fast a sheet must be pulled down to close it. */
const DISMISS_OFFSET = 120;
const DISMISS_VELOCITY = 600;

/**
 * Modal that is a bottom sheet on phones (slides up, drag the handle down to
 * close) and a centred card on larger screens.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  const isDesktop = useIsDesktop();
  const dragControls = useDragControls();

  // Keep showing the last content while the sheet animates out, since callers
  // often clear the state that fills it at the moment they close it.
  const shown = React.useRef({ title, description, children });
  if (open) shown.current = { title, description, children };

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onOpenChange(false);
  };

  // Only the handle/header starts a drag, so scrolling the form never closes it
  const startDrag = (event: React.PointerEvent) => {
    if (!isDesktop) dragControls.start(event);
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={shown.current.title}
            className={cn(
              'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-edge bg-surface-3 shadow-xl sm:max-w-lg sm:rounded-2xl',
              className,
            )}
            initial={isDesktop ? { opacity: 0, scale: 0.96, y: 8 } : { y: '100%' }}
            animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={isDesktop ? { opacity: 0, scale: 0.97, y: 8 } : { y: '100%' }}
            transition={
              isDesktop
                ? { duration: 0.18, ease: 'easeOut' }
                : { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }
            }
            drag={isDesktop ? false : 'y'}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            {/* Grab handle — phones only */}
            <div
              className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 active:cursor-grabbing sm:hidden"
              onPointerDown={startDrag}
              aria-hidden
            >
              <span className="h-1.5 w-10 rounded-full bg-foreground-5/40" />
            </div>

            {(shown.current.title || shown.current.description) && (
              <div
                className="flex shrink-0 touch-none items-start justify-between gap-4 border-b border-edge px-5 pb-4 pt-2 sm:touch-auto sm:p-5 sm:pb-4"
                onPointerDown={startDrag}
              >
                <div className="space-y-1">
                  {shown.current.title && (
                    <h2 className="text-base font-semibold text-foreground sm:text-sm sm:font-medium">{shown.current.title}</h2>
                  )}
                  {shown.current.description && <p className="text-sm text-foreground-4">{shown.current.description}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2 -mt-1 h-8 w-8 text-foreground-3 hover:text-foreground"
                  onClick={() => onOpenChange(false)}
                  onPointerDown={(event) => event.stopPropagation()}
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,var(--sab))]">
              {shown.current.children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
