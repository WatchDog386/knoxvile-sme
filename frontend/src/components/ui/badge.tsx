import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'outline';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-accent-soft-2 text-accent-text',
  secondary: 'bg-surface-3 text-foreground-2',
  success: 'bg-success-soft text-success-text',
  warning: 'bg-warning-soft text-warning-text',
  danger: 'bg-danger-soft text-danger-text',
  outline: 'border border-edge text-foreground-3',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'PAID':
    case 'SUCCESS':
    case 'COMPLETED':
    case 'IN_STOCK':
    case 'DONE':
    case 'ACTIVE':
    case 'APPROVED':
      return 'success';
    case 'PARTIAL':
    case 'BOOKED':
    case 'CONFIRMED':
    case 'LOW_STOCK':
    case 'PENDING':
      return 'warning';
    case 'UNPAID':
    case 'OVERDUE':
    case 'CANCELLED':
    case 'FAILED':
    case 'OUT_OF_STOCK':
    case 'NO_SHOW':
    case 'REJECTED':
      return 'danger';
    case 'REFUNDED':
      return 'outline';
    default:
      return 'secondary';
  }
}

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}