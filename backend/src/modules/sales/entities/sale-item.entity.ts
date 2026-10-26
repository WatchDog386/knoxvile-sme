import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('sale_items')
@Index(['saleId'])
@Index(['productId'])
@Index(['serviceId'])
export class SaleItem extends BaseEntity {
  @Column({ type: 'uuid' })
  saleId: string;

  @Column({ type: 'uuid', nullable: true })
  productId: string | null;

  @Column({ type: 'uuid', nullable: true })
  serviceId: string | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int' })
  unit_price: number;

  @Column({ type: 'int', nullable: true })
  cost_price: number | null;

  @Column({ type: 'int' })
  total: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  item_name: string | null;

  /** For WiFi packages: whether this line started a subscription or renewed one. */
  @Column({ type: 'varchar', length: 10, nullable: true })
  package_event: 'NEW' | 'RENEWAL' | null;
}