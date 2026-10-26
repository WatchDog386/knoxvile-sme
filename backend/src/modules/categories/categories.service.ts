import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { AuditService } from '../audit/audit.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
    private readonly auditService: AuditService,
  ) {}

  list(businessId: string, type?: string): Promise<Category[]> {
    return this.repo.find({
      where: { businessId, ...(type ? { type } : {}) },
      order: { name: 'ASC' },
    });
  }

  async create(
    businessId: string,
    dto: CreateCategoryDto,
    actorId: string,
  ): Promise<Category> {
    const category = this.repo.create({
      businessId,
      name: dto.name,
      type: dto.type,
    });
    await this.repo.save(category);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'CATEGORY_CREATED',
      entity: 'category',
      entityId: category.id,
      metadata: { name: dto.name, type: dto.type },
    });
    return category;
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateCategoryDto,
    actorId: string,
  ): Promise<Category> {
    const category = await this.get(businessId, id);
    if (dto.name !== undefined) category.name = dto.name;
    await this.repo.save(category);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'CATEGORY_UPDATED',
      entity: 'category',
      entityId: id,
      metadata: { ...dto },
    });
    return category;
  }

  async remove(businessId: string, id: string, actorId: string): Promise<void> {
    const category = await this.get(businessId, id);
    await this.repo.remove(category);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'CATEGORY_DELETED',
      entity: 'category',
      entityId: id,
    });
  }

  async get(businessId: string, id: string): Promise<Category> {
    const category = await this.repo.findOne({ where: { id, businessId } });
    if (!category) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Category not found.',
      });
    }
    return category;
  }
}