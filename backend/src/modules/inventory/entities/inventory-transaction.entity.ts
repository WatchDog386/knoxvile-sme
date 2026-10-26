import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const INVENTORY_TX_TYPES = [
  'PURCHASE',
  'SALE',
  'RETURN',
  'ADJUSTMENT',
  'DAMAGE',
  'RESTOCK',
] as const;

@Entity('inventory_transactions')
@Index(['businessId', 'productId', 'created_at'])
@Index(['businessId', 'type'])
export class InventoryTransaction extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'uuid' })
  productId: string;

  @Column({ type: 'simple-enum', enum: INVENTORY_TX_TYPES })
  type: string;

  /** Positive = stock in, negative = stock out. */
  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'uuid', nullable: true })
  reference_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;
}