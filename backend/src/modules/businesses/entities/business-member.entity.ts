import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserRole } from '../../../common/types/auth-user.interface';
import { Business } from './business.entity';
import { User } from '../../../modules/users/entities/user.entity';

export const MEMBERSHIP_STATUS = ['ACTIVE', 'INVITED', 'DEACTIVATED'] as const;

@Entity('business_members')
@Unique(['businessId', 'userId'])
@Index(['userId', 'status'])
export class BusinessMember extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'simple-enum', enum: UserRole, default: UserRole.EMPLOYEE })
  role: UserRole;

  /** CLIENT logins only: the client (customer) record this login belongs to. */
  @Column({ type: 'uuid', nullable: true })
  customerId: string | null;

  @Column({ type: 'simple-enum', enum: MEMBERSHIP_STATUS, default: 'ACTIVE' })
  status: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}