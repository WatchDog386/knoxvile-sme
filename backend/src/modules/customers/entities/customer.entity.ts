import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('customers')
@Index(['businessId'])
@Index(['businessId', 'phone'])
export class Customer extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 320, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'int', default: 0 })
  total_spent: number;

  @Column({ type: 'int', default: 0 })
  outstanding_balance: number;

  @Column({ type: 'int', default: 0 })
  visit_count: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_visit_at: Date | null;

  // ---- Subscriber account (ISP billing details) ----

  /** Account number printed on invoices and used as the M-Pesa account reference. */
  @Column({ type: 'varchar', length: 30, nullable: true })
  account_number: string | null;

  /** Service login (PPPoE / hotspot username); defaults to the account number. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  username: string | null;

  /** Extra numbers that also get SMS and WhatsApp notices; `phone` stays the payment contact. */
  @Column({ type: 'simple-json', nullable: true })
  extra_phones: string[] | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  kra_pin: string | null;

  /** Estate or area, e.g. "Imara Daima". */
  @Column({ type: 'varchar', length: 120, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  sms_group: string | null;

  @Column({ type: 'boolean', default: false })
  new_installation: boolean;

  /** KSh taken off each package invoice. */
  @Column({ type: 'int', default: 0 })
  discount: number;

  /** Prepaid credit held for the subscriber (KSh). */
  @Column({ type: 'int', default: 0 })
  wallet_balance: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  service_type: 'HOTSPOT' | 'PPPOE' | 'STATIC' | null;

  /** Router / NAS the subscriber connects through. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  router: string | null;

  @Column({ type: 'varchar', length: 17, nullable: true })
  mac_address: string | null;

  /** PPPoE / hotspot password; never returned in lists. */
  @Column({ type: 'varchar', length: 100, nullable: true, select: false })
  service_password: string | null;

  /** Package used for burst speed, if any. */
  @Column({ type: 'uuid', nullable: true })
  burst_product_id: string | null;

  /** Allowed hours per weekday, e.g. { mon: { from: '06:00', to: '22:00' } }; null = any time. */
  @Column({ type: 'simple-json', nullable: true })
  access_hours: Record<string, { from: string; to: string }> | null;
}