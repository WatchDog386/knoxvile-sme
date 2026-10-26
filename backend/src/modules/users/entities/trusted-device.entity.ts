import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from './user.entity';

/**
 * A phone or browser where the person signed in with their password and
 * turned on PIN sign-in. The device keeps a random secret; only its hash is
 * stored here. PIN sign-in needs both that secret and the PIN.
 */
@Entity('trusted_devices')
export class TrustedDevice extends BaseEntity {
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 64 })
  token_hash: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_used_at: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
