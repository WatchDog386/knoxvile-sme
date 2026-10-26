import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const EXPENSE_PAYMENT_METHODS = ['CASH', 'M-PESA', 'BANK', 'CARD'] as const;
export const EXPENSE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

@Entity('expenses')
@Index(['businessId', 'expense_date'])
@Index(['businessId', 'categoryId'])
@Index(['businessId', 'status'])
export class Expense extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'varchar', length: 150 })
  description: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'simple-enum', enum: EXPENSE_PAYMENT_METHODS, default: 'CASH' })
  payment_method: string;

  /** Receipt as a URL or a data URL (image/PDF, at most ~2 MB). */
  @Column({ type: 'text', nullable: true })
  receipt_url: string | null;

  @Column({ type: 'uuid', nullable: true })
  employeeId: string | null;

  @Column({ type: 'timestamptz' })
  expense_date: Date;

  /** Only APPROVED expenses count towards totals, reports and budgets. */
  @Column({ type: 'simple-enum', enum: EXPENSE_STATUSES, default: 'APPROVED' })
  status: ExpenseStatus;

  @Column({ type: 'uuid', nullable: true })
  submittedById: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  rejection_reason: string | null;

  /** Set when the expense was generated from a recurring template. */
  @Column({ type: 'uuid', nullable: true })
  recurringExpenseId: string | null;
}