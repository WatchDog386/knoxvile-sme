import {
  Column,
  Entity,
  Index,
  Unique,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export const CATEGORY_TYPES = ['PRODUCT', 'SERVICE', 'EXPENSE', 'SALE'] as const;

@Entity('categories')
@Unique(['businessId', 'type', 'name'])
@Index(['businessId', 'type'])
export class Category extends BaseEntity {
  @Column({ type: 'uuid' })
  businessId: string;

  @Column({ type: 'simple-enum', enum: CATEGORY_TYPES })
  type: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;
}