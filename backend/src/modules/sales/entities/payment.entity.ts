import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const PAYMENT_TX_STATUSES = ['SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'] as const;

@Entity('payments')
@Index(['businessId', 'transaction_date'])
@Index(['businessId', 'saleId'])
@Index(['businessId', 'customerId'])
export class Payment extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'uuid', nullable: true })
  saleId: string | null;

  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', length: 20 })
  method: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reference: string | null;

  @Column({ type: 'simple-enum', enum: PAYMENT_TX_STATUSES, default: 'SUCCESS' })
  status: string;

  @Column({ type: 'timestamptz' })
  transaction_date: Date;

  /** Sequential per business; printed as the receipt number (RCT-000045). */
  @Column({ type: 'int', nullable: true })
  receipt_number: number | null;
}