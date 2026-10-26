import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EXPENSE_PAYMENT_METHODS } from '../../expenses/entities/expense.entity';

/**
 * A monthly expense template (rent, salaries, subscriptions). Each month, on
 * `day_of_month`, an APPROVED expense is generated from it.
 */
@Entity('recurring_expenses')
@Index(['businessId', 'active'])
export class RecurringExpense extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'varchar', length: 150 })
  description: string;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'simple-enum', enum: EXPENSE_PAYMENT_METHODS, default: 'BANK' })
  payment_method: string;

  /** 1-28, so every month has the day. */
  @Column({ type: 'int', default: 1 })
  day_of_month: number;

  /** Calendar dates (YYYY-MM-DD) in the business timezone. */
  @Column({ type: 'varchar', length: 10 })
  start_date: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  end_date: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  /** Last month (YYYY-MM) an expense was generated or skipped for. */
  @Column({ type: 'varchar', length: 7, nullable: true })
  last_generated_month: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;
}
