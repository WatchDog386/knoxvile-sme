import { FolderX, Plus } from 'lucide-react';

/** Desktop empty state: green outlined folder, short message, optional actions. */
export function TableEmpty({
  title,
  description,
  actionLabel,
  onAction,
  onClear,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Shown when filters or a search are hiding results. */
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <FolderX className="h-9 w-9 text-accent" strokeWidth={1.5} aria-hidden />
      <p className="mt-3 text-[16px] text-foreground-2">{title}</p>
      {description && <p className="mt-1 max-w-[17rem] text-[12.5px] leading-relaxed text-foreground-3">{description}</p>}
      <div className="mt-4 flex gap-2">
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="h-8 rounded-md border border-edge bg-surface-2 px-4 text-[13px] text-foreground-2 hover:bg-surface-3"
          >
            Clear filters
          </button>
        )}
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-4 text-[13px] font-medium text-white hover:bg-accent-strong"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
