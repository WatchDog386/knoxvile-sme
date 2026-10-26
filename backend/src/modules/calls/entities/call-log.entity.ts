import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const CALL_OUTCOMES = [
  'REACHED',
  'NO_ANSWER',
  'BUSY',
  'PROMISED_TO_PAY',
  'CALL_BACK',
  'WRONG_NUMBER',
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const CALL_CHANNELS = ['PHONE', 'WHATSAPP', 'SMS'] as const;

/** One call (or WhatsApp chat) with a client, logged by a staff member. */
@Entity('call_logs')
@Index(['businessId', 'customerId', 'created_at'])
@Index(['businessId', 'follow_up_at'])
export class CallLog extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'uuid' })
  customerId: string;

  /** Staff member who made the call. */
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 20, default: 'PHONE' })
  channel: string;

  @Column({ type: 'varchar', length: 20 })
  outcome: CallOutcome;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** When to call back, if a follow-up was scheduled. */
  @Column({ type: 'timestamptz', nullable: true })
  follow_up_at: Date | null;

  @Column({ type: 'boolean', default: false })
  follow_up_done: boolean;
}
