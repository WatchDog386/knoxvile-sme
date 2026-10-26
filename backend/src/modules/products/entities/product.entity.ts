import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('products')
@Index(['businessId'])
@Unique(['businessId', 'sku'])
export class Product extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sku: string | null;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'int' })
  cost_price: number;

  @Column({ type: 'int' })
  selling_price: number;

  @Column({ type: 'int', default: 0 })
  stock_quantity: number;

  @Column({ type: 'int', default: 5 })
  low_stock_threshold: number;

  @Column({ type: 'boolean', default: true })
  track_inventory: boolean;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  // ---- Internet packages (Knoxville is an ISP) ----

  /** Days of access one unit buys (e.g. 30). Set = this product is a WiFi package. */
  @Column({ type: 'int', nullable: true })
  billing_days: number | null;

  /** Advertised speed of a package, in Mbps. */
  @Column({ type: 'int', nullable: true })
  speed_mbps: number | null;

  /** Optional short description (shown on package cards). */
  @Column({ type: 'text', nullable: true })
  description: string | null;
}