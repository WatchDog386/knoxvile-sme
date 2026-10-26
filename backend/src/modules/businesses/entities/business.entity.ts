import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../../modules/users/entities/user.entity';

export const BUSINESS_TYPES = [
  'SALON',
  'BARBERSHOP',
  'RETAIL',
  'BOUTIQUE',
  'RESTAURANT',
  'BEAUTY',
  'CAR_WASH',
  'HARDWARE',
  'ELECTRONICS',
  'WHOLESALE',
  'MECHANIC',
  'FUNDI',
  'SERVICE',
  'OTHER',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const SUBSCRIPTION_PLANS = ['FREE', 'STARTER', 'BUSINESS', 'PRO'] as const;

@Entity('businesses')
export class Business extends BaseEntity {
  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 40, default: 'OTHER' })
  business_type: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 320, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  county: string | null;

  /** KRA PIN printed on invoices and receipts. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  kra_pin: string | null;

  /** Note printed at the bottom of invoices (bank / M-Pesa paybill details). */
  @Column({ type: 'text', nullable: true })
  invoice_footer: string | null;

  @Column({ type: 'varchar', length: 3, default: 'KES' })
  currency: string;

  @Column({ type: 'varchar', length: 60, default: 'Africa/Nairobi' })
  timezone: string;

  @Column({ type: 'varchar', length: 20, default: 'FREE' })
  subscription_plan: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'ownerId' })
  @Index()
  @Column({ type: 'uuid', nullable: true })
  ownerId: string | null;
}
