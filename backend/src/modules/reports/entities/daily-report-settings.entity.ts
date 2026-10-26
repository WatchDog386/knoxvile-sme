import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('daily_report_settings')
@Index(['businessId'], { unique: true })
export class DailyReportSettings extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  /** Null follows the business owner's account email. */
  @Column({ type: 'varchar', length: 320, nullable: true })
  email: string | null;
}
