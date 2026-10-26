import * as React from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

/**
 * Desktop table in a white card: a leading dot column, light headers, rows
 * that highlight on hover, optional pager and an empty state in place of rows.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  empty,
  loading,
  page,
  totalPages,
  total,
  onPage,
  dot,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: React.ReactNode;
  loading?: boolean;
  page?: number;
  totalPages?: number;
  total?: number;
  onPage?: (page: number) => void;
  /** Colour of the leading dot per row (status); grey when omitted. */
  dot?: (row: T) => string;
}) {
  const alignClass = (align?: Column<T>['align']) =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className="rounded-md border border-edge bg-surface px-6 py-2">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-edge">
            <th className="w-8 py-4 text-left" aria-hidden>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground-2" />
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn('py-4 pr-4 text-[13px] font-normal text-foreground-2', alignClass(c.align), c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + 1} className="py-12 text-center text-[13px] text-foreground-4">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1}>{empty}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-edge/70 last:border-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-surface-2',
                )}
              >
                <td className="py-3.5" aria-hidden>
                  <span className={cn('inline-block h-1.5 w-1.5 rounded-full', dot ? dot(row) : 'bg-edge-2')} />
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn('py-3.5 pr-4 text-[13.5px] text-foreground-2', alignClass(c.align), c.className)}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {onPage && page !== undefined && totalPages !== undefined && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-edge py-3">
          <p className="text-[12.5px] text-foreground-4">
            Page {page} of {totalPages}
            {total !== undefined && ` · ${total} total`}
          </p>
          <div className="flex gap-2">
            <PagerButton disabled={page <= 1} onClick={() => onPage(page - 1)}>
              Previous
            </PagerButton>
            <PagerButton disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
              Next
            </PagerButton>
          </div>
        </div>
      )}
    </div>
  );
}

function PagerButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="h-8 rounded-md border border-edge bg-surface px-3 text-[13px] text-foreground-2 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
      {...props}
    />
  );
}

/** Small coloured status label used inside desktop tables. */
export function StatusText({ tone, children }: { tone: 'green' | 'red' | 'amber' | 'grey' | 'blue'; children: React.ReactNode }) {
  const tones = {
    green: 'text-emerald-600 [.dark_&]:text-emerald-400',
    red: 'text-red-600 [.dark_&]:text-red-400',
    amber: 'text-amber-600 [.dark_&]:text-amber-400',
    grey: 'text-foreground-4',
    blue: 'text-sky-600 [.dark_&]:text-sky-400',
  };
  return <span className={cn('text-[13px]', tones[tone])}>{children}</span>;
}

/** Leading-dot colours matching StatusText tones. */
export const DOT = {
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  grey: 'bg-edge-2',
  blue: 'bg-sky-500',
} as const;
