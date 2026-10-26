import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Service } from './entities/service.entity';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import {
  CreateProductDto,
  CreateServiceDto,
  StockMovementDto,
  UpdateProductDto,
  UpdateServiceDto,
} from './dto/product.dto';

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export const stockStatus = (product: Product): StockStatus => {
  if (product.stock_quantity <= 0) return 'OUT_OF_STOCK';
  if (product.stock_quantity <= product.low_stock_threshold) return 'LOW_STOCK';
  return 'IN_STOCK';
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    businessId: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      categoryId?: string;
      stockStatus?: StockStatus;
    },
  ): Promise<PaginatedResult<Product & { stock_status: StockStatus; category_name: string | null }>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoin('categories', 'category', 'category.id = product.categoryId')
      .addSelect('category.name', 'category_name')
      .where('product.businessId = :businessId', { businessId });

    if (query.search) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('product.name LIKE :search', { search: `%${query.search}%` })
            .orWhere('product.sku LIKE :search', { search: `%${query.search}%` });
        }),
      );
    }
    if (query.categoryId) {
      qb.andWhere('product.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.stockStatus === 'OUT_OF_STOCK') {
      qb.andWhere('product.stock_quantity <= 0');
    } else if (query.stockStatus === 'LOW_STOCK') {
      qb.andWhere('product.stock_quantity > 0');
      qb.andWhere('product.stock_quantity <= product.low_stock_threshold');
    } else if (query.stockStatus === 'IN_STOCK') {
      qb.andWhere('product.stock_quantity > product.low_stock_threshold');
    }

    const [rows, total] = await qb
      .orderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = rows.map((row) =>
      Object.assign(row, {
        category_name: (row as Product & { category_name?: string }).category_name ?? null,
        stock_status: stockStatus(row),
      }),
    );

    return { items, total, page, limit };
  }

  async get(businessId: string, id: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id, businessId },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product not found.',
      });
    }
    return product;
  }

  async create(
    businessId: string,
    dto: CreateProductDto,
    actorId: string,
  ): Promise<Product> {
    const product = this.productRepo.create({
      businessId,
      name: dto.name,
      sku: dto.sku ?? null,
      categoryId: dto.categoryId ?? null,
      cost_price: dto.costPrice,
      selling_price: dto.sellingPrice,
      stock_quantity: dto.stockQuantity ?? 0,
      low_stock_threshold: dto.lowStockThreshold ?? 5,
      // WiFi packages are sold as access, not stock
      track_inventory: dto.billingDays ? false : (dto.trackInventory ?? true),
      billing_days: dto.billingDays ?? null,
      speed_mbps: dto.speedMbps ?? null,
      description: dto.description?.trim() || null,
      active: true,
    });
    await this.productRepo.save(product);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'PRODUCT_CREATED',
      entity: 'product',
      entityId: product.id,
      metadata: { name: product.name, costPrice: product.cost_price, sellingPrice: product.selling_price },
    });
    return product;
  }

  async update(
    businessId: string,
    id: string,
    dto: UpdateProductDto,
    actorId: string,
  ): Promise<Product> {
    const product = await this.get(businessId, id);
    Object.assign(product, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.costPrice !== undefined ? { cost_price: dto.costPrice } : {}),
      ...(dto.sellingPrice !== undefined
        ? { selling_price: dto.sellingPrice }
        : {}),
      ...(dto.lowStockThreshold !== undefined
        ? { low_stock_threshold: dto.lowStockThreshold }
        : {}),
      ...(dto.trackInventory !== undefined
        ? { track_inventory: dto.trackInventory }
        : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
      ...(dto.billingDays !== undefined ? { billing_days: dto.billingDays ?? null } : {}),
      ...(dto.speedMbps !== undefined ? { speed_mbps: dto.speedMbps ?? null } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
      ...(dto.billingDays ? { track_inventory: false } : {}),
    });
    await this.productRepo.save(product);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'PRODUCT_UPDATED',
      entity: 'product',
      entityId: id,
      metadata: { ...dto },
    });
    return product;
  }

  async remove(businessId: string, id: string, actorId: string): Promise<void> {
    const product = await this.get(businessId, id);
    const count = await this.productRepo.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('sale_items', 'item')
      .where('item.productId = :id', { id })
      .getRawOne<{ count: string }>();
    if (Number(count?.count ?? 0) > 0) {
      throw new ConflictException({
        code: 'PRODUCT_HAS_SALES',
        message: 'This product has been sold and cannot be deleted. Deactivate it instead.',
      });
    }
    await this.productRepo.remove(product);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'PRODUCT_DELETED',
      entity: 'product',
      entityId: id,
    });
  }

  async restock(
    businessId: string,
    id: string,
    dto: StockMovementDto,
    actorId: string,
  ): Promise<Product> {
    await this.get(businessId, id);
    await this.inventoryService.applyMovements(
      businessId,
      [{ productId: id, quantity: dto.quantity, type: 'RESTOCK', reason: dto.reason }],
      actorId,
    );
    return this.get(businessId, id);
  }

  async adjust(
    businessId: string,
    id: string,
    dto: StockMovementDto,
    actorId: string,
  ): Promise<Product> {
    const product = await this.get(businessId, id);
    const delta = dto.quantity - product.stock_quantity;
    await this.inventoryService.applyMovements(
      businessId,
      [{ productId: id, quantity: delta, type: 'ADJUSTMENT', reason: dto.reason }],
      actorId,
    );
    return this.get(businessId, id);
  }

  async damage(
    businessId: string,
    id: string,
    dto: StockMovementDto,
    actorId: string,
  ): Promise<Product> {
    await this.get(businessId, id);
    await this.inventoryService.applyMovements(
      businessId,
      [{ productId: id, quantity: -dto.quantity, type: 'DAMAGE', reason: dto.reason }],
      actorId,
    );
    return this.get(businessId, id);
  }

  movementHistory(businessId: string, id: string) {
    return this.inventoryService.history(businessId, id);
  }

  async lowStockCount(businessId: string): Promise<number> {
    const row = await this.productRepo
      .createQueryBuilder('product')
      .select('COUNT(*)', 'count')
      .where('product.businessId = :businessId', { businessId })
      .andWhere('product.track_inventory = :track', { track: true })
      .andWhere('product.active = :active', { active: true })
      .andWhere('product.stock_quantity <= product.low_stock_threshold')
      .getRawOne<{ count: string }>();
    return Number(row?.count ?? 0);
  }

  // ---- Services ----

  async listServices(
    businessId: string,
    query: { search?: string; categoryId?: string; active?: boolean },
  ): Promise<Service[]> {
    const qb = this.serviceRepo
      .createQueryBuilder('service')
      .where('service.businessId = :businessId', { businessId });
    if (query.search) {
      qb.andWhere('service.name LIKE :search', { search: `%${query.search}%` });
    }
    if (query.categoryId) {
      qb.andWhere('service.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.active !== undefined) {
      qb.andWhere('service.active = :active', { active: query.active });
    }
    return qb.orderBy('service.name', 'ASC').getMany();
  }

  async getService(businessId: string, id: string): Promise<Service> {
    const service = await this.serviceRepo.findOne({
      where: { id, businessId },
    });
    if (!service) {
      throw new NotFoundException({
        code: 'SERVICE_NOT_FOUND',
        message: 'Service not found.',
      });
    }
    return service;
  }

  async createService(
    businessId: string,
    dto: CreateServiceDto,
    actorId: string,
  ): Promise<Service> {
    const service = this.serviceRepo.create({
      businessId,
      name: dto.name,
      description: dto.description ?? null,
      price: dto.price,
      duration_minutes: dto.durationMinutes ?? null,
      categoryId: dto.categoryId ?? null,
      active: true,
    });
    await this.serviceRepo.save(service);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'SERVICE_CREATED',
      entity: 'service',
      entityId: service.id,
      metadata: { name: service.name, price: service.price },
    });
    return service;
  }

  async updateService(
    businessId: string,
    id: string,
    dto: UpdateServiceDto,
    actorId: string,
  ): Promise<Service> {
    const service = await this.getService(businessId, id);
    Object.assign(service, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.durationMinutes !== undefined
        ? { duration_minutes: dto.durationMinutes }
        : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });
    await this.serviceRepo.save(service);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'SERVICE_UPDATED',
      entity: 'service',
      entityId: id,
      metadata: { ...dto },
    });
    return service;
  }

  async removeService(
    businessId: string,
    id: string,
    actorId: string,
  ): Promise<void> {
    const service = await this.getService(businessId, id);
    const count = await this.serviceRepo.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('sale_items', 'item')
      .where('item.serviceId = :id', { id })
      .getRawOne<{ count: string }>();
    if (Number(count?.count ?? 0) > 0) {
      throw new ConflictException({
        code: 'SERVICE_HAS_SALES',
        message: 'This service has been sold and cannot be deleted. Deactivate it instead.',
      });
    }
    await this.serviceRepo.remove(service);
    await this.auditService.log({
      businessId,
      userId: actorId,
      action: 'SERVICE_DELETED',
      entity: 'service',
      entityId: id,
    });
  }
}