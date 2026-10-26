import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** A monthly spending limit for one expense category. */
@Entity('budgets')
@Unique(['businessId', 'categoryId'])
export class Budget extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'uuid' })
  categoryId: string;

  /** Whole KES per calendar month. */
  @Column({ type: 'int' })
  monthly_limit: number;

  /** Percent of the limit at which a warning is raised. */
  @Column({ type: 'int', default: 80 })
  alert_threshold: number;
}
