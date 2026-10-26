import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('daily_report_deliveries')
@Index(['businessId', 'report_date'], { unique: true })
export class DailyReportDelivery extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  /** Business-local calendar date represented by this delivery. */
  @Column({ type: 'varchar', length: 10 })
  report_date: string;

  @Column({ type: 'varchar', length: 12, default: 'SENDING' })
  status: 'SENDING' | 'SENT' | 'FAILED';

  @Column({ type: 'varchar', length: 320 })
  recipient: string;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'text', nullable: true })
  last_error: string | null;
}
