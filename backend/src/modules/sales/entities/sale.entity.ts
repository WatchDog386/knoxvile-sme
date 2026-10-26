import { Column, Entity, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const PAYMENT_METHODS = ['M-PESA', 'CASH', 'BANK', 'CARD', 'CREDIT'] as const;
export const PAYMENT_STATUSES = [
  'PAID',
  'PARTIAL',
  'UNPAID',
  'REFUNDED',
  'CANCELLED',
] as const;
export const SALE_TYPES = ['GENERAL', 'PRODUCT', 'SERVICE', 'PACKAGE', 'ADVANCE', 'OTHER', 'MIXED'] as const;

@Entity('sales')
@Index(['businessId', 'created_at'])
@Index(['businessId', 'customerId'])
@Unique(['businessId', 'idempotency_key'])
export class Sale extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @Column({ type: 'uuid', nullable: true })
  employeeId: string | null;

  /** Business category for amount-only revenue and typed item sales. */
  @Column({ type: 'varchar', length: 20, default: 'PRODUCT' })
  sale_type: string;

  /** Sales category the business chose for this sale (categories of type SALE). */
  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'int', default: 0 })
  subtotal: number;

  @Column({ type: 'int', default: 0 })
  discount: number;

  @Column({ type: 'int', default: 0 })
  tax: number;

  @Column({ type: 'int' })
  total: number;

  /** Cash already received earlier and applied to this sale. Not a new payment. */
  @Column({ type: 'int', default: 0 })
  advance_credit: number;

  /** Credit consumed from this advance receipt, if this sale is an ADVANCE. */
  @Column({ type: 'int', default: 0 })
  advance_used: number;

  /** Source advance sale and amount applied, so cancellation can return it. */
  @Column({ type: 'simple-json', nullable: true })
  advance_allocations: Array<{ saleId: string; amount: number }> | null;

  @Column({ type: 'simple-enum', enum: PAYMENT_STATUSES, default: 'PAID' })
  payment_status: string;

  @Column({ type: 'simple-enum', enum: PAYMENT_METHODS })
  payment_method: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 64 })
  idempotency_key: string;

  @Column({ type: 'timestamptz', nullable: true })
  cancelled_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  cancelled_by: string | null;

  /** Sequential per business; printed as the invoice number (INV-000123). */
  @Column({ type: 'int', nullable: true })
  number: number | null;
}
