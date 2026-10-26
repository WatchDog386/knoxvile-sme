import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('services')
@Index(['businessId'])
export class Service extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int' })
  price: number;

  @Column({ type: 'int', nullable: true })
  duration_minutes: number | null;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}