import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/**
 * One paybill payment forwarded to the C2B webhook. The M-Pesa code
 * (TransID) is unique, so a payment that is sent twice is applied once.
 */
@Entity('mpesa_c2b_transactions')
@Index(['businessId', 'created_at'])
export class MpesaC2bTransaction extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  /** M-Pesa confirmation code, e.g. RKTQDM7W6S. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  trans_id: string;

  @Column({ type: 'timestamptz', nullable: true })
  trans_time: Date | null;

  @Column({ type: 'int' })
  amount: number;

  /** What the client typed as the account number, e.g. FBI0001. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  bill_ref: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  short_code: string | null;

  /** The payer's number, or the hashed value Safaricom sends instead (64 characters). */
  @Column({ type: 'varchar', length: 128, nullable: true })
  msisdn: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  payer_name: string | null;

  /** The subscriber or customer the payment was recorded for, if any. */
  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  /**
   * APPLIED: on an existing subscriber's account. NEW_ACCOUNT: subscriber
   * created from this payment. CUSTOMER: paid without an account number, on a
   * customer record. UNMATCHED: no phone (or a masked one) and no account: the sale carries the payer's
   * name but no customer record. HOTSPOT: a hotspot purchase (router + device), recorded as a sale.
   * PROMPT: answered a prompt sent from the app, which recorded the sale.
   */
  @Column({ type: 'varchar', length: 12, default: 'PROCESSING' })
  status: 'PROCESSING' | 'APPLIED' | 'NEW_ACCOUNT' | 'CUSTOMER' | 'UNMATCHED' | 'HOTSPOT' | 'PROMPT';

  /** Sales the money went to (invoices settled, package renewed, credit). */
  @Column({ type: 'simple-json', nullable: true })
  sale_ids: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  raw: Record<string, unknown> | null;
}
