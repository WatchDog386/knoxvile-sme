import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * A client's WiFi package. One per client: buying a package starts it,
 * buying again extends it (renewal), buying a different one switches plan.
 */
@Entity('subscriptions')
@Index(['businessId', 'expires_at'])
@Unique(['businessId', 'customerId'])
export class Subscription extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'uuid' })
  customerId: string;

  /** The package product currently on. */
  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'varchar', length: 150 })
  package_name: string;

  @Column({ type: 'int', nullable: true })
  speed_mbps: number | null;

  /** Monthly price at the last purchase. */
  @Column({ type: 'int' })
  price: number;

  @Column({ type: 'timestamptz' })
  started_at: Date;

  /** Service is active until this moment. */
  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'int', default: 0 })
  renewals: number;

  @Column({ type: 'uuid', nullable: true })
  last_sale_id: string | null;
}
